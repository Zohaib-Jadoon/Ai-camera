"""
YOLOv8 Object Detector — production hardened.

Post-processing pipeline (all ported from Frigate):
  1. per-class NMSBoxes suppression  (frigate/util/object.py:reduce_detections)
     → eliminates duplicate overlapping boxes from YOLO's multi-scale heads.
  2. per-label object filters         (frigate/util/object.py:is_object_filtered)
     → drops detections outside min/max area, score, or aspect-ratio bounds.

Returns a clean detection list compatible with the CentroidTracker and intrusion engine.
"""
import logging
import threading
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

import os
import pathlib
import tempfile
import cv2
import numpy as np
from src.fire_detector import FireDetector

# Safe weights & config paths for Ultralytics & CLIP downloads
try:
    import ultralytics.utils
    _weights_dir = pathlib.Path.cwd() / '.weights'
    _weights_dir.mkdir(parents=True, exist_ok=True)
    ultralytics.utils.WEIGHTS_DIR = _weights_dir
    os.environ['ULTRALYTICS_CONFIG_DIR'] = tempfile.gettempdir()
except Exception:
    pass

if TYPE_CHECKING:
    from ultralytics import YOLO

logger = logging.getLogger(__name__)


# ── Frigate-ported NMS constants ──────────────────────────────────────────────
# Default IoU threshold for NMS across most object types
_NMS_IOU_DEFAULT = 0.45

# Some classes tolerate more overlap (e.g. overlapping license_plates / faces)
_NMS_IOU_MAP: dict[str, float] = {
    "license_plate": 0.3,
    "face": 0.3,
    "person": 0.4,
    "fire": 0.3,
    "lighter": 0.3,
    "knife": 0.3,
}


def suppress_overlapping_detections(
    detections: list[dict],
    nms_score_threshold: float = 0.5,
) -> list[dict]:
    """
    Apply per-class NMS to deduplicate overlapping detections.

    Ported from frigate/util/object.py:reduce_overlapping_detections.
    Uses cv2.dnn.NMSBoxes which is already available via OpenCV (no extra dep).

    Args:
        detections: Raw list of {'object_type', 'confidence', 'box'} dicts.
        nms_score_threshold: Minimum score to keep before NMS. Default 0.5.

    Returns:
        Filtered detection list with overlapping duplicates removed.
    """
    if not detections:
        return []

    # Group by class label
    by_class: dict[str, list[dict]] = {}
    for d in detections:
        by_class.setdefault(d['object_type'], []).append(d)

    result: list[dict] = []
    for label, group in by_class.items():
        if len(group) == 1:
            result.append(group[0])
            continue

        # NMSBoxes expects (x, y, w, h) format
        boxes_xywh = []
        confs = []
        for d in group:
            x1, y1, x2, y2 = d['box']
            boxes_xywh.append((x1, y1, x2 - x1, y2 - y1))
            confs.append(float(d['confidence']))

        iou_threshold = _NMS_IOU_MAP.get(label, _NMS_IOU_DEFAULT)
        indices = cv2.dnn.NMSBoxes(
            boxes_xywh, confs, nms_score_threshold, iou_threshold
        )

        for idx in indices:
            idx = int(idx) if not isinstance(idx, int) else idx
            result.append(group[idx])

    return result


# ── Per-label object filters (Frigate: frigate/util/object.py:is_object_filtered) ─

@dataclass
class ObjectFilterConfig:
    """Per-label post-detection filter settings.

    Any detection that fails a constraint is silently dropped before it
    reaches the tracker or intrusion engine.

    Attributes:
        min_area:    Minimum bounding-box area in pixels² (default 100).
        max_area:    Maximum bounding-box area in pixels² (default 24_000_000).
        min_score:   Minimum confidence score to keep (default 0.0).
        min_ratio:   Minimum width/height aspect ratio (default 0.0).
        max_ratio:   Maximum width/height aspect ratio (default float('inf')).
    """
    min_area:  float = 100.0
    max_area:  float = 24_000_000.0
    min_score: float = 0.0
    min_ratio: float = 0.0
    max_ratio: float = float('inf')


