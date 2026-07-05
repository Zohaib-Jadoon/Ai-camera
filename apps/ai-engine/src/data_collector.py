"""
Training Data Collector for Madad Vision AI Engine.

Captures frames and YOLO-format annotations during live inference so that
you can later fine-tune a custom model on your own SOP-specific scenarios
(e.g. "hardhat_required", "restricted_zone_person", "fire_hazard").

Usage:
    collector = DataCollector(sop_name="hardhat_required")
    collector.record(frame, detections)   # called inside process_camera()

    To disable collection at runtime, set COLLECT_TRAINING_DATA=false in .env
"""

import os
import cv2
import uuid
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

# Root folder for all training datasets
DATASETS_ROOT = Path(os.getenv("TRAINING_DATA_DIR", "./training_data"))

# Max frames to store per SOP before auto-rotating old ones (disk guard)
MAX_FRAMES_PER_SOP = int(os.getenv("MAX_TRAINING_FRAMES", "5000"))

COLLECT_ENABLED = os.getenv("COLLECT_TRAINING_DATA", "false").lower() == "true"


class DataCollector:
    """
    Writes raw frames + YOLO-format label files to:
        training_data/<sop_name>/images/<uuid>.jpg
        training_data/<sop_name>/labels/<uuid>.txt
        training_data/<sop_name>/meta.json  (class map, frame count, etc.)
    """

    def __init__(self, sop_name: str):
        self.sop_name = sop_name
        self.enabled = COLLECT_ENABLED
        self._frame_count = 0
        # Always initialize _meta so stats() is safe even when disabled
        self._meta: dict = {"frame_count": 0, "classes": {}, "sop": sop_name}

        if not self.enabled:
            logger.debug(f"DataCollector disabled (set COLLECT_TRAINING_DATA=true to enable)")
            return

        self.images_dir = DATASETS_ROOT / sop_name / "images"
        self.labels_dir = DATASETS_ROOT / sop_name / "labels"
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.labels_dir.mkdir(parents=True, exist_ok=True)

        self._meta_path = DATASETS_ROOT / sop_name / "meta.json"
        self._meta = self._load_meta()
        logger.info(f"DataCollector ready for SOP '{sop_name}' — {self._meta['frame_count']} frames collected so far")

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def record(self, frame, detections: list[dict]) -> None:
        """
        Save a frame + its YOLO annotations.

        detections: list of dicts from Detector.detect() — each must have:
            object_type (str), confidence (float), box ([x1,y1,x2,y2] pixels)
        """
        if not self.enabled or frame is None or not detections:
            return

        if self._meta["frame_count"] >= MAX_FRAMES_PER_SOP:
            self._rotate_oldest()

        frame_id = str(uuid.uuid4())[:8]
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        name = f"{ts}_{frame_id}"

        # Save image
        img_path = self.images_dir / f"{name}.jpg"
        cv2.imwrite(str(img_path), frame)

        # Save YOLO label file
        h, w = frame.shape[:2]
        label_lines = []
        for det in detections:
            cls_id = self._class_id(det["object_type"])
            x1, y1, x2, y2 = det["box"]
            cx = ((x1 + x2) / 2) / w
            cy = ((y1 + y2) / 2) / h
            bw = (x2 - x1) / w
            bh = (y2 - y1) / h
            label_lines.append(f"{cls_id} {cx:.6f} {cy:.6f} {bw:.6f} {bh:.6f}")

        lbl_path = self.labels_dir / f"{name}.txt"
        lbl_path.write_text("\n".join(label_lines))

        self._meta["frame_count"] += 1
        self._save_meta()

    def stats(self) -> dict:
        """Return current collection statistics."""
        return {
            "sop": self.sop_name,
            "enabled": self.enabled,
            "frame_count": self._meta.get("frame_count", 0),
            "classes": self._meta.get("classes", {}),
        }

    # ------------------------------------------------------------------ #
    #  Internals                                                           #
    # ------------------------------------------------------------------ #

    def _class_id(self, label: str) -> int:
        classes = self._meta.setdefault("classes", {})
        if label not in classes:
            classes[label] = len(classes)
            self._save_meta()
        return classes[label]

    def _load_meta(self) -> dict:
        if self._meta_path.exists():
            with open(self._meta_path) as f:
                return json.load(f)
        return {"frame_count": 0, "classes": {}, "sop": self.sop_name}

    def _save_meta(self) -> None:
        with open(self._meta_path, "w") as f:
            json.dump(self._meta, f, indent=2)

    def _rotate_oldest(self) -> None:
        """Delete the oldest 10% of frames when the cap is hit."""
        files = sorted(self.images_dir.glob("*.jpg"), key=lambda p: p.stat().st_mtime)
        to_remove = max(1, len(files) // 10)
        for img in files[:to_remove]:
            img.unlink(missing_ok=True)
            lbl = self.labels_dir / img.with_suffix(".txt").name
            lbl.unlink(missing_ok=True)
            self._meta["frame_count"] = max(0, self._meta["frame_count"] - 1)
        logger.info(f"DataCollector: rotated {to_remove} old frames for SOP '{self.sop_name}'")
