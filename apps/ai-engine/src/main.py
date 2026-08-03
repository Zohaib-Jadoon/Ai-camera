"""
Multi-camera processing manager for Madad Vision AI Engine.
Runs purely as an asyncio background service connected via Socket.IO.
No REST API, no FastAPI, no auth required.
"""
# Load .env BEFORE any os.getenv() calls so all variables are available
# when uvicorn starts the process (uvicorn does not auto-load .env files).
try:
    from dotenv import load_dotenv as _load_dotenv
    import pathlib as _pathlib
    _load_dotenv(_pathlib.Path(__file__).parent.parent / ".env")
except ImportError:
    pass  # python-dotenv not installed — fall back to environment variables

import asyncio
import logging
import socketio
import os
import time
from datetime import datetime, timezone
from .detector import Detector
from .tracker import ObjectTracker
from .intrusion import IntrusionDetector
from .face_engine import FaceEngine
from .stream_handler import StreamHandler
from .data_collector import DataCollector
from .model_registry import ModelRegistry
from .camera_manager import CameraManager
from .motion import MotionDetector  # Frigate-inspired motion gating
from .stationary_classifier import (  # Frigate Phase-3: stationary persistence
    StationaryMotionClassifier,
    get_stationary_threshold,
)
# ── Advanced AI modules ─────────────────────────────────────────────────────
from .traffic_analyzer import CongestionDetector, SpeedEstimator, WrongWayDetector
from .safety_analyzer import FallDetector, FightDetector, PPEDetector
from .lpr_engine import LPREngine
from .reid_engine import ReIDEngine
from .clip_engine import CLIPSearchEngine
from .forecast_engine import ForecastEngine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

BACKEND_WS_URL = os.getenv("BACKEND_WS_URL", "http://localhost:3001")
CONFIDENCE_THRESHOLD = float(os.getenv("MODEL_CONFIDENCE_THRESHOLD", "0.55"))
AI_ENGINE_KEY = os.getenv("AI_ENGINE_KEY", "default-secret-key")

# Shared infrastructure
model_registry = ModelRegistry()
detector = Detector(confidence=CONFIDENCE_THRESHOLD)
face_engine = FaceEngine()

# ── Advanced AI modules (shared across all cameras) ─────────────────────────
lpr_engine = LPREngine()
reid_engine = ReIDEngine()
clip_search = CLIPSearchEngine()
forecast_engine = ForecastEngine()

# Socket.IO client — AI Engine connects TO the backend gateway.
# engineio_options: raise pingTimeout to 60s so brief GIL holds from OpenCV
# background threads don't cause the server to drop the connection.
sio = socketio.AsyncClient(
    reconnection=True,
    reconnection_attempts=0,        # 0 = unlimited retries
    reconnection_delay=2,           # start at 2s
    reconnection_delay_max=15,      # cap at 15s
    engineio_logger=False,
)

camera_manager = CameraManager()
active_streams: dict[str, StreamHandler] = {}
# Map camera_id -> IntrusionDetector so zone updates can be pushed to live tasks
active_intrusion_detectors: dict[str, "IntrusionDetector"] = {}

# Tracks whether the first sync since (re)connect has happened.
# On the first sync we wipe ALL active tasks to clear any stale IDs
# from a previous session — subsequent syncs do a normal diff.
_first_sync_after_connect = True
_heartbeat_task: asyncio.Task | None = None


@sio.event
async def connect():
    global _first_sync_after_connect, _heartbeat_task
    logger.info(f"Connected to backend WebSocket at {BACKEND_WS_URL}")
    _first_sync_after_connect = True   # next sync_cameras is a clean slate
    await sio.emit('request_cameras')
    await sio.emit('request_embeddings')
    if _heartbeat_task is None or _heartbeat_task.done():
        _heartbeat_task = asyncio.create_task(health_heartbeat())


@sio.event
async def disconnect():
    logger.warning("Disconnected from backend WebSocket — will reconnect automatically")


