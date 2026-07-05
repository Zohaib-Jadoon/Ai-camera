"""
License Plate Recognition (LPR) Engine.

Uses EasyOCR to extract text from license plate regions detected by YOLO.
Falls back gracefully when EasyOCR is not installed.

Pipeline:
  1. For each vehicle detection, crop the lower portion of the bounding box
     (where the plate typically is).
  2. Preprocess the crop (grayscale, contrast enhancement, threshold).
  3. Run EasyOCR to extract text.
  4. Filter results by confidence and character pattern.
"""
import logging
import re
import time
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

# Attempt to load EasyOCR
try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    logger.warning("EasyOCR not installed — LPR running in disabled mode. pip install easyocr")

VEHICLE_CLASSES = {'car', 'truck', 'bus', 'motorcycle'}

# Common license plate patterns (can be extended per country)
# Matches alphanumeric strings of 4-10 characters
PLATE_PATTERN = re.compile(r'^[A-Z0-9\-\s]{3,12}$', re.IGNORECASE)


@dataclass
class LPRConfig:
    """Configuration for license plate recognition."""
    # Which languages to try (EasyOCR language codes)
    languages: list[str] = None  # type: ignore
    # Minimum OCR confidence to accept a plate reading
    min_confidence: float = 0.4
    # Crop region: bottom portion of vehicle bounding box (0.5 = bottom 50%)
    plate_crop_ratio: float = 0.4
    # Cooldown per track_id before re-reading the same plate
    cooldown_sec: float = 10.0
    # Process every Nth frame (LPR is expensive)
    frame_skip: int = 10

    def __post_init__(self):
        if self.languages is None:
            self.languages = ['en']


class LPREngine:
    """Extracts license plate text from vehicle detections."""

    def __init__(self, config: Optional[LPRConfig] = None):
        self.config = config or LPRConfig()
        self._reader = None
        self._loaded = False
        self._frame_counter = 0
        # track_id → { plate_text, confidence, last_seen }
        self._plate_cache: dict[str, dict] = {}
        self._last_alert: dict[str, float] = {}

        if EASYOCR_AVAILABLE:
            try:
                logger.info("Loading EasyOCR reader for LPR...")
                self._reader = easyocr.Reader(
                    self.config.languages,
                    gpu=False,  # CPU by default; set True if GPU available
                    verbose=False,
                )
                self._loaded = True
                logger.info("EasyOCR reader loaded for LPR")
            except Exception as e:
                logger.error(f"EasyOCR load failed: {e}")

    def is_loaded(self) -> bool:
        return self._loaded

    def process(self, detections: list[dict], frame) -> list[dict]:
        """
        Extract license plates from vehicle detections.
        Returns: [{ track_id, object_type, plate_text, plate_confidence }]
        """
        if not self._loaded or frame is None:
            return []

        self._frame_counter += 1
        if self._frame_counter % self.config.frame_skip != 0:
            return []

        import cv2
        import numpy as np

        events: list[dict] = []
        now = time.time()
        fh, fw = frame.shape[:2]

        for det in detections:
            if det.get("object_type") not in VEHICLE_CLASSES:
                continue
            tid = str(det.get("track_id", ""))
            if not tid:
                continue

            # Cooldown per track
            if (now - self._last_alert.get(tid, 0)) < self.config.cooldown_sec:
                # Return cached plate if available
                cached = self._plate_cache.get(tid)
                if cached:
                    continue
                continue

            box = det.get("smooth_box") or det.get("box")
            if not box or len(box) != 4:
                continue

            x1, y1, x2, y2 = [int(v) for v in box]
            # Crop bottom portion of vehicle (where plate is)
            plate_y1 = int(y1 + (y2 - y1) * (1 - self.config.plate_crop_ratio))
            plate_region = frame[max(0, plate_y1):min(fh, y2), max(0, x1):min(fw, x2)]

            if plate_region.size == 0:
                continue

            # Preprocess for OCR
            gray = cv2.cvtColor(plate_region, cv2.COLOR_BGR2GRAY)
            # CLAHE contrast enhancement
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            # Slight blur to reduce noise
            enhanced = cv2.GaussianBlur(enhanced, (3, 3), 0)

            try:
                results = self._reader.readtext(enhanced)  # type: ignore
            except Exception as e:
                logger.debug(f"OCR error for track {tid}: {e}")
                continue

            # Find best plate match
            best_text = ""
            best_conf = 0.0
            for (bbox_pts, text, conf) in results:
                text = text.strip().upper().replace(" ", "")
                if conf < self.config.min_confidence:
                    continue
                if not PLATE_PATTERN.match(text):
                    continue
                if conf > best_conf:
                    best_text = text
                    best_conf = conf

            if best_text:
                self._plate_cache[tid] = {
                    "plate_text": best_text,
                    "confidence": round(best_conf, 3),
                }
                self._last_alert[tid] = now
                events.append({
                    "track_id": tid,
                    "object_type": det.get("object_type", "car"),
                    "plate_text": best_text,
                    "plate_confidence": round(best_conf, 3),
                    "confidence": det.get("confidence", 0),
                })
                logger.info("LPR: track %s → plate '%s' (%.0f%%)", tid, best_text, best_conf * 100)

        return events

    def get_cached_plate(self, track_id: str) -> Optional[str]:
        """Return cached plate text for a track, if available."""
        cached = self._plate_cache.get(str(track_id))
        return cached["plate_text"] if cached else None

    def cleanup(self, active_ids: set[str]) -> None:
        stale = [k for k in self._plate_cache if k not in active_ids]
        for k in stale:
            del self._plate_cache[k]
            self._last_alert.pop(k, None)