# Surveillance-tuned defaults per label.
# Frigate source: LABEL_NMS_MAP + per-camera object_filters config.
# These are conservative defaults — operators can override via camera config.
DEFAULT_OBJECT_FILTERS: dict[str, ObjectFilterConfig] = {
    # People must be at least a small patch; giant boxes (whole-frame) are noise
    "person":       ObjectFilterConfig(min_area=500,   max_area=1_200_000, min_ratio=0.1, max_ratio=5.0),
    # Vehicles are wide; exclude portrait-thin detections
    "car":          ObjectFilterConfig(min_area=3_000, max_area=4_000_000, min_ratio=0.4, max_ratio=10.0),
    "truck":        ObjectFilterConfig(min_area=3_000, max_area=6_000_000, min_ratio=0.3, max_ratio=12.0),
    "bus":          ObjectFilterConfig(min_area=5_000, max_area=6_000_000, min_ratio=0.3, max_ratio=8.0),
    "motorcycle":   ObjectFilterConfig(min_area=1_500, max_area=1_000_000, min_ratio=0.3, max_ratio=4.0),
    "bicycle":      ObjectFilterConfig(min_area=1_000, max_area=800_000,   min_ratio=0.3, max_ratio=4.0),
    # Baggage
    "backpack":     ObjectFilterConfig(min_area=100,   max_area=500_000),
    "suitcase":     ObjectFilterConfig(min_area=200,   max_area=500_000),
    # Small threat, weapon & fire objects — low min_score (0.15) and min_area (15px) for instant detection
    "knife":        ObjectFilterConfig(min_area=15,    max_area=400_000,  min_score=0.15),
    "blade":        ObjectFilterConfig(min_area=15,    max_area=400_000,  min_score=0.15),
    "dagger":       ObjectFilterConfig(min_area=15,    max_area=400_000,  min_score=0.15),
    "machete":      ObjectFilterConfig(min_area=25,    max_area=500_000,  min_score=0.15),
    "gun":          ObjectFilterConfig(min_area=20,    max_area=600_000,  min_score=0.15),
    "handgun":      ObjectFilterConfig(min_area=20,    max_area=600_000,  min_score=0.15),
    "pistol":       ObjectFilterConfig(min_area=20,    max_area=600_000,  min_score=0.15),
    "rifle":        ObjectFilterConfig(min_area=30,    max_area=800_000,  min_score=0.15),
    "firearm":      ObjectFilterConfig(min_area=20,    max_area=800_000,  min_score=0.15),
    "weapon":       ObjectFilterConfig(min_area=15,    max_area=1_200_000, min_score=0.15),
    "sword":        ObjectFilterConfig(min_area=30,    max_area=800_000,  min_score=0.15),
    "scissors":     ObjectFilterConfig(min_area=15,    max_area=400_000,  min_score=0.15),
    # Bat: requires realistic size (>1500px) and score (0.45) so pens/hands/lighters are NEVER mistaken for bats
    "bat":          ObjectFilterConfig(min_area=1500,  max_area=800_000,  min_score=0.45),
    "baseball bat": ObjectFilterConfig(min_area=1500,  max_area=800_000,  min_score=0.45),
    # Fire & hazard objects — sensitive area threshold so flame/lighter sparks are caught instantly
    "fire":         ObjectFilterConfig(min_area=15,    max_area=1_200_000, min_score=0.15),
    "flame":        ObjectFilterConfig(min_area=15,    max_area=1_200_000, min_score=0.15),
    "smoke":        ObjectFilterConfig(min_area=30,    max_area=1_200_000, min_score=0.15),
    "lighter":      ObjectFilterConfig(min_area=15,    max_area=300_000,  min_score=0.15),
    # Hand / limb for intrusion detection
    "hand":         ObjectFilterConfig(min_area=25,    max_area=500_000,  min_score=0.18),
    # Everyday inspection objects
    "cell phone":   ObjectFilterConfig(min_area=40,    max_area=400_000,  min_score=0.22),
    "bottle":       ObjectFilterConfig(min_area=40,    max_area=500_000,  min_score=0.25),
    "cup":          ObjectFilterConfig(min_area=30,    max_area=400_000,  min_score=0.25),
    # Animals
    "dog":          ObjectFilterConfig(min_area=500,   max_area=600_000),
    "cat":          ObjectFilterConfig(min_area=300,   max_area=300_000),
    "bird":         ObjectFilterConfig(min_area=100,   max_area=100_000),
}


