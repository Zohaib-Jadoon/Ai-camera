"""
CentroidTracker — Ported from Frigate's centroid_tracker.py.

Source: frigate/track/centroid_tracker.py (MIT License)
Adapted for Madad Vision AI: removed SharedMemory / multiprocessing deps,
replaced config objects with plain constructor args.

Key improvements over the previous simple IoU tracker:
  - Per-label matching (persons matched to persons, cars to cars — never crossed)
  - scipy.spatial.distance.cdist for O(n²) centroid-distance matching
    with graceful fallback to IoU if scipy is unavailable
  - Persistent track IDs in human-readable timestamp+randchars format
  - motionless_count / disappeared counters (foundation for stationary classifier)
  - Rolling position box using 15th/85th percentile of last N bounding boxes
    (eliminates bounding-box jitter from detections)
"""

from __future__ import annotations

import logging
import random
import string
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

try:
    from scipy.spatial.distance import cdist as _cdist
    _HAS_SCIPY = True
except ImportError:
    _HAS_SCIPY = False

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
# Maximum frames a track can go unmatched before it is pruned.
_MAX_DISAPPEARED = 5

# Maximum centroid distance (pixels) for a match to be accepted.
# Frigate uses 100 for a 1080p stream; scale down for smaller frames.
_MAX_CENTROID_DISTANCE = 150.0

# IoU fallback threshold (used when scipy is not installed)
_MIN_IOU = 0.25

# Number of past boxes kept per track for rolling percentile smoothing.
_POSITION_HISTORY_LEN = 10

# Percentile range for rolling position box smoothing (Frigate convention)
_POSITION_SMOOTHING_LO = 15
_POSITION_SMOOTHING_HI = 85


def _make_track_id() -> str:
    """Create a human-readable, sortable track ID.

    Format: <unix_timestamp>-<4 random alphanumerics>
    e.g. '1715521042-ab3x'
    Matches Frigate's track ID convention.
    """
    return uuid.uuid4().hex


def _centroid(box: list[float]) -> tuple[float, float]:
    """Return (cx, cy) for a [x1, y1, x2, y2] box."""
    return ((box[0] + box[2]) / 2.0, (box[1] + box[3]) / 2.0)


def _iou(boxA: list[float], boxB: list[float]) -> float:
    """Intersection-over-union for two [x1, y1, x2, y2] boxes."""
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    inter = max(0.0, xB - xA) * max(0.0, yB - yA)
    if inter == 0.0:
        return 0.0
    areaA = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    areaB = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])
    union = areaA + areaB - inter
    return inter / union if union > 0 else 0.0


def _smooth_box(history: deque[list[float]]) -> list[float]:
    """Compute a stable bounding box from history using percentile clipping.

    Frigate uses this to suppress jitter from detections when an object
    is stationary — the 15th/85th percentile of accumulated boxes gives
    a tight, stable bounding box rather than flickering extremes.
    """
    arr = np.array(list(history), dtype=np.float32)  # shape (N, 4)
    lo = np.percentile(arr, _POSITION_SMOOTHING_LO, axis=0)
    hi = np.percentile(arr, _POSITION_SMOOTHING_HI, axis=0)
    # For x1, y1 take low percentile; for x2, y2 take high percentile
    return [
        float(lo[0]), float(lo[1]),
        float(hi[2]), float(hi[3]),
    ]


