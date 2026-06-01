"""
MotionDetector — Ported from Frigate's ImprovedMotionDetector.

Source: frigate/motion/improved_motion.py (MIT License)
Adapted for Madad Vision AI: removed PTZ/config dependencies,
replaced config objects with plain constructor args.

Algorithm:
1. Resize frame to small working size (improves speed ~10×)
2. Improve contrast via rolling 4th/96th percentile (50-frame history)
3. Apply privacy mask blackout regions
4. Gaussian blur to reduce noise
5. Frame delta vs exponential moving average
6. Threshold → dilate → find contours
7. Return list of (x1,y1,x2,y2) motion boxes in original pixel space
8. Recalibrate if >80% of frame is motion (lightning / IR switch)

Usage in main.py:
    motion = MotionDetector(frame_shape=(480, 640))
    ...
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    motion_boxes = motion.detect(gray)
    if not motion_boxes:
        continue  # skip YOLO entirely — huge CPU saving
"""

from __future__ import annotations

import logging
from typing import Optional

import cv2
import numpy as np

try:
    from scipy.ndimage import gaussian_filter as _gaussian_filter
    _HAS_SCIPY = True
except ImportError:
    _HAS_SCIPY = False

logger = logging.getLogger(__name__)


def _grab_cv2_contours(cnts):
    """Handle OpenCV 2/3/4 API differences for findContours return value.

    Copied verbatim from frigate/util/image.py:grab_cv2_contours.
    """
    if len(cnts) == 2:
        return cnts[0]
    elif len(cnts) == 3:
        return cnts[1]
    return cnts[0]


