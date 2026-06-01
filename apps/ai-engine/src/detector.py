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
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Optional

import cv2
import numpy as np

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
    "person":       ObjectFilterConfig(min_area=1_000,  max_area=800_000,  min_ratio=0.1, max_ratio=5.0),
    # Vehicles are wide; exclude portrait-thin detections
    "car":          ObjectFilterConfig(min_area=5_000,  max_area=4_000_000, min_ratio=0.5, max_ratio=10.0),
    "truck":        ObjectFilterConfig(min_area=5_000,  max_area=6_000_000, min_ratio=0.4, max_ratio=12.0),
    "bus":          ObjectFilterConfig(min_area=8_000,  max_area=6_000_000, min_ratio=0.3, max_ratio=8.0),
    "motorcycle":   ObjectFilterConfig(min_area=2_000,  max_area=1_000_000, min_ratio=0.3, max_ratio=4.0),
    "bicycle":      ObjectFilterConfig(min_area=1_500,  max_area=800_000,  min_ratio=0.3, max_ratio=4.0),
    # Small objects — allow tiny detections but cap at full-frame
    "backpack":     ObjectFilterConfig(min_area=500,   max_area=200_000),
    "suitcase":     ObjectFilterConfig(min_area=1_000,  max_area=400_000),
    "knife":        ObjectFilterConfig(min_area=200,   max_area=100_000,  min_score=0.60),
    "scissors":     ObjectFilterConfig(min_area=200,   max_area=100_000,  min_score=0.60),
    # Animals
    "dog":          ObjectFilterConfig(min_area=800,   max_area=600_000),
    "cat":          ObjectFilterConfig(min_area=500,   max_area=300_000),
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
        cfg   = filters.get(label)
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
    logger.warning("Ultralytics not available — detector running in mock mode")


# COCO classes of interest for surveillance
SURVEILLANCE_CLASSES = {
    'person', 'car', 'motorcycle', 'bus', 'truck',
    'bicycle', 'dog', 'cat', 'bird', 'backpack',
    'suitcase', 'knife', 'scissors',
}


class Detector:
    def __init__(
        self,
        model_name: str = 'yolov8n.pt',
        confidence: float = 0.55,
        enable_tracking: bool = True,
        tracker_type: str = 'bytetrack.yaml', # or botsort.yaml
    ):
        self._loaded = False
        self.confidence = confidence
        self.enable_tracking = enable_tracking
        self.tracker_type = tracker_type
        self.model: Optional["YOLO"] = None

        if YOLO_AVAILABLE:
            try:
                logger.info(f"Loading YOLOv8 model: {model_name}")
                self.model = YOLO(model_name)
                self._loaded = True
                logger.info(f"YOLOv8 model loaded (conf threshold: {confidence})")
            except Exception as e:
                logger.error(f"YOLOv8 load failed: {e} — running in mock mode")
        else:
            logger.warning("YOLO not available — detector in mock mode")

    def is_loaded(self) -> bool:
        return self._loaded

    def load_model(self, model_name: str) -> None:
        """Hot-swap the active YOLO model. Raises on failure."""
        if not YOLO_AVAILABLE:
            raise RuntimeError("ultralytics not installed — cannot load model")
        logger.info(f"Hot-swapping YOLO model: {model_name}")
        self.model = YOLO(model_name)
        self._loaded = True
        logger.info(f"YOLO model hot-swapped to: {model_name}")

    def detect(self, frame) -> list[dict]:
        """Run detection on a frame. Returns list of detection dicts."""
        if frame is None:
            return []

        if self.model is not None:
            return self._yolo_detect(frame)
        else:
            return self._mock_detect()

    def _yolo_detect(self, frame) -> list[dict]:
        assert self.model is not None  # only called after is-not-None check in detect()
        try:
            if self.enable_tracking:
                results = self.model.track(frame, persist=True, tracker=self.tracker_type, verbose=False, conf=self.confidence)
            else:
                results = self.model(frame, verbose=False, conf=self.confidence)
                
            detections = []

            for r in results:
                boxes = r.boxes
                masks = r.masks
                keypoints = r.keypoints

                if boxes is None:
                    continue

                for i, box in enumerate(list(boxes)):  # type: ignore[arg-type]
                    cls = int(box.cls[0])
                    label = self.model.names[cls]
                    conf = float(box.conf[0])

                    if label not in SURVEILLANCE_CLASSES:
                        continue

                    x1, y1, x2, y2 = [float(v) for v in box.xyxy[0]]
                    
                    track_id = None
                    if box.id is not None:
                        track_id = int(box.id[0])

                    det = {
                        'object_type': label,
                        'confidence': round(conf, 3),
                        'box': [x1, y1, x2, y2],
                        'track_id': track_id,
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
            nms_filtered = suppress_overlapping_detections(detections)
            # ── Frigate-style per-label area/score/ratio filters ──────────
            return apply_object_filters(nms_filtered)
        except Exception as e:
            logger.error(f"YOLO inference error: {e}")
            return []

    def _mock_detect(self) -> list[dict]:
        """Synthetic detections for testing without a GPU/camera."""
        import random
        if random.random() > 0.3:
            classes = ['person', 'car', 'motorcycle']
            return [{
                'object_type': random.choice(classes),
                'confidence': round(random.uniform(0.6, 0.95), 3),
                'box': [
                    random.uniform(0, 400),
                    random.uniform(0, 300),
                    random.uniform(400, 640),
                    random.uniform(300, 480),
                ],
            }]
        return []