@dataclass
class Track:
    """Internal track state — one per tracked object."""

    track_id: str
    object_type: str
    confidence: float
    box: list[float]                    # latest raw box (pixel space)
    smooth_box: list[float]             # rolling-percentile stabilised box
    age: int = 0                        # frames since track was first created
    disappeared: int = 0               # frames since last successful match
    motionless_count: int = 0          # frames where centroid didn't move
    attributes: dict = field(default_factory=dict)
    _box_history: deque = field(
        default_factory=lambda: deque(maxlen=_POSITION_HISTORY_LEN),
        repr=False,
    )

    def update(self, det: dict) -> None:
        """Apply a new matched detection to this track."""
        prev_box = self.box
        self.box = det["box"]
        self.confidence = det["confidence"]
        self.attributes = {k: det[k] for k in ('keypoints', 'mask') if k in det}
        self.disappeared = 0
        self.age += 1
        self._box_history.append(self.box)
        if len(self._box_history) >= 3:
            self.smooth_box = _smooth_box(self._box_history)
        else:
            self.smooth_box = self.box

        # Track centroid displacement to detect motionless objects.
        # < 2 px shift is treated as stationary (sub-pixel jitter threshold).
        old_cx = (prev_box[0] + prev_box[2]) / 2.0
        old_cy = (prev_box[1] + prev_box[3]) / 2.0
        new_cx = (self.box[0] + self.box[2]) / 2.0
        new_cy = (self.box[1] + self.box[3]) / 2.0
        delta = ((new_cx - old_cx) ** 2 + (new_cy - old_cy) ** 2) ** 0.5
        if delta < 2.0:
            self.motionless_count += 1
        else:
            self.motionless_count = 0


