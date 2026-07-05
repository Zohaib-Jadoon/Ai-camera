"""
StationaryMotionClassifier — Ported from Frigate's track/stationary_classifier.py.

Source: frigate/track/stationary_classifier.py (MIT License)
Adapted for Madad Vision AI:
  - Removed YUV shared-memory frame access (Frigate's FrameManager).
    We receive standard BGR frames, so this port extracts the Y-channel
    via cv2.cvtColor instead of reading the YUV plane directly.
  - Removed Peewee DB / config dependencies.
  - Retained the full NCC + phase-correlation + cumulative-drift logic.

Purpose
-------
Prevents a stationary object (parked car, unattended bag, package) from
repeatedly being treated as a *new* detection every frame.

Algorithm
---------
1.  When a track first becomes "stationary" (motionless_count crosses a
    threshold), the caller calls `ensure_anchor(track_id, bgr_frame, box)`.
    This captures a 96×96 Y-channel crop from the *median* bounding box
    as the appearance anchor.

2.  Each subsequent frame, `evaluate(track_id, bgr_frame, current_box)`:
    a. Re-crops the same *anchor spatial region* from the new frame.
    b. Computes NCC (Normalized Cross-Correlation via cv2.matchTemplate).
    c. Computes phase-correlation shift (sub-pixel motion estimate).
    d. Accumulates drift over a 5-frame rolling window.
    e. Returns True  → keep stationary (suppress re-detection).
       Returns False → object has moved, flip to active.

3.  When a track is re-classified as active, call `on_active(track_id)`
    to reset the anchor so it can be re-set when the object stops again.

Per-label thresholds
--------------------
Different object types have different sensitivity presets:

  STATIONARY_OBJECT  (package, waste_bin …) — very sensitive,
                     motion_classifier always enabled
  DYNAMIC_OBJECT     (car, motorcycle …)    — looser active_iou
  NON_STATIONARY     (license_plate)        — stricter, shorter history

Usage in tracker.py / main.py
------------------------------
    from .stationary_classifier import StationaryMotionClassifier, get_stationary_threshold

    classifier = StationaryMotionClassifier()

    # When motionless_count crosses your threshold:
    if track.motionless_count == STATIONARY_THRESHOLD:
        thresh = get_stationary_threshold(track.object_type)
        if thresh.motion_classifier_enabled:
            median_box = tuple(map(int, track.smooth_box))
            classifier.ensure_anchor(track.track_id, bgr_frame, median_box)

    # Every frame for stationary tracks:
    if track.motionless_count > STATIONARY_THRESHOLD:
        thresh = get_stationary_threshold(track.object_type)
        if thresh.motion_classifier_enabled:
            keep = classifier.evaluate(track.track_id, bgr_frame, track.box)
            if not keep:
                classifier.on_active(track.track_id)
                track.motionless_count = 0  # re-activate
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import cv2
import numpy as np

try:
    from scipy.ndimage import gaussian_filter as _gaussian_filter
    _HAS_SCIPY = True
except ImportError:
    _HAS_SCIPY = False

logger = logging.getLogger(__name__)


# ── Per-label threshold presets (ported from Frigate) ──────────────────────

@dataclass
class StationaryThresholds:
    """IoU thresholds and history parameters for stationary classification.

    Allows different sensitivity for different object types.
    Ported from frigate/track/stationary_classifier.py:StationaryThresholds.
    """

    objects: list[str] = field(default_factory=list)

    # Below this IoU → immediately treat as active (known to be moving)
    known_active_iou: float = 0.2

    # If mean+median IoU drops below this, stationary object has moved
    stationary_check_iou: float = 0.6

    # Higher = harder for object to become stationary (used for vehicles)
    active_check_iou: float = 0.9

    # Number of historical boxes to keep per track
    max_stationary_history: int = 10

    # Whether the motion classifier runs for this label
    motion_classifier_enabled: bool = False


# Packages, waste bins, BBQ grills — should stay put; very motion-sensitive
_STATIONARY_OBJECT_THRESHOLDS = StationaryThresholds(
    objects=["package", "waste_bin", "suitcase", "backpack"],
    known_active_iou=0.0,
    motion_classifier_enabled=True,
)

# Vehicles — can park for long periods; looser active threshold
_DYNAMIC_OBJECT_THRESHOLDS = StationaryThresholds(
    objects=["car", "motorcycle", "bicycle", "bus", "truck"],
    active_check_iou=0.75,
    motion_classifier_enabled=True,
)

# License plates — almost never stationary; very strict thresholds
_NON_STATIONARY_OBJECT_THRESHOLDS = StationaryThresholds(
    objects=["license_plate"],
    known_active_iou=0.9,
    stationary_check_iou=0.9,
    max_stationary_history=4,
)


def get_stationary_threshold(label: str) -> StationaryThresholds:
    """Return the StationaryThresholds preset for a given object label."""
    if label in _STATIONARY_OBJECT_THRESHOLDS.objects:
        return _STATIONARY_OBJECT_THRESHOLDS
    if label in _DYNAMIC_OBJECT_THRESHOLDS.objects:
        return _DYNAMIC_OBJECT_THRESHOLDS
    if label in _NON_STATIONARY_OBJECT_THRESHOLDS.objects:
        return _NON_STATIONARY_OBJECT_THRESHOLDS
    return StationaryThresholds()


# ── StationaryMotionClassifier ──────────────────────────────────────────────

class StationaryMotionClassifier:
    """
    Appearance-based motion classifier for stationary objects.

    Ported from frigate/track/stationary_classifier.py:StationaryMotionClassifier.

    Key difference from Frigate: we work with standard BGR frames and
    convert to grayscale Y-channel internally rather than reading a
    pre-allocated YUV plane from shared memory.
    """

    # Crop size in pixels (Frigate: 96×96)
    CROP_SIZE: int = 96

    # NCC ≥ 0.90 AND shift < 0.02  → early-exit stationary keep
    NCC_KEEP_THRESHOLD:    float = 0.90
    SHIFT_KEEP_THRESHOLD:  float = 0.02

    # NCC < 0.85 OR shift ≥ 0.04  → movement detected
    NCC_ACTIVE_THRESHOLD:   float = 0.85
    SHIFT_ACTIVE_THRESHOLD: float = 0.04

    # Cumulative drift (sum of 5 shifts) ≥ 0.12 → flip active
    DRIFT_ACTIVE_THRESHOLD: float = 0.12

    # Require N consecutive "movement detected" frames before flipping
    CHANGED_FRAMES_TO_FLIP: int = 2

    def __init__(self) -> None:
        self._anchor_crops:  dict[str, np.ndarray]             = {}
        self._anchor_boxes:  dict[str, tuple[int, int, int, int]] = {}
        self._changed_counts: dict[str, int]                   = {}
        self._shift_histories: dict[str, list[float]]          = {}

        # Pre-compute 2-D Hanning window for phase correlation windowing
        hann_1d = np.hanning(self.CROP_SIZE).astype(np.float64)
        self._hann2d: np.ndarray = np.outer(hann_1d, hann_1d)

    # ── Public API ────────────────────────────────────────────────────────

    def ensure_anchor(
        self,
        track_id: str,
        bgr_frame: np.ndarray,
        median_box: tuple[int, int, int, int],
    ) -> None:
        """Capture the anchor crop when a track first becomes stationary.

        Call once when `motionless_count` crosses your stationary threshold.
        Subsequent calls for the same track_id are no-ops until `on_active()`
        resets the state.

        Args:
            track_id:   Unique string track identifier.
            bgr_frame:  Current BGR frame (H×W×3 uint8).
            median_box: Stable (15th/85th percentile) bounding box in pixels
                        as (x1, y1, x2, y2).
        """
        if track_id not in self._anchor_crops:
            self._anchor_boxes[track_id] = median_box
            self._anchor_crops[track_id] = self._extract_y_crop(bgr_frame, median_box)
            self._changed_counts[track_id] = 0
            self._shift_histories[track_id] = []
            logger.debug(
                "StationaryClassifier: anchor set for track %s box=%s",
                track_id, median_box,
            )

    def evaluate(
        self,
        track_id: str,
        bgr_frame: np.ndarray,
        current_box: tuple[int, int, int, int],
    ) -> bool:
        """Decide whether to keep the track stationary or flip it to active.

        Call every frame for stationary tracks (after `ensure_anchor`).

        Returns:
            True  → keep stationary (suppress re-detection / alert).
            False → genuine movement detected, caller should re-activate track.
        """
        if track_id not in self._anchor_crops:
            return True  # no anchor yet — default to keep

        anchor_box  = self._anchor_boxes[track_id]
        anchor_crop = self._anchor_crops[track_id]

        # Re-crop the *same spatial region* from the current frame
        curr_crop = self._extract_y_crop(bgr_frame, anchor_box)

        # ── Appearance metric: NCC (Normalised Cross-Correlation) ─────────
        # Returns scalar in [-1, 1]. Near 1 = identical appearance.
        ncc = float(
            cv2.matchTemplate(
                curr_crop.astype(np.float32),
                anchor_crop.astype(np.float32),
                cv2.TM_CCOEFF_NORMED,
            )[0, 0]
        )

        # ── Motion metric: phase-correlation sub-pixel shift ──────────────
        a64 = anchor_crop.astype(np.float64) * self._hann2d
        c64 = curr_crop.astype(np.float64) * self._hann2d
        (shift_x, shift_y), _ = cv2.phaseCorrelate(a64, c64)
        shift_norm = float(np.hypot(shift_x, shift_y)) / float(self.CROP_SIZE)

        # ── Update rolling drift history (5-frame window) ─────────────────
        history = self._shift_histories.get(track_id, [])
        history.append(shift_norm)
        if len(history) > 5:
            history = history[-5:]
        self._shift_histories[track_id] = history
        drift_sum = sum(history)

        logger.debug(
            "StationaryClassifier: track=%s ncc=%.4f shift=%.4f drift=%.4f",
            track_id, ncc, shift_norm, drift_sum,
        )

        # ── Early-exit: clearly stationary ───────────────────────────────
        if ncc >= self.NCC_KEEP_THRESHOLD and shift_norm < self.SHIFT_KEEP_THRESHOLD:
            self._changed_counts[track_id] = 0
            return True

        # ── Movement check ────────────────────────────────────────────────
        movement_detected = (
            ncc < self.NCC_ACTIVE_THRESHOLD
            or shift_norm >= self.SHIFT_ACTIVE_THRESHOLD
            or drift_sum >= self.DRIFT_ACTIVE_THRESHOLD
        )

        if movement_detected:
            cnt = self._changed_counts.get(track_id, 0) + 1
            self._changed_counts[track_id] = cnt
            if (
                cnt >= self.CHANGED_FRAMES_TO_FLIP
                or drift_sum >= self.DRIFT_ACTIVE_THRESHOLD
            ):
                logger.debug(
                    "StationaryClassifier: track=%s → ACTIVE (cnt=%d drift=%.4f)",
                    track_id, cnt, drift_sum,
                )
                return False  # flip to active
        else:
            self._changed_counts[track_id] = 0

        return True  # keep stationary

    def on_active(self, track_id: str) -> None:
        """Reset classifier state when a track is re-classified as active.

        Allows the anchor to be re-set the next time the track stops.
        """
        logger.debug("StationaryClassifier: track=%s became active — reset", track_id)
        self._reset(track_id)

    def cleanup(self, active_track_ids: set[str]) -> None:
        """Remove state for tracks that no longer exist.

        Call periodically (e.g. after tracker.update()) to prevent memory leaks.
        """
        stale = set(self._anchor_crops.keys()) - active_track_ids
        for tid in stale:
            self._reset(tid)
        if stale:
            logger.debug("StationaryClassifier: cleaned up %d stale track(s)", len(stale))

    # ── Private helpers ───────────────────────────────────────────────────

    def _reset(self, track_id: str) -> None:
        self._anchor_crops.pop(track_id, None)
        self._anchor_boxes.pop(track_id, None)
        self._changed_counts.pop(track_id, None)
        self._shift_histories.pop(track_id, None)

    def _extract_y_crop(
        self,
        bgr_frame: np.ndarray,
        box: tuple[int, int, int, int],
    ) -> np.ndarray:
        """Extract a 96×96 Y-channel (luma) crop from box in BGR frame.

        Frigate reads the Y-plane directly from a YUV shared-memory buffer.
        Here we convert BGR→YUV and take the Y plane, which is equivalent
        and avoids needing a pre-converted frame in the caller.
        """
        fh, fw = bgr_frame.shape[:2]
        x1 = max(0, min(fw - 1, box[0]))
        y1 = max(0, min(fh - 1, box[1]))
        x2 = max(x1 + 1, min(fw, box[2]))
        y2 = max(y1 + 1, min(fh, box[3]))

        roi = bgr_frame[y1:y2, x1:x2]
        # Convert to YUV; Y is channel 0
        yuv_roi = cv2.cvtColor(roi, cv2.COLOR_BGR2YUV)
        y_channel = yuv_roi[:, :, 0]

        # Resize to fixed CROP_SIZE for consistent NCC / phase-correlate
        resized = cv2.resize(
            y_channel,
            (self.CROP_SIZE, self.CROP_SIZE),
            interpolation=cv2.INTER_AREA,
        )

        # Light Gaussian smoothing to suppress sensor noise (same as Frigate σ=0.5)
        if _HAS_SCIPY:
            resized = _gaussian_filter(resized.astype(np.float32), sigma=0.5)
        else:
            resized = cv2.GaussianBlur(resized, (3, 3), 0.5)

        return resized.astype(np.uint8) if resized.dtype != np.uint8 else resized