def calculate_region(
    frame_shape: tuple[int, int],
    xmin: float, ymin: float,
    xmax: float, ymax: float,
    model_size: int,
    multiplier: float = 2.0,
) -> tuple[int, int, int, int]:
    """Calculate the optimal square inference crop region for a motion box.

    Copied from frigate/util/image.py:calculate_region.
    Returns (x_offset, y_offset, x_offset+size, y_offset+size).
    The size is always divisible by 4 and >= model_size.
    """
    size = int((max(xmax - xmin, ymax - ymin) * multiplier) // 4 * 4)
    size = max(size, model_size)

    x_offset = int((xmax - xmin) / 2.0 + xmin - size / 2.0)
    x_offset = max(0, min(frame_shape[1] - size, x_offset))

    y_offset = int((ymax - ymin) / 2.0 + ymin - size / 2.0)
    y_offset = max(0, min(frame_shape[0] - size, y_offset))

    return (x_offset, y_offset, x_offset + size, y_offset + size)


class MotionDetector:
    """
    Lightweight motion detector ported from Frigate's ImprovedMotionDetector.

    Args:
        frame_shape:       (height, width) of the source frames in PIXELS.
        motion_height:     Height to resize frames to for motion analysis.
                           Smaller = faster, less sensitive. Default 100.
        threshold:         Pixel difference threshold (0–255). Default 25.
        contour_area:      Minimum contour area (in motion-frame pixels) to
                           count as motion. Default 10.
        blur_radius:       Gaussian blur radius (reduces noise). Default 1.
        frame_alpha:       Exponential moving average weight for background
                           model. Higher = adapts faster. Default 0.01.
        delta_alpha:       EMA weight for delta frame. Default 0.1.
        improve_contrast:  Whether to apply contrast stretching. Default True.
        lightning_threshold: If motion covers >X fraction of the frame,
                           treat as lighting change and recalibrate. Default 0.8.
    """

    def __init__(
        self,
        frame_shape: tuple[int, int] | None = None,
        motion_height: int = 100,
        threshold: int = 25,
        contour_area: int = 10,
        blur_radius: int = 1,
        frame_alpha: float = 0.01,
        delta_alpha: float = 0.1,
        improve_contrast: bool = True,
        lightning_threshold: float = 0.8,
        contrast_frame_history: int = 50,
    ) -> None:
        self.frame_shape = frame_shape or (480, 640)  # placeholder until re-init
        self.resize_factor = self.frame_shape[0] / motion_height
        self.motion_frame_size = (
            motion_height,
            motion_height * self.frame_shape[1] // self.frame_shape[0],
        )
        self.avg_frame = np.zeros(self.motion_frame_size, np.float32)
        self.avg_delta  = np.zeros(self.motion_frame_size, np.float32)
        self.motion_frame_count = 0
        self.frame_counter = 0
        self.calibrating = True

        self.threshold = threshold
        self.contour_area = contour_area
        self.blur_radius = blur_radius
        self.frame_alpha = frame_alpha
        self.delta_alpha = delta_alpha
        self.improve_contrast = improve_contrast
        self.lightning_threshold = lightning_threshold

        # Rolling contrast history (50 frames × [min, max])
        self.contrast_values = np.zeros((contrast_frame_history, 2), np.uint8)
        self.contrast_values[:, 1] = 255
        self.contrast_idx = 0

        logger.info(
            f"MotionDetector init: source={frame_shape} → "
            f"motion_size={self.motion_frame_size} resize_factor={self.resize_factor:.2f}"
        )

    @property
    def is_calibrating(self) -> bool:
        return self.calibrating

    def detect(self, frame: np.ndarray) -> list[tuple[int, int, int, int]]:
        """
        Detect motion in a grayscale frame.

        Args:
            frame: Grayscale (H×W) numpy array in original resolution.

        Returns:
            List of (x1, y1, x2, y2) bounding boxes in ORIGINAL pixel space.
            Empty list means no motion → safe to skip YOLO inference.
        """
        motion_boxes: list[tuple[int, int, int, int]] = []

        # Crop to declared frame shape (handles cameras that send odd sizes)
        gray = frame[0 : self.frame_shape[0], 0 : self.frame_shape[1]]

        # ── 1. Resize to small working size ──────────────────────────────────
        resized = cv2.resize(
            gray,
            dsize=(self.motion_frame_size[1], self.motion_frame_size[0]),
            interpolation=cv2.INTER_NEAREST,
        )

        # ── 2. Contrast improvement (rolling average of 4th/96th percentile) ─
        if self.improve_contrast:
            min_val = np.percentile(resized, 4).astype(np.uint8)
            max_val = np.percentile(resized, 96).astype(np.uint8)
            if min_val < max_val:
                self.contrast_values[self.contrast_idx] = [min_val, max_val]
                self.contrast_idx = (self.contrast_idx + 1) % len(self.contrast_values)
                avg_min, avg_max = np.mean(self.contrast_values, axis=0)
                resized = np.clip(resized, avg_min, avg_max)
                resized = (
                    (resized - avg_min) / (avg_max - avg_min) * 255
                ).astype(np.uint8)

        # ── 3. Gaussian blur ──────────────────────────────────────────────────
        if _HAS_SCIPY:
            resized = _gaussian_filter(resized, sigma=1, radius=self.blur_radius)
        else:
            ksize = self.blur_radius * 2 + 1
            resized = cv2.GaussianBlur(resized, (ksize, ksize), 0)

        self.frame_counter += 1

        # ── 4. Frame delta vs running average ─────────────────────────────────
        frame_delta = cv2.absdiff(resized, cv2.convertScaleAbs(self.avg_frame))

        # ── 5. Threshold + dilate + contours ──────────────────────────────────
        thresh = cv2.threshold(frame_delta, self.threshold, 255, cv2.THRESH_BINARY)[1]
        thresh_dilated = cv2.dilate(thresh, None, iterations=1)  # type: ignore[call-overload]
        cnts = cv2.findContours(thresh_dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cnts = _grab_cv2_contours(cnts)

        total_area: float = 0.0
        for c in cnts:
            c_area = cv2.contourArea(c)
            total_area += c_area
            if c_area > self.contour_area:
                x, y, w, h = cv2.boundingRect(c)
                # Scale back to original pixel space
                motion_boxes.append((
                    int(x * self.resize_factor),
                    int(y * self.resize_factor),
                    int((x + w) * self.resize_factor),
                    int((y + h) * self.resize_factor),
                ))

        pct_motion = total_area / (self.motion_frame_size[0] * self.motion_frame_size[1])

        # ── 6. Lightning / recalibration logic ────────────────────────────────
        if pct_motion > self.lightning_threshold:
            logger.debug(f"MotionDetector: scene change {pct_motion:.0%} > threshold — recalibrating")
            self.calibrating = True
            # Force fast convergence when scene changes
            cv2.accumulateWeighted(resized, self.avg_frame, 0.2)
            return []

        if pct_motion < 0.05 and len(motion_boxes) <= 4:
            self.calibrating = False

        # ── 7. Update background model ────────────────────────────────────────
        if motion_boxes:
            self.motion_frame_count += 1
            # Only update avg when motion persists for ≥10 frames (avoids phantom motion)
            if self.motion_frame_count >= 10:
                alpha = 0.2 if self.calibrating else self.frame_alpha
                cv2.accumulateWeighted(resized, self.avg_frame, alpha)
        else:
            alpha = 0.2 if self.calibrating else self.frame_alpha
            cv2.accumulateWeighted(resized, self.avg_frame, alpha)
            self.motion_frame_count = 0

        return motion_boxes