def apply_object_filters(
    detections: list[dict],
    filters: dict[str, ObjectFilterConfig] | None = None,
) -> list[dict]:
    """Drop detections that violate per-label constraints.

    Ported from frigate/util/object.py:is_object_filtered.
    Runs after NMS — the final gate before detections reach the tracker.

    Args:
        detections: List of {'object_type', 'confidence', 'box'} dicts.
        filters:    Per-label ObjectFilterConfig map.
                    Defaults to DEFAULT_OBJECT_FILTERS.

    Returns:
        Filtered list (same dict shape — no mutation of surviving entries).
    """
    if not detections:
        return []
    if filters is None:
        filters = DEFAULT_OBJECT_FILTERS

    kept: list[dict] = []
    for det in detections:
        label = det.get('object_type', '')
        raw_label = det.get('raw_label', '')
        cfg = filters.get(raw_label) if raw_label in filters else filters.get(label)
        if cfg is None:
            kept.append(det)   # unknown label — pass through unfiltered
            continue

        score = det.get('confidence', 0.0)
        box   = det.get('box', [0, 0, 1, 1])
        x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])

        w = max(x2 - x1, 1.0)
        h = max(y2 - y1, 1.0)
        area   = w * h
        ratio  = w / h

        if area < cfg.min_area:
            logger.debug("Filter DROP %s: area %.0f < min %.0f", label, area, cfg.min_area)
            continue
        if area > cfg.max_area:
            logger.debug("Filter DROP %s: area %.0f > max %.0f", label, area, cfg.max_area)
            continue
        if score < cfg.min_score:
            logger.debug("Filter DROP %s: score %.3f < min %.3f", label, score, cfg.min_score)
            continue
        if ratio < cfg.min_ratio:
            logger.debug("Filter DROP %s: ratio %.2f < min %.2f", label, ratio, cfg.min_ratio)
            continue
        if ratio > cfg.max_ratio:
            logger.debug("Filter DROP %s: ratio %.2f > max %.2f", label, ratio, cfg.max_ratio)
            continue

        kept.append(det)

    dropped = len(detections) - len(kept)
    if dropped:
        logger.debug("apply_object_filters: dropped %d/%d detection(s)", dropped, len(detections))
    return kept


# Attempt to load Ultralytics; fall back gracefully
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logger.warning("Ultralytics not available — object detection unavailable")


# Open-Vocabulary descriptive prompt classes for YOLO-World
WORLD_PROMPT_CLASSES = [
    'person',
    # Threat & weapon class names
    'knife', 'pocket knife', 'kitchen knife', 'utility knife', 'box cutter', 'craft knife', 'blade', 'dagger', 'machete', 'scissors',
    'gun', 'handgun', 'black handgun', 'firearm held in hand', 'pistol', 'rifle', 'firearm', 'weapon', 'sword',
    'bat', 'baseball bat',
    # Fire & hazard classes — descriptive prompts maximize open-vocabulary activation
    'fire', 'flame', 'open flame', 'burning flame', 'lighter', 'cigarette lighter', 'flint lighter', 'smoke',
    # Human limb / hand for intrusion detection
    'hand', 'human hand', 'arm',
    # Everyday inspection objects
    'cell phone', 'smart phone', 'bottle', 'cup',
    # Common surveillance objects
    'car', 'motorcycle', 'bus', 'truck', 'bicycle',
    'dog', 'cat', 'backpack', 'suitcase',
]

# Canonicalize fine-grained prompt matches to standard classes
CANONICAL_LABEL_MAP: dict[str, str] = {
    'open flame': 'fire',
    'burning flame': 'fire',
    'flame': 'fire',
    'cigarette lighter': 'lighter',
    'flint lighter': 'lighter',
    'pocket knife': 'knife',
    'kitchen knife': 'knife',
    'utility knife': 'knife',
    'box cutter': 'knife',
    'craft knife': 'knife',
    'blade': 'knife',
    'dagger': 'knife',
    'machete': 'knife',
    'black handgun': 'gun',
    'firearm held in hand': 'gun',
    'handgun': 'gun',
    'pistol': 'gun',
    'firearm': 'gun',
    'human hand': 'hand',
    'arm': 'hand',
    'smart phone': 'cell phone',
}

SURVEILLANCE_CLASSES = set(WORLD_PROMPT_CLASSES) | set(CANONICAL_LABEL_MAP.values())

# Unified weapon categories for generalized threat reporting
WEAPON_CLASSES = frozenset([
    'knife', 'pocket knife', 'kitchen knife', 'utility knife', 'box cutter',
    'craft knife', 'blade', 'dagger', 'machete',
    'gun', 'handgun', 'black handgun', 'firearm held in hand', 'pistol', 'rifle', 'firearm', 'weapon',
    'bat', 'baseball bat', 'sword', 'axe', 'scissors',
])


