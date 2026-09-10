"""
Multi-camera processing manager for Madad Vision AI Engine.
Runs purely as an asyncio background service connected via Socket.IO.
No REST API or FastAPI; authenticates to the backend with a shared service key.
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
import threading
import concurrent.futures
from typing import Any, Callable, TypeVar, cast
from pathlib import Path
from datetime import datetime, timezone
from .detector import Detector
from .tracker import ObjectTracker
from .intrusion import IntrusionDetector
from .face_engine import FaceEngine
from .stream_handler import StreamHandler
from .privacy import apply_privacy_masks
from .data_collector import DataCollector
from .model_registry import ModelRegistry
from .camera_manager import CameraManager
from .inference_schedule import InferenceSchedule
from .background_analysis import BackgroundAnalysis
from .client_cleanup import close_client
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
AI_ENGINE_KEY = os.getenv("AI_ENGINE_KEY", "")
if os.getenv("AI_ENGINE_KEY_FILE"):
    from pathlib import Path
    AI_ENGINE_KEY = Path(os.environ["AI_ENGINE_KEY_FILE"]).read_text().strip()
if not AI_ENGINE_KEY:
    raise RuntimeError("AI_ENGINE_KEY must be configured")

# Shared infrastructure
model_registry = ModelRegistry()
detector = Detector(model_name=os.getenv("YOLO_MODEL", "yolov8s-worldv2.pt"), confidence=CONFIDENCE_THRESHOLD, enable_tracking=False)
detectors_by_path = {os.getenv("YOLO_MODEL", "yolov8s-worldv2.pt"): detector}
detector_load_lock = asyncio.Lock()
active_camera_detectors = {}


async def get_camera_detector(sop_name, camera_id=None):
    """Allocate an independent detector per camera to prevent mutex serialization across streams."""
    model_path = model_registry.resolve(sop_name)
    async with detector_load_lock:
        if camera_id and camera_id in active_camera_detectors:
            selected = active_camera_detectors[camera_id]
            if selected.is_loaded():
                return selected, model_path

        selected = await asyncio.to_thread(
            Detector, model_name=model_path, confidence=CONFIDENCE_THRESHOLD,
            enable_tracking=False,
        )
        if not selected.is_loaded():
            raise RuntimeError(f"Camera model unavailable: {model_path}")
        if camera_id:
            active_camera_detectors[camera_id] = selected
    return selected, model_path


face_engine = FaceEngine()

# ── Advanced AI modules (shared across all cameras) ─────────────────────────
lpr_engine = LPREngine()
reid_engine = ReIDEngine()
clip_search = CLIPSearchEngine()
forecast_engine = ForecastEngine()
enrichment_lock = threading.Lock()
enrichment_tracks = {}

# Dedicated thread pool for YOLO model inference (isolated from JPEG encoding & disk I/O)
inference_executor = concurrent.futures.ThreadPoolExecutor(max_workers=6, thread_name_prefix="yolo_infer")

# Dedicated thread pool for preview video encoding
stream_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="stream_enc")


def analyze_enrichment(frame, detections, camera_id, masks, timestamp, index_clip):
    """Serialize shared enrichment state, independently of the YOLO detection loop."""
    if frame is None or getattr(frame, "size", 0) == 0:
        return masks, timestamp, [], [], []

    with enrichment_lock:
        # Optimization: Only run heavy face recognition if a person was actually detected in the frame!
        has_person = any(d.get('object_type') == 'person' for d in detections) if detections else False
        if has_person:
            import cv2 as _cv2_face
            fh, fw = frame.shape[:2]
            # Downscale frame to 640px for 4x faster RetinaFace + ArcFace GPU execution
            if fw > 640:
                face_frame = _cv2_face.resize(frame, (640, int(fh * 640 / fw)))
            else:
                face_frame = frame
            faces = face_engine.process(face_frame)
        else:
            faces = []

        plates = lpr_engine.process(detections, frame) if detections else []
        identities = reid_engine.process(detections, frame, camera_id) if (detections and has_person) else []
        if index_clip:
            clip_search.index_frame(frame, camera_id, detections)
        enrichment_tracks[camera_id] = {d['track_id'] for d in detections if d.get('track_id')}
        lpr_engine.cleanup(set().union(*enrichment_tracks.values()))
        reid_engine.cleanup(enrichment_tracks[camera_id], camera_id)
        return masks, timestamp, faces, plates, identities


def cleanup_enrichment(camera_id):
    """Release per-camera enrichment caches after its native work has finished."""
    with enrichment_lock:
        enrichment_tracks.pop(camera_id, None)
        lpr_engine.cleanup(set().union(*enrichment_tracks.values()))
        reid_engine.cleanup(set(), camera_id)

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

F = TypeVar('F', bound=Callable[..., Any])

def sio_on(event: str, namespace: str | None = None) -> Callable[[F], F]:
    """Type-safe decorator wrapper for sio.on."""
    dec = sio.on(event, namespace=namespace)
    if dec is None:
        def dummy_decorator(fn: F) -> F:
            return fn
        return dummy_decorator
    return cast(Callable[[F], F], dec)

camera_manager = CameraManager()
active_streams: dict[str, StreamHandler] = {}
active_camera_configs: dict[str, dict] = {}
# Map camera_id -> IntrusionDetector so zone updates can be pushed to live tasks
active_intrusion_detectors: dict[str, "IntrusionDetector"] = {}

# Tracks whether the first sync since (re)connect has happened.
# On the first sync we wipe ALL active tasks to clear any stale IDs
# from a previous session — subsequent syncs do a normal diff.
_first_sync_after_connect = True
_heartbeat_task: asyncio.Task | None = None
_camera_sync_lock = asyncio.Lock()


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


@sio_on('sync_cameras')
async def on_sync_cameras(cameras):
    async with _camera_sync_lock:
        await _sync_cameras(cameras)


async def _sync_cameras(cameras):
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
            await camera_manager.remove_and_wait(old_id)
            if old_id in active_streams:
                await asyncio.to_thread(active_streams[old_id].stop)
                del active_streams[old_id]
            if old_id in active_intrusion_detectors:
                del active_intrusion_detectors[old_id]
            active_camera_detectors.pop(old_id, None)
        _first_sync_after_connect = False
        active_camera_configs.clear()
    else:
        # ── Subsequent syncs: diff-based add/remove ────────────────────────
        for old_id in camera_manager.ids():
            if old_id not in new_ids:
                logger.info(f"Stopping task for removed camera {old_id}")
                await camera_manager.remove_and_wait(old_id)
                if old_id in active_streams:
                    await asyncio.to_thread(active_streams[old_id].stop)
                    del active_streams[old_id]
                active_intrusion_detectors.pop(old_id, None)
                active_camera_configs.pop(old_id, None)
                active_camera_detectors.pop(old_id, None)

    # Start tasks for new cameras; restart tasks when rtsp_url changed
    for camera in cameras:
        cid = camera["id"]
        existing = camera_manager.get(cid)
        new_rtsp = camera.get("rtsp_url", "")

        old_config = dict(active_camera_configs.get(cid, {}))
        if existing and any(old_config.get(key) != camera.get(key) for key in ("rtsp_url", "detect_url", "record_url", "sop_name")):
            # URL changed — cancel old task and stream, then respawn
            logger.info(
                f"Camera {cid} stream configuration changed — restarting task"
            )
            await camera_manager.remove_and_wait(cid)
            if cid in active_streams:
                await asyncio.to_thread(active_streams[cid].stop)
                del active_streams[cid]
            active_intrusion_detectors.pop(cid, None)
            active_camera_detectors.pop(cid, None)
            existing = None  # fall through to spawn below

        active_camera_configs[cid] = dict(camera)

        if not existing:
            task = asyncio.create_task(process_camera(camera))
            camera_manager.register(cid, camera.get("name", cid), new_rtsp, task)
            logger.info(f"Spawned task for camera: {camera.get('name', cid)}")



@sio_on('sync_embeddings')
async def on_sync_embeddings(embeddings):
    await asyncio.to_thread(face_engine.load_embeddings, embeddings)


@sio_on('request_model_swap')
async def on_model_swap(data):
    """Hot-swap the active YOLO model for a given SOP.

    Payload: { "sop_name": "hardhat_required" }
    The engine will load the registered .pt file without restarting.
    """
    sop_name = data.get("sop_name") if isinstance(data, dict) else None
    try:
        selected, model_path = await get_camera_detector(sop_name)
        await asyncio.to_thread(selected.load_model, model_path)
        logger.info(f"Model hot-swapped to '{sop_name}' ({model_path})")
        if sio.connected:
            await sio.emit("model_swap_ack", {"sop_name": sop_name, "model_path": model_path, "status": "ok"})
    except Exception as e:
        logger.error(f"Model swap failed: {e}")
        if sio.connected:
            await sio.emit("model_swap_ack", {"sop_name": sop_name, "status": "error", "error": str(e)})


@sio_on('request_registry')
async def on_request_registry(_data=None):
    """Return the full model registry snapshot to the backend."""
    if sio.connected:
        await sio.emit("sync_registry", model_registry.snapshot())


@sio_on('request_models')
async def on_request_models(_data=None):
    """Return list of all registered models."""
    if sio.connected:
        await sio.emit("sync_models", model_registry.list_models())


@sio_on('extract_face')
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


@sio_on('test_stream')
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
        cap = _cv2.VideoCapture(url, _cv2.CAP_FFMPEG, [
            _cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3000,
            _cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3000,
        ])
        if not cap.isOpened():
            cap.release()
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
        ok, message, resolution, fps = False, 'Stream verification failed.', None, None

    if sio.connected:
        await sio.emit("stream_test_result", {
            "request_id": request_id,
            "ok": ok,
            "message": message,
            "resolution": resolution,
            "fps": fps,
        })
    logger.info("Stream test completed: ok=%s", ok)


@sio_on('sync_zones')
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


@sio_on('clip_search')
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


@sio_on('request_forecast')
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
                stream = active_streams.get(cam_id)
                await sio.emit('camera_status', {'camera_id': cam_id, 'status': 'ONLINE' if stream and stream.is_online else 'OFFLINE'})
        if sio.connected:
            selected_models = [m for cid in camera_manager.ids() if (m := active_camera_detectors.get(cid)) is not None] or [detector]
            object_loaded = bool(selected_models) and all(getattr(model, "is_loaded", lambda: False)() for model in selected_models)
            object_error = ('MODEL_UNAVAILABLE' if not object_loaded else
                            next((getattr(model, 'last_error', None) for model in selected_models if getattr(model, 'last_error', None)), None))
            await sio.emit('engine_health', {
                'object_detection': {'loaded': object_loaded, 'error': object_error},
                'face_recognition': {'loaded': face_engine.is_loaded(), 'error': face_engine.last_error},
            })
            if object_loaded and not object_error and os.getenv('ENGINE_HEALTH_FILE'):
                try:
                    await asyncio.to_thread(Path(os.environ['ENGINE_HEALTH_FILE']).touch)
                except OSError:
                    logger.warning('Engine health marker unavailable')
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
    sop_name = camera.get("sop_name")
    camera_detector = None
    model_path = None
    # Real-time threat detection: continuous high-speed scan across all cameras
    # Measured GPU capacity easily achieves 54+ FPS across streams.
    continuous_scan = True
    active_cam_count = max(len(camera_manager.ids()), 1)
    target_active_fps = 16.0 if active_cam_count == 1 else (14.0 if active_cam_count <= 3 else 10.0)
    idle_scan_interval = 0.08  # 12.5 FPS idle scan ensures instant sub-80ms threat registration

    schedule = InferenceSchedule(
        fps=float(os.getenv("PROCESS_FPS", str(target_active_fps))),
        idle_interval=float(os.getenv("IDLE_SCAN_INTERVAL", str(idle_scan_interval))),
        continuous=continuous_scan,
    )
    metrics_started = time.monotonic()
    metrics_count = 0
    metrics_inference_ms = 0.0
    last_auxiliary_run = float('-inf')
    last_ppe_run = float('-inf')
    last_recording_triggered = float('-inf')
    last_track_detection_emitted: dict[str, float] = {}
    last_threat_alert_time: dict[str, float] = {}
    recent_threat_boxes: dict[str, tuple[dict, float]] = {}
    enrichment = BackgroundAnalysis()
    # 🐦 Privacy masks: normalised rectangles blacked-out before inference
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
    sop_config = model_registry.get_sop_config(sop_name)
    # Tracks whether last inference frame contained threat-class objects.
    # When True we bypass motion gating so threats are never missed.
    _last_frame_had_threat: bool = False
    # Number of frames with zero centroid movement before a track is
    # considered "stationary" and handed off to the motion classifier.
    STATIONARY_FRAMES = int(os.getenv("STATIONARY_FRAMES", "50"))
    # Weapon & threat COCO/YOLO-World classes — includes weapons, fire, and blades
    THREAT_CLASSES = frozenset([
        'knife', 'scissors', 'weapon', 'handgun', 'gun',
        'pistol', 'rifle', 'firearm', 'sword', 'axe', 'bat', 'baseball bat',
        'blade', 'dagger', 'machete',
        'fire', 'flame', 'smoke', 'lighter',
    ])

    # Sync zones from the camera payload received from backend
    zones = camera.get("zones", [])
    if zones:
        intrusion_detector.update_zones(zones)
        logger.info(f"Camera {camera_id}: loaded {len(zones)} intrusion zone(s)")

    # Register so live zone updates can be pushed without restarting this task
    active_intrusion_detectors[camera_id] = intrusion_detector

    logger.info(f"Starting processing for camera {camera_id} SOP={sop_name or 'default'}")

    # 🐦 Frigate dual-stream: detect on low-res, keep record stream separate
    stream = StreamHandler(source=detect_url if detect_url else 0)
    active_streams[camera_id] = stream
    motion = MotionDetector()   # Frigate-style: skip YOLO when nothing moves
    _motion_initialized = False  # lazy-init once first frame size is known

    try:
        stream.start()
    except Exception as e:
        logger.error(f"Camera {camera_id}: stream start failed; capture unavailable")

    # The processing loop reports offline until real frames arrive.

    consecutive_errors = 0
    max_errors = 10
    last_status: str | None = None  # track last emitted status to avoid spamming
    status_report_interval = 5     # emit status every N seconds (5s for responsive UI)
    last_status_report = 0.0
    last_tracked_for_display: list = []  # latest detections for annotation
    last_detection_masks = None
    last_inference_sequence = -1

    loop = asyncio.get_event_loop()

    # Shared JPEG encoder — runs in executor, decoupled from detection loop
    def _encode_and_emit_frame(f, dets, masks):
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

                is_fire = any(w in obj_type for w in ['fire', 'flame', 'smoke', 'lighter'])
                is_weapon = any(w in obj_type for w in ['weapon', 'gun', 'knife', 'scissors', 'pistol', 'rifle', 'firearm', 'sword', 'blade', 'dagger', 'machete', 'axe', 'bat'])
                is_threat = is_fire or is_weapon or any(w in obj_type for w in ['fight', 'fall', 'intrusion'])

                if is_fire:
                    color = (0, 69, 255)  # Fiery Orange-Red (BGR)
                    thickness = 3
                    display_text = d.get('display_name') or d.get('object_type', '?').title()
                    label = f"🔥 {display_text.upper()}: {conf:.0%}"
                elif is_weapon:
                    color = (0, 0, 255)  # Bright Red
                    thickness = 3
                    label = f"⚠️ WEAPON: {d.get('object_type', '?').upper()} {conf:.0%}"
                elif is_threat:
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
                text_color = (255, 255, 255) if (is_threat or is_fire or is_weapon) else (0, 0, 0)
                _cv2e.putText(annotated, label, (x1 + 6, banner_y2 - 6),
                              _cv2e.FONT_HERSHEY_SIMPLEX, font_scale, text_color, font_thick, _cv2e.LINE_AA)

        annotated = apply_privacy_masks(annotated, masks)
        if annotated is None or getattr(annotated, "size", 0) == 0:
            return None
        # Resize to 640px wide for preview encoding.
        h, w = annotated.shape[:2]
        if w > 640:
            scale = 640 / w
            annotated = _cv2e.resize(annotated, (640, int(h * scale)))
        ok, buf = _cv2e.imencode('.jpg', annotated, [_cv2e.IMWRITE_JPEG_QUALITY, 45])
        if not ok or buf is None:
            return None
        return _b64.b64encode(buf).decode('utf-8')

    # Dedicated Live Stream Publisher Task (runs on stream_executor, decoupled from YOLO)
    async def _stream_publisher():
        last_sequence = -1
        while True:
            try:
                if stream.is_online and sio.connected:
                    f, sequence = stream.get_frame_with_sequence()
                    if f is not None and f.size > 0 and sequence != last_sequence:
                        masks = active_camera_configs.get(camera_id, camera).get("privacy_masks", [])
                        _f_snap = f
                        _d_snap = list(last_tracked_for_display) if masks == last_detection_masks else []
                        jpeg_b64 = await loop.run_in_executor(
                            stream_executor, _encode_and_emit_frame, _f_snap, _d_snap, masks
                        )
                        if jpeg_b64 and masks == active_camera_configs.get(camera_id, camera).get("privacy_masks", []):
                            await sio.emit("frame", {"camera_id": camera_id, "data": jpeg_b64})
                            last_sequence = sequence
                await asyncio.sleep(0.05)  # Fluid 20 FPS streaming (cuts encode overhead by 33%!)
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

                if camera_detector is None:
                    camera_detector, model_path = await get_camera_detector(sop_name, camera_id=camera_id)
                    active_camera_detectors[camera_id] = camera_detector
                    logger.info("Camera %s model=%s continuous_scan=%s", camera_id, model_path, continuous_scan)

                frame, sequence = stream.get_frame_with_sequence()
                if frame is None or sequence == last_inference_sequence:
                    await asyncio.sleep(0.01)
                    continue
                last_inference_sequence = sequence
                masks = active_camera_configs.get(camera_id, camera).get("privacy_masks", [])
                frame = await asyncio.to_thread(apply_privacy_masks, frame, masks)
                if frame is None or getattr(frame, "size", 0) == 0:
                    await asyncio.sleep(0.01)
                    continue

                # ── Motion gating ────────────────────────────────────────────────
                import cv2 as _cv2_motion
                gray_for_motion = _cv2_motion.cvtColor(frame, _cv2_motion.COLOR_BGR2GRAY)
                if not _motion_initialized:
                    fh_m, fw_m = gray_for_motion.shape[:2]
                    motion.__init__(frame_shape=(fh_m, fw_m))
                    _motion_initialized = True

                motion_boxes = motion.detect(gray_for_motion)
                has_human_or_hand = any(d.get('object_type') in ('person', 'hand') for d in last_tracked_for_display)
                has_active_activity = bool(motion_boxes) or _last_frame_had_threat or bool(last_tracked_for_display) or has_human_or_hand
                if not schedule.due(time.monotonic(), has_active_activity, _last_frame_had_threat):
                    await asyncio.sleep(0.005)
                    continue

                # ── YOLO inference at 640px ──────────────────────────────────────
                fh, fw = frame.shape[:2]
                yolo_w = 640
                yolo_h = int(fh * (yolo_w / fw))
                import cv2 as _cv2_yolo
                resized_frame = _cv2_yolo.resize(frame, (yolo_w, yolo_h))

                inference_started = time.monotonic()
                schedule.started(inference_started)
                raw_detections = await loop.run_in_executor(
                    inference_executor, camera_detector.detect, resized_frame
                )
                metrics_count += 1
                metrics_inference_ms += (time.monotonic() - inference_started) * 1000
                metrics_elapsed = time.monotonic() - metrics_started
                if metrics_elapsed >= 10:
                    logger.info("Camera %s model=%s inference_fps=%.2f mean_inference_ms=%.1f error=%s",
                                camera_id, model_path, metrics_count / metrics_elapsed,
                                metrics_inference_ms / metrics_count, camera_detector.last_error)
                    metrics_started = time.monotonic()
                    metrics_count = 0
                    metrics_inference_ms = 0.0
                if masks != active_camera_configs.get(camera_id, camera).get("privacy_masks", []):
                    last_tracked_for_display = []
                    continue

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

                    if det['object_type'] not in THREAT_CLASSES and det['object_type'] not in ('hand',) and not zones and thresh.motion_classifier_enabled and motionless >= STATIONARY_FRAMES:
                        _sb = det.get("smooth_box") or det.get("box")
                        if _sb and len(_sb) >= 4:
                            median_box = (int(_sb[0]), int(_sb[1]), int(_sb[2]), int(_sb[3]))
                            stationary_classifier.ensure_anchor(tid, frame, median_box)
                        _rb = det.get("box")
                        if _rb and len(_rb) >= 4:
                            raw_box = (int(_rb[0]), int(_rb[1]), int(_rb[2]), int(_rb[3]))
                            if stationary_classifier.evaluate(tid, frame, raw_box):
                                continue
                        stationary_classifier.on_active(tid)

                    visible_tracked.append(det)
                
                # ── Threat detection & persistence buffer ────────────────────────
                custom_target = (sop_config.get('target_class') or '').lower() if sop_config else ''
                frame_threats = [
                    d for d in visible_tracked
                    if d.get('object_type', '').lower() in THREAT_CLASSES or (
                        custom_target and (
                            d.get('object_type', '').lower() == custom_target or
                            custom_target in d.get('raw_label', '').lower()
                        )
                    )
                ]
                _last_frame_had_threat = bool(frame_threats)

                for td in frame_threats:
                    t_name = td.get('object_type', '').lower()
                    recent_threat_boxes[t_name] = (dict(td), now + 2.0)

                active_persistent_threats = []
                expired_threat_keys = []
                for tk, (box_det, expiry) in list(recent_threat_boxes.items()):
                    if now < expiry:
                        if not any(d.get('object_type', '').lower() == tk for d in visible_tracked):
                            active_persistent_threats.append(box_det)
                    else:
                        expired_threat_keys.append(tk)
                for tk in expired_threat_keys:
                    recent_threat_boxes.pop(tk, None)

                # Instantly update display overlay for stream publisher with zero flicker
                last_tracked_for_display = list(visible_tracked) + active_persistent_threats
                last_detection_masks = masks

                stationary_classifier.cleanup(active_track_ids)

                # Training data collector (offloaded only when enabled)
                if collector.enabled:
                    await loop.run_in_executor(None, collector.record, frame, raw_detections)

                # ── Emit detections (debounced to once every 10s per track) ──────
                if sio.connected:
                    for det in visible_tracked:
                        tid = str(det.get("track_id") or det["object_type"])
                        if (now - last_track_detection_emitted.get(tid, 0)) >= 10.0:
                            last_track_detection_emitted[tid] = now
                            await sio.emit("detection", {
                                "camera_id": camera_id,
                                "object_type": det["object_type"],
                                "confidence": float(det["confidence"]),
                                "track_id": det.get("track_id"),
                                "box": det.get("smooth_box", det.get("box")),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── Instant threat alerts (debounced to once every 2s per threat type for rapid responsiveness)
                if sio.connected:
                    for threat_det in frame_threats:
                        threat_type = threat_det.get('object_type', 'weapon').upper()
                        is_fire_threat = threat_type in ('FIRE', 'FLAME', 'SMOKE', 'LIGHTER')
                        is_weapon_threat = threat_type in ('WEAPON', 'KNIFE', 'GUN', 'BAT', 'PISTOL', 'RIFLE') or threat_det.get('object_type') == 'weapon'

                        is_custom_sop = bool(
                            sop_config and sop_config.get('sop_name') not in ('weapon_detection', 'default', None)
                            and (
                                (sop_config.get('target_class') or '').lower() in threat_det.get('object_type', '').lower()
                                or (sop_config.get('target_class') or '').lower() in threat_det.get('raw_label', '').lower()
                            )
                        )

                        if is_custom_sop and sop_config:
                            alert_type = f"{sop_config.get('sop_name', 'CUSTOM').upper()}_ALERT"
                            obj_type = (sop_config.get('target_class') or threat_det.get('object_type', 'CUSTOM')).upper()
                            alert_title = sop_config.get('alert_title') or f"⚠️ {sop_config.get('title', 'SOP').upper()} DETECTED"
                            raw_msg = sop_config.get('alert_message') or f"SOP Violation detected on camera {camera_id}"
                            msg = raw_msg.replace('{camera_id}', str(camera_id))
                            severity = sop_config.get('alert_severity', 'HIGH')
                        elif is_fire_threat:
                            alert_type = 'FIRE_DETECTED'
                            obj_type = threat_det.get('display_name') or threat_type
                            alert_title = f"🔥 {obj_type.upper()} DETECTED"
                            msg = f"🔥 FIRE DETECTED: {obj_type} on camera {camera_id}"
                            severity = 'CRITICAL'
                        else:
                            alert_type = 'WEAPON_DETECTED'
                            obj_type = 'WEAPON'
                            alert_title = '⚠️ WEAPON DETECTED'
                            msg = f"⚠️ WEAPON DETECTED on camera {camera_id}"
                            severity = 'CRITICAL'

                        threat_key = f"{camera_id}:{alert_type}:{obj_type}"
                        if (now - last_threat_alert_time.get(threat_key, 0)) >= 2.0:
                            last_threat_alert_time[threat_key] = now
                            await sio.emit("threat_alert", {
                                "camera_id": camera_id,
                                "alert_type": alert_type,
                                "alert_title": alert_title,
                                "object_type": obj_type,
                                "raw_threat": threat_det.get("raw_label", threat_type.lower()),
                                "confidence": float(threat_det.get('confidence', 0)),
                                "box": threat_det.get('smooth_box', threat_det.get('box')),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "severity": severity,
                                "message": msg,
                                "sop_name": sop_name,
                            })
                            logger.warning(f"THREAT ALERT: {obj_type} ({alert_type}) on camera {camera_id}: {msg}")

                # Trigger clip recording (debounced to at most once per 30s)
                if visible_tracked and sio.connected and (now - last_recording_triggered >= 30.0):
                    last_recording_triggered = now
                    await sio.emit("start_recording", {
                        "camera_id": camera_id,
                        "duration_sec": 30,
                        "trigger": visible_tracked[0]["object_type"],
                        "record_url": record_url,
                    })

                # ── Intrusion detection ──────────────────────────────────────────
                # Use raw instantaneous box and include keypoints/attributes so reach-in/hand intrusions alert immediately
                tracked_for_intrusion = [
                    {**d, "box": d.get("box", d.get("smooth_box"))} for d in visible_tracked
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

                # Consume completed work without awaiting a slow model. Results
                # retain source time and are dropped after privacy-mask changes.
                completed = enrichment.result()
                if completed is not None and completed[0] == active_camera_configs.get(camera_id, camera).get('privacy_masks', []) and sio.connected:
                    _, source_time, faces, plates, identities = completed
                    for face in faces:
                            await sio.emit("face_event", {
                                "camera_id": camera_id, "person_id": face.get("person_id"),
                                "person_name": face.get("person_name"), "is_known": face["is_known"],
                                "confidence": float(face["confidence"]),
                                "timestamp": source_time,
                            })
                    for evt in plates:
                        await sio.emit('plate_detected', {**evt, 'camera_id': camera_id, 'timestamp': source_time})
                    for evt in identities:
                        await sio.emit('reid_match', {**evt, 'camera_id': camera_id, 'timestamp': source_time})
                if time.monotonic() - last_auxiliary_run >= 2.5:
                    if enrichment.submit(analyze_enrichment, frame, [dict(d) for d in visible_tracked],
                                         camera_id, [dict(m) for m in masks], datetime.now(timezone.utc).isoformat(),
                                         stream.frame_count % 6 == 0):
                        last_auxiliary_run = time.monotonic()

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

                # ── PPE compliance (throttled to 1Hz) ─────────────────────────────
                if visible_tracked and (time.monotonic() - last_ppe_run >= 1.0):
                    last_ppe_run = time.monotonic()
                    for evt in await loop.run_in_executor(None, ppe_detector.analyze, visible_tracked, frame):
                        if sio.connected:
                            await sio.emit("safety_event", {
                                "camera_id": camera_id, "track_id": evt["track_id"],
                                "event_type": "PPE_VIOLATION", "violations": evt.get("violations", []),
                                "confidence": float(evt.get("confidence", 0)),
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                            })

                # ── Predictive forecasting ───────────────────────────────────────
                # FIXED: record_event(camera_id, object_type, count=1) has no 'confidence' kwarg
                for det in visible_tracked:
                    forecast_engine.record_event(
                        camera_id=camera_id,
                        object_type=det.get("object_type", "unknown"),
                    )

                speed_estimator.cleanup(active_track_ids)
                wrongway_detector.cleanup(active_track_ids)
                fall_detector.cleanup(active_track_ids)
                for tid in [k for k in last_track_detection_emitted if k not in active_track_ids]:
                    del last_track_detection_emitted[tid]

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
        publisher_task.cancel()
        await asyncio.gather(publisher_task, return_exceptions=True)
        await enrichment.close()
        await asyncio.to_thread(cleanup_enrichment, camera_id)
        await asyncio.to_thread(stream.stop)
        if active_streams.get(camera_id) is stream:
            active_streams.pop(camera_id, None)
            active_intrusion_detectors.pop(camera_id, None)
            active_camera_detectors.pop(camera_id, None)


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
        if _heartbeat_task is not None:
            _heartbeat_task.cancel()
            await asyncio.gather(_heartbeat_task, return_exceptions=True)
        await asyncio.gather(connect_task, return_exceptions=True)
        await camera_manager.shutdown_all()
        for stream in active_streams.values():
            await asyncio.to_thread(stream.stop)
        active_intrusion_detectors.clear()
        await close_client(sio)
        logger.info("AI engine stopped")


from .asgi import EngineApp

app = EngineApp(main)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        # asyncio.run() itself forwards KeyboardInterrupt after cancelling the main task.
        # The finally block inside main() handles all cleanup — nothing extra needed here.
        pass