@sio.on('sync_cameras')
async def on_sync_cameras(cameras):
    global _first_sync_after_connect
    logger.info(f"Received {len(cameras)} cameras from backend")

    new_ids = {c["id"] for c in cameras}

    if _first_sync_after_connect:
        # ── First sync after connect: stop EVERYTHING ─────────────────────
        # This clears any stale camera IDs that were active in a previous
        # AI Engine session so they don't keep sending camera_status events
        # for IDs that no longer exist in the database.
        logger.info("First sync — clearing all stale camera tasks")
        for old_id in camera_manager.ids():
            camera_manager.remove(old_id)
            if old_id in active_streams:
                active_streams[old_id].stop()
                del active_streams[old_id]
            if old_id in active_intrusion_detectors:
                del active_intrusion_detectors[old_id]
        _first_sync_after_connect = False
    else:
        # ── Subsequent syncs: diff-based add/remove ────────────────────────
        for old_id in camera_manager.ids():
            if old_id not in new_ids:
                logger.info(f"Stopping task for removed camera {old_id}")
                camera_manager.remove(old_id)
                if old_id in active_streams:
                    active_streams[old_id].stop()
                    del active_streams[old_id]
                active_intrusion_detectors.pop(old_id, None)

    # Start tasks for new cameras; restart tasks when rtsp_url changed
    for camera in cameras:
        cid = camera["id"]
        existing = camera_manager.get(cid)
        new_rtsp = camera.get("rtsp_url", "")

        if existing and existing.rtsp_url != new_rtsp:
            # URL changed — cancel old task and stream, then respawn
            logger.info(
                f"Camera {cid} RTSP URL changed: {existing.rtsp_url!r} → {new_rtsp!r} — restarting task"
            )
            camera_manager.remove(cid)
            if cid in active_streams:
                active_streams[cid].stop()
                del active_streams[cid]
            active_intrusion_detectors.pop(cid, None)
            existing = None  # fall through to spawn below

        if not existing:
            task = asyncio.create_task(process_camera(camera))
            camera_manager.register(cid, camera.get("name", cid), new_rtsp, task)
            logger.info(f"Spawned task for camera: {camera.get('name', cid)}")



@sio.on('sync_embeddings')
async def on_sync_embeddings(embeddings):
    face_engine.load_embeddings(embeddings)


@sio.on('request_model_swap')
async def on_model_swap(data):
    """Hot-swap the active YOLO model for a given SOP.

    Payload: { "sop_name": "hardhat_required" }
    The engine will load the registered .pt file without restarting.
    """
    sop_name = data.get("sop_name") if isinstance(data, dict) else None
    model_path = model_registry.resolve(sop_name)
    try:
        detector.load_model(model_path)
        logger.info(f"Model hot-swapped to '{sop_name}' ({model_path})")
        if sio.connected:
            await sio.emit("model_swap_ack", {"sop_name": sop_name, "model_path": model_path, "status": "ok"})
    except Exception as e:
        logger.error(f"Model swap failed: {e}")
        if sio.connected:
            await sio.emit("model_swap_ack", {"sop_name": sop_name, "status": "error", "error": str(e)})


@sio.on('request_registry')
async def on_request_registry(_data=None):
    """Return the full model registry snapshot to the backend."""
    if sio.connected:
        await sio.emit("sync_registry", model_registry.snapshot())


@sio.on('extract_face')
async def on_extract_face(data: dict):
    """
    Extract face embedding from an uploaded image.
    Payload: { "request_id": str, "image_b64": str }
    Response: { "request_id": str, "embedding": list[float] | None, "error": str | None }
    """
    request_id = data.get("request_id", "")
    image_b64 = data.get("image_b64", "")
    
    if not image_b64:
        if sio.connected:
            await sio.emit("extract_face_result", {
                "request_id": request_id,
                "embedding": None,
                "error": "No image provided"
            })
        return

    loop = asyncio.get_event_loop()

    def _process_image(b64: str):
        import base64 as _b64
        import cv2 as _cv2
        import numpy as _np
        try:
            # Strip data URI prefix if present
            if "," in b64:
                b64 = b64.split(",", 1)[1]
            img_data = _b64.b64decode(b64)
            nparr = _np.frombuffer(img_data, _np.uint8)
            frame = _cv2.imdecode(nparr, _cv2.IMREAD_COLOR)
            return face_engine.extract_embedding(frame)
        except Exception as e:
            logger.error(f"Failed to decode base64 image: {e}")
            return None

    try:
        embedding = await loop.run_in_executor(None, _process_image, image_b64)
        if sio.connected:
            await sio.emit("extract_face_result", {
                "request_id": request_id,
                "embedding": embedding,
                "error": None if embedding else "No face detected or extraction failed"
            })
    except Exception as e:
        logger.error(f"Extract face error: {e}")
        if sio.connected:
            await sio.emit("extract_face_result", {
                "request_id": request_id,
                "embedding": None,
                "error": str(e)
            })