def _setup_world_classes_if_needed(model, model_name: str):
    if model is not None and 'world' in model_name.lower():
        model.set_classes(WORLD_PROMPT_CLASSES)
        logger.info('YOLO-World classes configured with %d categories (including fire, weapons, knives, hands, everyday objects)', len(WORLD_PROMPT_CLASSES))


class Detector:
    def __init__(
        self,
        model_name: str = 'yolov8n.pt',
        confidence: float = 0.55,
        enable_tracking: bool = False,
        tracker_type: str = 'bytetrack.yaml', # or botsort.yaml
    ):
        self._loaded = False
        self._lock = threading.RLock()
        self.last_error = "MODEL_UNAVAILABLE"
        self.confidence = confidence
        self.enable_tracking = enable_tracking
        self.tracker_type = tracker_type
        self.model: Optional["YOLO"] = None
        self.device = os.getenv('YOLO_DEVICE', 'auto')
        self.fire_detector = FireDetector()

        if YOLO_AVAILABLE:
            try:
                logger.info(f"Loading YOLOv8 model: {model_name}")
                self.model = YOLO(model_name)
                _setup_world_classes_if_needed(self.model, model_name)
                self._configure_device(self.model)
                self._loaded = True
                self.last_error = None
                logger.info(f"YOLOv8 model loaded (conf threshold: {confidence})")
            except Exception as e:
                self.model = None
                logger.error(f"YOLOv8 load failed: {e} — object detection unavailable")
        else:
            logger.warning("YOLO not available — object detection unavailable")

    def is_loaded(self) -> bool:
        return self._loaded

    def _configure_device(self, model):
        """Select CUDA when supported; log CPU fallback instead of hiding it."""
        import torch
        requested = os.getenv('YOLO_DEVICE', 'auto')
        self.device = ('cuda:0' if torch.cuda.is_available() else 'cpu') if requested == 'auto' else requested
        model.to(self.device)
        logger.info('YOLO inference device=%s torch=%s', self.device, torch.__version__)
        if self.device == 'cpu':
            logger.warning('YOLO is running on CPU; CUDA-enabled PyTorch is required for NVIDIA acceleration')

    def load_model(self, model_name: str) -> None:
        """Hot-swap the active YOLO model. Raises on failure."""
        if not YOLO_AVAILABLE:
            raise RuntimeError("ultralytics not installed — cannot load model")
        logger.info(f"Hot-swapping YOLO model: {model_name}")
        replacement = YOLO(model_name)
        _setup_world_classes_if_needed(replacement, model_name)
        self._configure_device(replacement)
        with self._lock:
            self.model = replacement
            self._loaded = True
            self.last_error = None
        logger.info(f"YOLO model hot-swapped to: {model_name}")

    def detect(self, frame) -> list[dict]:
        """Run detection on a frame. Returns list of detection dicts."""
        if frame is None or not self._loaded:
            return []

        with self._lock:
            model = self.model
            if model is None:
                return []
            yolo_dets = self._yolo_detect(frame)

        # Detect fire, flames, and lighter fires of all sizes
        try:
            fire_dets = self.fire_detector.detect(frame)
        except Exception as e:
            logger.debug(f"Fire detection error: {e}")
            fire_dets = []

        if not fire_dets:
            return yolo_dets
        if not yolo_dets:
            return fire_dets

        # Merge fire detections into yolo detections with spatial deduplication
        combined = list(yolo_dets)
        for fd in fire_dets:
            fb = fd["box"]
            has_overlap = False
            for yd in combined:
                if yd.get("object_type") == "fire":
                    yb = yd["box"]
                    ix1 = max(fb[0], yb[0])
                    iy1 = max(fb[1], yb[1])
                    ix2 = min(fb[2], yb[2])
                    iy2 = min(fb[3], yb[3])
                    iw = max(0.0, ix2 - ix1)
                    ih = max(0.0, iy2 - iy1)
                    inter = iw * ih
                    a1 = (fb[2] - fb[0]) * (fb[3] - fb[1])
                    a2 = (yb[2] - yb[0]) * (yb[3] - yb[1])
                    union = a1 + a2 - inter
                    if union > 0 and (inter / union) >= 0.25:
                        has_overlap = True
                        if fd["confidence"] > yd.get("confidence", 0):
                            yd["confidence"] = fd["confidence"]
                            yd["box"] = fb
                            yd["display_name"] = fd["display_name"]
                            yd["raw_label"] = fd["raw_label"]
                        break
            if not has_overlap:
                combined.append(fd)

        return combined

    def _yolo_detect(self, frame, model=None) -> list[dict]:
        m = model or self.model
        assert m is not None  # only called after is-not-None check in detect()
        try:
            # Sensitive threat conf (default 0.15) ensures small knife/flame/lighter objects aren't
            # suppressed by YOLO before reaching our per-class apply_object_filters gate.
            threat_conf = float(os.getenv("THREAT_CONFIDENCE_THRESHOLD", "0.15"))
            if self.enable_tracking:
                results = m.track(frame, persist=True, tracker=self.tracker_type, verbose=False, conf=threat_conf, device=self.device)
            else:
                results = m(frame, verbose=False, conf=threat_conf, device=self.device)
                
            detections = []
            # Threat & hazard classes that use the sensitive threat_conf threshold
            THREAT_CLASSES = {
                'knife', 'blade', 'dagger', 'machete',
                'gun', 'handgun', 'pistol', 'rifle', 'firearm', 'weapon', 'sword',
                'bat', 'baseball bat',
                'fire', 'flame', 'smoke', 'lighter',
            }

            for r in results:
                boxes = r.boxes
                masks = r.masks
                keypoints = r.keypoints

                if boxes is None:
                    continue

                names = getattr(m, 'names', {}) if m is not None else {}
                for i, box in enumerate(list(boxes)):  # type: ignore[arg-type]
                    cls = int(box.cls[0])
                    raw_label = names.get(cls, str(cls)) if isinstance(names, dict) else (names[cls] if cls < len(names) else str(cls))
                    label = CANONICAL_LABEL_MAP.get(raw_label, raw_label)
                    conf = float(box.conf[0])

                    if label not in SURVEILLANCE_CLASSES and raw_label not in SURVEILLANCE_CLASSES:
                        continue

                    # For threat classes, bypass the global confidence gate —
                    # they're already pre-filtered at model level with conf=threat_conf (0.15),
                    # and apply_object_filters will enforce per-label min_score.
                    # For all other classes, apply the global threshold here.
                    is_threat_label = label in THREAT_CLASSES or raw_label in THREAT_CLASSES
                    is_sensitive_label = is_threat_label or label in ('hand', 'cell phone', 'bottle', 'cup') or raw_label in ('hand', 'human hand', 'arm')
                    if not is_sensitive_label and conf < self.confidence:
                        continue

                    x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                    
                    track_id = None
                    if box.id is not None:
                        track_id = int(box.id[0])

                    # Generalize weapon detection: knife, baseball bat, guns, etc. -> 'weapon'
                    is_weapon = label in WEAPON_CLASSES or raw_label in WEAPON_CLASSES
                    output_type = 'weapon' if is_weapon else label

                    det = {
                        'object_type': output_type,
                        'raw_label': raw_label,
                        'confidence': round(conf, 3),
                        'box': [x1, y1, x2, y2],
                        'track_id': track_id,
                        'display_name': 'Weapon Detected' if is_weapon else output_type.title(),
                    }

                    # Add Pose Estimation keypoints if model supports it (yolov8n-pose.pt)
                    if keypoints is not None and len(keypoints) > i:
                        # Extract x,y,conf for each keypoint
                        kpts = keypoints[i].data[0].cpu().numpy()
                        det['keypoints'] = kpts.tolist()

                    # Add Segmentation mask if model supports it (yolov8n-seg.pt)
                    if masks is not None and len(masks) > i:
                        # Get polygon coordinates from the mask
                        mask_segments = masks[i].xy[0]
                        det['mask'] = mask_segments.tolist()

                    detections.append(det)

            # ── Frigate-style NMS suppression ─────────────────────────────
            # YOLO has already applied NMS. A second aggressive pass discarded
            # distinct overlapping people in crowds and lower-confidence classes.
            nms_filtered = detections
            # ── Frigate-style per-label area/score/ratio filters ──────────
            filtered = apply_object_filters(nms_filtered)
            self.last_error = None
            return filtered
        except Exception as e:
            self.last_error = "INFERENCE_FAILED"
            logger.error(f"YOLO inference error: {e}")
            return []