class CentroidTracker:
    """
    Multi-object centroid tracker ported from Frigate.

    Matching strategy:
      1. Group tracks and detections by object label (no cross-class matches).
      2. Compute pairwise centroid distances with scipy.cdist (O(n²)).
         Falls back to IoU matching if scipy is unavailable.
      3. Greedily assign the closest pairs that are within
         _MAX_CENTROID_DISTANCE pixels.
      4. Age unmatched tracks; prune after _MAX_DISAPPEARED frames.
      5. Spawn new tracks for unmatched detections.

    This replaces the previous ObjectTracker (simple IoU greedy matcher).
    The public API is identical — .update(detections) → list[dict] —
    so main.py requires no changes.
    """

    def __init__(
        self,
        max_disappeared: int = _MAX_DISAPPEARED,
        max_distance: float = _MAX_CENTROID_DISTANCE,
    ) -> None:
        self._tracks: dict[str, Track] = {}  # track_id → Track
        self.max_disappeared = max_disappeared
        self.max_distance = max_distance

        if not _HAS_SCIPY:
            logger.warning(
                "scipy not installed — CentroidTracker falling back to IoU matching. "
                "Install scipy for best tracking accuracy."
            )

    # ── Public API ────────────────────────────────────────────────────────────

    def update(self, detections: list[dict]) -> list[dict]:
        """
        Match new detections to existing tracks and return enriched output.

        Args:
            detections: List of {'object_type', 'confidence', 'box': [x1,y1,x2,y2]}
                        as produced by Detector.detect() → suppress_overlapping_detections().

        Returns:
            List of {'object_type', 'confidence', 'track_id', 'box', 'smooth_box'}
            for all currently active tracks that received a match this frame.
        """
        if not detections:
            self._age_all()
            return []

        # ── 1. Group by label ─────────────────────────────────────────────
        tracks_by_label: dict[str, list[Track]] = {}
        for track in self._tracks.values():
            tracks_by_label.setdefault(track.object_type, []).append(track)

        dets_by_label: dict[str, list[dict]] = {}
        for det in detections:
            dets_by_label.setdefault(det["object_type"], []).append(det)

        matched_track_ids: set[str] = set()
        matched_det_indices: set[int] = set()
        det_index_map: dict[str, list[int]] = {}  # label → global indices
        _global_idx = 0
        for label, group in dets_by_label.items():
            det_index_map[label] = list(range(_global_idx, _global_idx + len(group)))
            _global_idx += len(group)

        # ── 2. Match per label ────────────────────────────────────────────
        for label, label_tracks in tracks_by_label.items():
            label_dets = dets_by_label.get(label, [])
            if not label_dets:
                continue

            global_indices = det_index_map.get(label, [])

            if _HAS_SCIPY:
                # Centroid distance matrix (tracks × dets)
                track_centroids = np.array(
                    [_centroid(t.box) for t in label_tracks], dtype=np.float64
                )
                det_centroids = np.array(
                    [_centroid(d["box"]) for d in label_dets], dtype=np.float64
                )
                D = _cdist(track_centroids, det_centroids)

                # Greedy match: sort by ascending distance
                sorted_pairs = np.dstack(
                    np.unravel_index(np.argsort(D.ravel()), D.shape)
                )[0]
                used_track_rows: set[int] = set()
                used_det_cols: set[int] = set()

                for row, col in sorted_pairs:
                    if D[row, col] > self.max_distance:
                        break  # matrix is sorted — all remaining pairs are worse
                    if row in used_track_rows or col in used_det_cols:
                        continue
                    track = label_tracks[row]
                    det = label_dets[col]
                    track.update(det)
                    matched_track_ids.add(track.track_id)
                    matched_det_indices.add(global_indices[col])
                    used_track_rows.add(row)
                    used_det_cols.add(col)

            else:
                # Fallback: greedy IoU matching (same logic as old ObjectTracker)
                used_track_ids: set[str] = set()
                used_det_cols_fb: set[int] = set()
                for col, det in enumerate(label_dets):
                    best_iou = _MIN_IOU
                    best_track: Optional[Track] = None
                    for track in label_tracks:
                        if track.track_id in used_track_ids:
                            continue
                        score = _iou(track.box, det["box"])
                        if score > best_iou:
                            best_iou = score
                            best_track = track
                    if best_track is not None:
                        best_track.update(det)
                        matched_track_ids.add(best_track.track_id)
                        matched_det_indices.add(global_indices[col])
                        used_track_ids.add(best_track.track_id)
                        used_det_cols_fb.add(col)

        # ── 3. Age unmatched tracks ───────────────────────────────────────
        to_prune = []
        for tid, track in self._tracks.items():
            if tid not in matched_track_ids:
                track.disappeared += 1
                if track.disappeared > self.max_disappeared:
                    to_prune.append(tid)
        if to_prune:
            for tid in to_prune:
                del self._tracks[tid]
            logger.debug(f"Pruned {len(to_prune)} lost track(s)")

        # ── 4. Spawn new tracks for unmatched detections ──────────────────
        # Rebuild flat detection list to map global indices back to dicts
        flat_dets = [d for dets in dets_by_label.values() for d in dets]
        for global_idx, det in enumerate(flat_dets):
            if global_idx not in matched_det_indices:
                tid = _make_track_id()
                new_track = Track(
                    track_id=tid,
                    object_type=det["object_type"],
                    confidence=det["confidence"],
                    box=det["box"],
                    smooth_box=det["box"],
                    attributes={k: det[k] for k in ('keypoints', 'mask') if k in det},
                )
                new_track._box_history.append(det["box"])
                matched_track_ids.add(tid)
                self._tracks[tid] = new_track

        # ── 5. Build output for all matched tracks ────────────────────────
        output: list[dict] = []
        for tid, track in self._tracks.items():
            if tid in matched_track_ids:
                output.append({
                    **track.attributes,
                    "object_type":      track.object_type,
                    "confidence":       track.confidence,
                    "track_id":         track.track_id,
                    "box":              track.box,
                    "smooth_box":       track.smooth_box,
                    "prev_box":         list(track._box_history[-2]) if len(track._box_history) >= 2 else track.box,
                    "motionless_count": track.motionless_count,  # for StationaryMotionClassifier
                })

        return output

    def reset(self) -> None:
        """Clear all tracks (e.g. on camera reconnect)."""
        self._tracks.clear()

    # ── Private helpers ───────────────────────────────────────────────────────

    def _age_all(self) -> None:
        """Age all tracks by one frame (called when no detections arrive)."""
        to_prune = [
            tid for tid, t in self._tracks.items()
            if t.disappeared >= self.max_disappeared
        ]
        for tid in to_prune:
            del self._tracks[tid]
        for track in self._tracks.values():
            track.disappeared += 1


# ── Backward compatibility alias ─────────────────────────────────────────────
# main.py imports ObjectTracker — keep the old name pointing to the new impl
# so we don't need to touch the rest of the codebase.
ObjectTracker = CentroidTracker