@sio.on('test_stream')
async def on_test_stream(data: dict):
    """
    Quick RTSP reachability test — called by backend when the user clicks
    'Test Connection' in the camera calibration UI.

    Payload:  { "request_id": str, "rtsp_url": str }
    Response: { "request_id": str, "ok": bool, "message": str,
                "resolution": [w, h] | null, "fps": float | null }
    """
    request_id = data.get("request_id", "")
    rtsp_url = data.get("rtsp_url", "")

    if not rtsp_url:
        if sio.connected:
            await sio.emit("stream_test_result", {
                "request_id": request_id,
                "ok": False,
                "message": "No RTSP URL provided.",
                "resolution": None,
                "fps": None,
            })
        return

    loop = asyncio.get_event_loop()

    def _probe(url: str):
        import cv2 as _cv2
        cap = _cv2.VideoCapture(url)
        if not cap.isOpened():
            return False, "Cannot open stream — check URL, credentials, and network.", None, None
        ret, frame = cap.read()
        if not ret or frame is None:
            cap.release()
            return False, "Connected but no frame received — camera may be offline.", None, None
        h, w = frame.shape[:2]
        fps = cap.get(_cv2.CAP_PROP_FPS)
        cap.release()
        return True, "Connection successful.", [w, h], round(fps, 1)

    try:
        ok, message, resolution, fps = await asyncio.wait_for(
            loop.run_in_executor(None, _probe, rtsp_url),
            timeout=8.0,
        )
    except asyncio.TimeoutError:
        ok, message, resolution, fps = False, "Connection timed out (>8s). Verify the IP and RTSP path.", None, None
    except Exception as exc:
        ok, message, resolution, fps = False, str(exc), None, None

    if sio.connected:
        await sio.emit("stream_test_result", {
            "request_id": request_id,
            "ok": ok,
            "message": message,
            "resolution": resolution,
            "fps": fps,
        })
    logger.info(f"Stream test for {rtsp_url}: ok={ok} message={message}")


@sio.on('sync_zones')
async def on_sync_zones(data: dict):
    """Push updated zone list to a running camera task without restarting it.

    Payload: { "camera_id": str, "zones": list }
    """
    camera_id = data.get("camera_id") if isinstance(data, dict) else None
    zones = data.get("zones", []) if isinstance(data, dict) else []
    if camera_id and camera_id in active_intrusion_detectors:
        active_intrusion_detectors[camera_id].update_zones(zones)
        logger.info(f"Camera {camera_id}: zones live-updated ({len(zones)} zone(s))")
    else:
        logger.warning(f"sync_zones: camera {camera_id} not found in active tasks")


@sio.on('clip_search')
async def on_clip_search(data: dict):
    """Natural language video search.

    Payload: { "request_id": str, "query": str }
    Response: { "request_id": str, "results": [...] }
    """
    request_id = data.get("request_id", "")
    query = data.get("query", "")
    if not query:
        if sio.connected:
            await sio.emit("clip_search_result", {
                "request_id": request_id, "results": [], "error": "No query provided"
            })
        return

    loop = asyncio.get_event_loop()
    results = await loop.run_in_executor(None, clip_search.search, query)
    if sio.connected:
        await sio.emit("clip_search_result", {
            "request_id": request_id,
            "results": results,
            "stats": clip_search.get_index_stats(),
        })
    logger.info(f"CLIP search '{query}': {len(results)} results")


@sio.on('request_forecast')
async def on_request_forecast(data: dict):
    """Generate predictive forecasts.

    Payload: { "request_id": str, "camera_id"?: str }
    Response: { "request_id": str, "forecast": [...], "anomalies": [...], "stats": {...} }
    """
    request_id = data.get("request_id", "")
    camera_id = data.get("camera_id")

    loop = asyncio.get_event_loop()
    forecast = await loop.run_in_executor(None, forecast_engine.forecast, camera_id)
    anomalies = await loop.run_in_executor(None, forecast_engine.get_anomalies, camera_id)
    stats = forecast_engine.get_stats()

    if sio.connected:
        await sio.emit("forecast_result", {
            "request_id": request_id,
            "forecast": forecast,
            "anomalies": anomalies,
            "stats": stats,
        })
    logger.info(f"Forecast generated: {len(forecast)} predictions, {len(anomalies)} anomalies")

async def health_heartbeat():
    """Emit periodic camera_status heartbeat for all active streams."""
    while True:
        for cam_id in list(active_streams.keys()):
            if sio.connected and not cam_id.endswith(":record"):
                await sio.emit('camera_status', {'camera_id': cam_id, 'status': 'ONLINE'})
        await asyncio.sleep(30)


async def ensure_connected():
    """Initial connection to the backend Socket.IO gateway.

    Built-in reconnection handles drops automatically after the first connect.
    This coroutine just establishes the initial connection with a retry loop.
    """
    while True:
        if sio.connected:
            # Already connected — built-in reconnection handles any drops.
            await asyncio.sleep(10)
            continue
        try:
            await asyncio.wait_for(
                sio.connect(
                    BACKEND_WS_URL,
                    socketio_path="/socket.io",
                    transports=["websocket"],
                    headers={"x-ai-engine-key": AI_ENGINE_KEY},
                ),
                timeout=10,
            )
            # Successfully connected — sleep; reconnection library takes over on drop
            await asyncio.sleep(10)
        except asyncio.TimeoutError:
            logger.error("WebSocket connect timed out — retrying in 5s")
            await asyncio.sleep(5)
        except Exception as e:
            logger.error(f"WebSocket connect failed: {e} ─ retrying in 5s")
            await asyncio.sleep(5)


async def process_camera(camera: dict):
    """
    Dedicated processing loop for a single camera.
    Runs detection, tracking, intrusion, and face recognition.
    """
    camera_id = camera["id"]
    rtsp_url = camera.get("rtsp_url", "")
    # 🐦 Frigate dual-stream: use low-res stream for AI, high-res for recording
    detect_url = camera.get("detect_url") or rtsp_url
    record_url = camera.get("record_url") or rtsp_url
    sop_name = camera.get("sop_name")  # optional SOP assigned to this camera
    # 🐦 Privacy masks: normalised rectangles blacked-out before inference
    privacy_masks = camera.get("privacy_masks", [])  # list of {x, y, width, height}
    tracker = ObjectTracker()
    intrusion_detector = IntrusionDetector()
    collector = DataCollector(sop_name=sop_name or "default")
    # 🐦 Frigate Phase-3: prevents stationary objects (parked car, package)
    # from being re-detected as new events on every frame.
    stationary_classifier = StationaryMotionClassifier()
    # ── Per-camera advanced AI analyzers ──────────────────────────────────
    congestion_detector = CongestionDetector()
    speed_estimator = SpeedEstimator()
    wrongway_detector = WrongWayDetector()
    fall_detector = FallDetector()
    fight_detector = FightDetector()
    ppe_detector = PPEDetector()
    known_track_names: dict[str, str] = {}
    # Tracks whether last inference frame contained threat-class objects.
    # When True we bypass motion gating so threats are never missed.
    _last_frame_had_threat: bool = False
    # Number of frames with zero centroid movement before a track is
    # considered "stationary" and handed off to the motion classifier.
    STATIONARY_FRAMES = int(os.getenv("STATIONARY_FRAMES", "50"))
    # Weapon / threat COCO classes — also includes fight/fall which come via safety_event
    THREAT_CLASSES = frozenset([
        'knife', 'scissors', 'weapon', 'handgun', 'gun',
        'pistol', 'rifle', 'sword', 'axe', 'bat', 'baseball bat',
    ])

    # Sync zones from the camera payload received from backend
    zones = camera.get("zones", [])
    if zones:
        intrusion_detector.update_zones(zones)
        logger.info(f"Camera {camera_id}: loaded {len(zones)} intrusion zone(s)")

    # Register so live zone updates can be pushed without restarting this task
    active_intrusion_detectors[camera_id] = intrusion_detector

    logger.info(f"Starting processing for camera {camera_id} ({rtsp_url}) SOP={sop_name or 'default'}")

    # 🐦 Frigate dual-stream: detect on low-res, keep record stream separate
    stream = StreamHandler(source=detect_url if detect_url else 0)
    if record_url and record_url != detect_url:
        record_stream = StreamHandler(source=record_url)
        active_streams[f"{camera_id}:record"] = record_stream
    else:
        record_stream = None
    active_streams[camera_id] = stream
    motion = MotionDetector()   # Frigate-style: skip YOLO when nothing moves
    _motion_initialized = False  # lazy-init once first frame size is known

    try:
        stream.start()
    except Exception as e:
        logger.error(f"Camera {camera_id}: stream start failed: {e}. Using synthetic frames.")

    # Grace period: give the background read thread time to open the RTSP
    # connection before the main loop starts emitting status.  Without this,
    # the loop fires immediately and emits OFFLINE (stream not yet open).
    logger.info(f"Camera {camera_id}: waiting up to 8s for stream to come online...")
    for _ in range(16):  # 16 × 0.5s = 8s max
        if stream.is_online:
            logger.info(f"Camera {camera_id}: stream online after startup wait")
            break
        await asyncio.sleep(0.5)
    else:
        logger.warning(f"Camera {camera_id}: stream not online after 8s — will keep retrying")

    consecutive_errors = 0
    max_errors = 10
    last_status: str | None = None  # track last emitted status to avoid spamming
    status_report_interval = 5     # emit status every N seconds (5s for responsive UI)
    last_status_report = 0.0
    last_tracked_for_display: list = []  # latest detections for annotation

    loop = asyncio.get_event_loop()

    # Shared JPEG encoder — runs in executor, decoupled from detection loop
    def _encode_and_emit_frame(f, dets):
        if f is None or f.size == 0:
            return None
        import base64 as _b64
        import cv2 as _cv2e
        annotated = f.copy()

        for d in dets:
            bbox = d.get("smooth_box", d.get("box", d.get("bbox")))
            if bbox and len(bbox) == 4:
                x1, y1, x2, y2 = [int(v) for v in bbox]
                obj_type = str(d.get('object_type', '?')).lower()
                person_name = d.get('person_name') or d.get('name')
                conf = float(d.get('confidence', 0))

                is_threat = any(w in obj_type for w in ['weapon', 'gun', 'knife', 'scissors', 'fight', 'fall', 'intrusion'])

                if is_threat:
                    color = (0, 0, 255)  # Bright Red
                    thickness = 3
                    label = f"ALERT: {d.get('object_type', '?').upper()} {conf:.0%}"
                elif person_name:
                    color = (0, 255, 255)  # Bright Yellow/Cyan
                    thickness = 3
                    label = f"★ {person_name.upper()} ({conf:.0%})"
                else:
                    color = (0, 255, 80)  # Emerald Green default
                    thickness = 2
                    label = f"{d.get('object_type', '?')} {conf:.0%}"

                _cv2e.rectangle(annotated, (x1, y1), (x2, y2), color, thickness)

                # Draw high-visibility filled label banner background directly above box
                font_scale = 0.6 if person_name or is_threat else 0.5
                font_thick = 2 if person_name or is_threat else 1
                (tw, th), baseline = _cv2e.getTextSize(label, _cv2e.FONT_HERSHEY_SIMPLEX, font_scale, font_thick)
                banner_y1 = max(y1 - th - 12, 0)
                banner_y2 = max(y1, th + 12)
                _cv2e.rectangle(annotated, (x1, banner_y1), (x1 + tw + 14, banner_y2), color, -1)
                _cv2e.putText(annotated, label, (x1 + 6, banner_y2 - 6),
                              _cv2e.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), font_thick, _cv2e.LINE_AA)

        # Resize to 640px wide for high-speed encoding and 30 FPS bandwidth
        h, w = annotated.shape[:2]
        if w > 640:
            scale = 640 / w
            annotated = _cv2e.resize(annotated, (640, int(h * scale)))
        ok, buf = _cv2e.imencode('.jpg', annotated, [_cv2e.IMWRITE_JPEG_QUALITY, 50])
        if not ok:
            return None
        return _b64.b64encode(buf).decode('utf-8')

    # Dedicated 30 FPS Live Stream Publisher Task (Decoupled from AI inference latency)
    async def _stream_publisher():
        while True:
            try:
                if stream.is_online and sio.connected:
                    f = stream.get_frame()
                    if f is not None and f.size > 0:
                        _f_snap = f.copy()
                        _d_snap = list(last_tracked_for_display)
                        jpeg_b64 = await loop.run_in_executor(
                            None, _encode_and_emit_frame, _f_snap, _d_snap
                        )
                        if jpeg_b64:
                            await sio.emit("frame", {"camera_id": camera_id, "data": jpeg_b64})
                await asyncio.sleep(0.033)  # Solid 30 FPS streaming!
            except asyncio.CancelledError:
                break
            except Exception as pub_err:
                logger.error(f"Stream publisher error: {pub_err}")
                await asyncio.sleep(0.1)

    publisher_task = asyncio.create_task(_stream_publisher())

    try:
        while True:
            try:
                # ── Camera status heartbeat ──────────────────────────────────────
                now = time.monotonic()
                current_status = "ONLINE" if stream.is_online else "OFFLINE"
                if current_status != last_status or (now - last_status_report) >= status_report_interval:
                    if sio.connected:
                        await sio.emit("camera_status", {
                            "camera_id": camera_id,
                            "status": current_status,
                        })
                    last_status = current_status
                    last_status_report = now

                # ── Skip inference when stream is offline ────────────────────────
                if not stream.is_online:
                    motion.calibrating = True
                    await asyncio.sleep(1)
                    continue

                frame = stream.get_frame()

                # ── Privacy masks: black-out sensitive regions ───────────────────
                if privacy_masks:
                    import cv2 as _cv2_mask
                    fh, fw = frame.shape[:2]
                    frame = frame.copy()
                    for m in privacy_masks:
                        try:
                            mx = int(m['x'] * fw); my = int(m['y'] * fh)
                            mw = int(m['width'] * fw); mh = int(m['height'] * fh)
                            frame[my:my+mh, mx:mx+mw] = 0
                        except (KeyError, TypeError, ValueError):
                            pass

                # ── Motion gating ────────────────────────────────────────────────
                import cv2 as _cv2_motion
                gray_for_motion = _cv2_motion.cvtColor(frame, _cv2_motion.COLOR_BGR2GRAY)
                if not _motion_initialized:
                    fh_m, fw_m = gray_for_motion.shape[:2]
                    motion.__init__(frame_shape=(fh_m, fw_m))
                    _motion_initialized = True

                motion_boxes = motion.detect(gray_for_motion)
                if not motion_boxes and not _last_frame_had_threat:
                    await asyncio.sleep(0.033)
                    continue

                # ── YOLO inference at 640px ──────────────────────────────────────
                fh, fw = frame.shape[:2]
                yolo_w = 640
                yolo_h = int(fh * (yolo_w / fw))
                import cv2 as _cv2_yolo
                resized_frame = _cv2_yolo.resize(frame, (yolo_w, yolo_h))

                raw_detections = await loop.run_in_executor(
                    None, detector.detect, resized_frame
                )

                # Map boxes back to original resolution
                scale_x = fw / yolo_w
                scale_y = fh / yolo_h
                for d in raw_detections:
                    if 'box' in d:
                        x1, y1, x2, y2 = d['box']
                        d['box'] = [int(x1*scale_x), int(y1*scale_y), int(x2*scale_x), int(y2*scale_y)]

                tracked = tracker.update(raw_detections)

                # ── Stationary motion classification ─────────────────────────────
                active_track_ids: set[str] = set()
                visible_tracked: list[dict] = []
                for det in tracked:
                    tid = det.get("track_id", "")
                    active_track_ids.add(tid)
                    motionless = det.get("motionless_count", 0)
                    thresh = get_stationary_threshold(det["object_type"])

                    if thresh.motion_classifier_enabled and motionless >= STATIONARY_FRAMES:
                        _sb = det.get("smooth_box", det["box"])
                        median_box = (int(_sb[0]), int(_sb[1]), int(_sb[2]), int(_sb[3]))
                        stationary_classifier.ensure_anchor(tid, frame, median_box)
                        _rb = det["box"]
                        raw_box = (int(_rb[0]), int(_rb[1]), int(_rb[2]), int(_rb[3]))
                        if stationary_classifier.evaluate(tid, frame, raw_box):
                            continue
                        stationary_classifier.on_active(tid)

                    # Attach cached face recognition name
                    if det.get("object_type") in ["person", "face"]:
                        _tid = det.get("track_id")
                        if _tid and _tid in known_track_names:
                            det["person_name"] = known_track_names[_tid]
                        elif known_track_names:
                            det["person_name"] = list(known_track_names.values())[-1]

                    visible_tracked.append(det)

                # ── Threat detection ─────────────────────────────────────────────
                frame_threats = [d for d in visible_tracked
                                 if d.get('object_type', '').lower() in THREAT_CLASSES]
                _last_frame_had_threat = bool(frame_threats)

                stationary_classifier.cleanup(active_track_ids)

                # Training data collector (offloaded)
                await loop.run_in_executor(None, collector.record, frame, raw_detections)

                # ── Emit detections ──────────────────────────────────────────────
                if sio.connected:
                    for det in visible_tracked:
                        await sio.emit("detection", {
                            "camera_id": camera_id,
                            "object_type": det["object_type"],
                            "confidence": float(det["confidence"]),
                            "track_id": det.get("track_id"),
                            "box": det.get("smooth_box", det.get("box")),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })

                # ── Instant threat alerts ────────────────────────────────────────
                if sio.connected:
                    for threat_det in frame_threats:
                        threat_type = threat_det.get('object_type', 'weapon').upper()
                        await sio.emit("threat_alert", {
                            "camera_id": camera_id,
                            "alert_type": "WEAPON_DETECTED",
                            "object_type": threat_type,
                            "confidence": float(threat_det.get('confidence', 0)),
                            "box": threat_det.get('smooth_box', threat_det.get('box')),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "severity": "CRITICAL",
                            "message": f"⚠️ WEAPON DETECTED: {threat_type} on camera {camera_id}",
                        })
                        logger.warning(f"THREAT ALERT: {threat_type} on camera {camera_id}")

                # Trigger clip recording
                if visible_tracked and sio.connected:
                    await sio.emit("start_recording", {
                        "camera_id": camera_id,
                        "duration_sec": 30,
                        "trigger": visible_tracked[0]["object_type"],
                        "record_url": record_url,
                    })

                # ── Intrusion detection ──────────────────────────────────────────
                tracked_for_intrusion = [
                    {**d, "box": d.get("smooth_box", d.get("box"))} for d in visible_tracked
                ]
                intrusions = intrusion_detector.check(tracked_for_intrusion, frame_width=fw, frame_height=fh)
                for intr in intrusions:
                    if sio.connected:
                        await sio.emit("intrusion", {
                            "camera_id":   camera_id, "zone_id": intr.get("zone_id"),
                            "zone_name":   intr.get("zone_name"), "rule_type": intr.get("rule_type"),
                            "object_type": intr["object_type"], "confidence": float(intr.get("confidence", 0)),
                            "timestamp":   datetime.now(timezone.utc).isoformat(),
                        })

                # ── Face recognition (every 5th AI frame) ───────────────────────
                if stream.frame_count % 5 == 0:
                    faces = await loop.run_in_executor(None, face_engine.process, frame)
                    for face in faces:
                        if face.get("is_known") and face.get("person_name"):
                            p_name = face["person_name"]
                            for det in visible_tracked:
                                if det.get("object_type") in ["person", "face"]:
                                    det["person_name"] = p_name
                                    _tid2 = det.get("track_id")
                                    if _tid2:
                                        known_track_names[_tid2] = p_name
                            if face.get("bbox"):
                                visible_tracked.append({
                                    "object_type": "face", "person_name": p_name,
                                    "confidence": face.get("confidence", 0.95), "box": face["bbox"],
                                })
                        if sio.connected:
                            await sio.emit("face_event", {
                                "camera_id": camera_id, "person_id": face.get("person_id"),
                                "person_name": face.get("person_name"), "is_known": face["is_known"],
                                "confidence": float(face["confidence"]),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── Traffic congestion ───────────────────────────────────────────
                if zones and visible_tracked:
                    for evt in congestion_detector.analyze(visible_tracked, zones, fw, fh):
                        if sio.connected:
                            await sio.emit("congestion", {
                                "camera_id": camera_id, "zone_id": evt["zone_id"],
                                "zone_name": evt["zone_name"], "vehicle_count": evt["vehicle_count"],
                                "level": evt["level"], "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── Speed estimation ─────────────────────────────────────────────
                if visible_tracked:
                    for evt in speed_estimator.update(visible_tracked):
                        if sio.connected:
                            await sio.emit("speed_violation", {
                                "camera_id": camera_id, "track_id": evt["track_id"],
                                "object_type": evt["object_type"], "speed_kmh": evt["speed_kmh"],
                                "speed_mph": evt["speed_mph"], "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── Wrong-way detection ──────────────────────────────────────────
                if visible_tracked:
                    for evt in wrongway_detector.check(visible_tracked, fw, fh):
                        if sio.connected:
                            await sio.emit("wrong_way", {
                                "camera_id": camera_id, "track_id": evt["track_id"],
                                "object_type": evt["object_type"], "line_id": evt["line_id"],
                                "line_name": evt["line_name"], "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── Fall detection ───────────────────────────────────────────────
                if visible_tracked:
                    for evt in fall_detector.analyze(visible_tracked):
                        if sio.connected:
                            fp = {"camera_id": camera_id, "track_id": evt["track_id"],
                                  "event_type": "FALL_DETECTED", "confidence": float(evt.get("confidence", 0)),
                                  "timestamp": datetime.now(timezone.utc).isoformat()}
                            await sio.emit("safety_event", fp)
                            await sio.emit("threat_alert", {**fp, "object_type": "FALL_DETECTED",
                                           "alert_type": "FALL_DETECTED", "severity": "HIGH",
                                           "message": f"⚠️ PERSON FALLEN on camera {camera_id}"})
                            logger.warning(f"FALL DETECTED on camera {camera_id}")

                # ── Fight detection ──────────────────────────────────────────────
                if visible_tracked:
                    for evt in fight_detector.analyze(visible_tracked):
                        if sio.connected:
                            fgt = {"camera_id": camera_id, "track_ids": evt["track_ids"],
                                   "event_type": "FIGHT_DETECTED", "confidence": float(evt.get("confidence", 0)),
                                   "proximity_px": evt.get("proximity_px"),
                                   "timestamp": datetime.now(timezone.utc).isoformat()}
                            await sio.emit("safety_event", fgt)
                            await sio.emit("threat_alert", {**fgt, "object_type": "FIGHT_DETECTED",
                                           "alert_type": "FIGHT_DETECTED", "severity": "CRITICAL",
                                           "message": f"⚠️ FIGHT DETECTED on camera {camera_id}"})
                            logger.warning(f"FIGHT DETECTED on camera {camera_id}")

                # ── PPE compliance ───────────────────────────────────────────────
                if visible_tracked:
                    for evt in await loop.run_in_executor(None, ppe_detector.analyze, visible_tracked, frame):
                        if sio.connected:
                            await sio.emit("safety_event", {
                                "camera_id": camera_id, "track_id": evt["track_id"],
                                "event_type": "PPE_VIOLATION", "violations": evt.get("violations", []),
                                "confidence": float(evt.get("confidence", 0)),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── LPR ──────────────────────────────────────────────────────────
                if visible_tracked:
                    for evt in await loop.run_in_executor(None, lpr_engine.process, visible_tracked, frame):
                        if sio.connected:
                            await sio.emit("plate_detected", {
                                "camera_id": camera_id, "track_id": evt["track_id"],
                                "object_type": evt["object_type"], "plate_text": evt["plate_text"],
                                "plate_confidence": evt["plate_confidence"],
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── Cross-camera ReID ────────────────────────────────────────────
                if visible_tracked:
                    for evt in await loop.run_in_executor(None, reid_engine.process, visible_tracked, frame, camera_id):
                        if sio.connected:
                            await sio.emit("reid_match", {
                                "camera_id": camera_id, "track_id": evt["track_id"],
                                "global_id": evt["global_id"], "matched_camera": evt["matched_camera"],
                                "similarity": evt["similarity"], "sighting_count": evt.get("sighting_count", 0),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── CLIP frame indexing ──────────────────────────────────────────
                if stream.frame_count % 15 == 0:
                    await loop.run_in_executor(None, clip_search.index_frame, frame, camera_id, raw_detections)

                # ── Predictive forecasting ───────────────────────────────────────
                # FIXED: record_event(camera_id, object_type, count=1) has no 'confidence' kwarg
                for det in visible_tracked:
                    forecast_engine.record_event(
                        camera_id=camera_id,
                        object_type=det.get("object_type", "unknown"),
                    )

                # Update display overlay for stream publisher (shallow copy, not reference)
                last_tracked_for_display = list(visible_tracked)

                speed_estimator.cleanup(active_track_ids)
                wrongway_detector.cleanup(active_track_ids)
                fall_detector.cleanup(active_track_ids)
                lpr_engine.cleanup(active_track_ids)
                reid_engine.cleanup(active_track_ids, camera_id)

                consecutive_errors = 0
                # Yield 1ms so stream publisher + socket IO can fire between inferences
                await asyncio.sleep(0.001)

            except asyncio.CancelledError:
                logger.info(f"Camera {camera_id}: processing cancelled")
                break
            except Exception as e:
                consecutive_errors += 1
                logger.error(f"Camera {camera_id}: processing error #{consecutive_errors}: {e}")
                if consecutive_errors >= max_errors:
                    logger.critical(f"Camera {camera_id}: too many errors, pausing 30s")
                    await asyncio.sleep(30)
                    consecutive_errors = 0
                else:
                    await asyncio.sleep(1)
    finally:
        stream.stop()


async def main():
    logger.info("Starting Madad Vision AI Engine...")
    connect_task = asyncio.create_task(ensure_connected())

    try:
        # Run forever — yield control so tasks and socket events can execute
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, asyncio.CancelledError):
        # asyncio.run() converts Ctrl+C → CancelledError injected into this coroutine.
        # KeyboardInterrupt is caught here only as a safety net.
        logger.info("Shutting down AI Engine...")
    finally:
        connect_task.cancel()
        await camera_manager.shutdown_all()
        for stream in active_streams.values():
            stream.stop()
        active_intrusion_detectors.clear()
        if sio.connected:
            await sio.disconnect()
        logger.info("AI engine stopped")


_main_task: asyncio.Task | None = None

async def app(scope, receive, send):
    """
    Minimal ASGI application shim for Uvicorn compatibility.
    Runs the AI Engine's main loop as a background task.
    """
    global _main_task
    if scope["type"] == "lifespan":
        while True:
            message = await receive()
            if message["type"] == "lifespan.startup":
                # Start the engine
                _main_task = asyncio.create_task(main())
                await send({"type": "lifespan.startup.complete"})
            elif message["type"] == "lifespan.shutdown":
                # Stop the engine — use proper None check so Pyright narrows the type
                if _main_task is not None:
                    _main_task.cancel()
                    try:
                        await _main_task
                    except asyncio.CancelledError:
                        pass
                await send({"type": "lifespan.shutdown.complete"})
                return
    elif scope["type"] == "http":
        # Reject HTTP requests
        await send({
            "type": "http.response.start",
            "status": 404,
            "headers": [(b"content-type", b"text/plain")],
        })
        await send({
            "type": "http.response.body",
            "body": b"AI Engine is a WebSocket-only service.",
        })

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        # asyncio.run() itself forwards KeyboardInterrupt after cancelling the main task.
        # The finally block inside main() handles all cleanup — nothing extra needed here.
        pass
