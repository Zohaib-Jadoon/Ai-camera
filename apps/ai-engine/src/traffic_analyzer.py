"""
Traffic Analyzer — congestion detection, speed estimation, and wrong-way detection.

Features:
  1. Congestion Detection: counts vehicles per zone, emits alert when density exceeds threshold.
  2. Speed Estimation: tracks centroid displacement between frames, converts px→m/s using
     a configurable pixels-per-meter calibration factor.
  3. Wrong-way Detection: defines directional line-crossing vectors; triggers alert when
     an object's trajectory opposes the allowed direction.
"""
import logging
import math
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# ── Vehicle classes tracked for traffic analytics ────────────────────────────
VEHICLE_CLASSES = {'car', 'truck', 'bus', 'motorcycle', 'bicycle'}


# ─────────────────────────────────────────────────────────────────────────────
# 1. Congestion Detection
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class CongestionConfig:
    """Per-zone congestion thresholds."""
    warning_count: int = 5      # vehicles in zone → WARNING
    critical_count: int = 10    # vehicles in zone → CRITICAL congestion
    cooldown_sec: float = 30.0  # minimum seconds between consecutive alerts


class CongestionDetector:
    """Counts vehicles inside each intrusion zone and fires congestion events."""

    def __init__(self, config: Optional[CongestionConfig] = None):
        self.config = config or CongestionConfig()
        # zone_id → last alert timestamp
        self._last_alert: dict[str, float] = {}

    def analyze(
        self,
        detections: list[dict],
        zones: list[dict],
        frame_width: int,
        frame_height: int,
    ) -> list[dict]:
        """
        Returns list of congestion events:
        [{ zone_id, zone_name, vehicle_count, level: 'WARNING'|'CRITICAL' }]
        """
        import cv2
        if not zones or not detections:
            return []

        events: list[dict] = []
        now = time.time()

        for zone in zones:
            zone_id = zone.get("id", "")
            zone_name = zone.get("name", zone_id)
            points = zone.get("polygon_points", [])
            if not points or len(points) < 3:
                continue

            # Scale normalised polygon to pixel space
            import numpy as np
            polygon = np.array(
                [[int(p[0] * frame_width), int(p[1] * frame_height)] for p in points],
                dtype=np.int32,
            )

            # Count vehicles whose centroid falls inside the polygon
            count = 0
            for det in detections:
                if det.get("object_type") not in VEHICLE_CLASSES:
                    continue
                box = det.get("box") or det.get("smooth_box")
                if not box or len(box) != 4:
                    continue
                cx = (box[0] + box[2]) / 2
                cy = (box[1] + box[3]) / 2
                if cv2.pointPolygonTest(polygon, (cx, cy), False) >= 0:
                    count += 1

            if count < self.config.warning_count:
                continue

            # Cooldown check
            last = self._last_alert.get(zone_id, 0)
            if (now - last) < self.config.cooldown_sec:
                continue

            level = "CRITICAL" if count >= self.config.critical_count else "WARNING"
            events.append({
                "zone_id": zone_id,
                "zone_name": zone_name,
                "vehicle_count": count,
                "level": level,
            })
            self._last_alert[zone_id] = now
            logger.info(
                "Congestion %s in zone %s: %d vehicles", level, zone_name, count
            )

        return events


# ─────────────────────────────────────────────────────────────────────────────
# 2. Speed Estimation
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SpeedConfig:
    """Calibration parameters for speed estimation."""
    pixels_per_meter: float = 30.0   # camera-specific; must be calibrated
    speed_limit_kmh: float = 50.0    # threshold for over-speed alert
    min_frames: int = 5              # minimum track history before estimating


class SpeedEstimator:
    """Estimates object speed from centroid displacement across frames."""

    def __init__(self, config: Optional[SpeedConfig] = None, fps: float = 25.0):
        self.config = config or SpeedConfig()
        self.fps = fps
        # track_id → list of (cx, cy, timestamp)
        self._history: dict[str, list[tuple[float, float, float]]] = {}
        self._max_history = 30  # sliding window

    def update(self, detections: list[dict]) -> list[dict]:
        """
        Call once per frame with tracked detections.
        Returns list of speed events for objects exceeding the speed limit:
        [{ track_id, object_type, speed_kmh, speed_mph }]
        """
        events: list[dict] = []
        now = time.time()

        for det in detections:
            tid = det.get("track_id")
            if tid is None:
                continue
            tid = str(tid)
            box = det.get("smooth_box") or det.get("box")
            if not box or len(box) != 4:
                continue

            cx = (box[0] + box[2]) / 2
            cy = (box[1] + box[3]) / 2

            history = self._history.setdefault(tid, [])
            history.append((cx, cy, now))
            if len(history) > self._max_history:
                history.pop(0)

            if len(history) < self.config.min_frames:
                continue

            # Calculate speed from oldest to newest point
            x0, y0, t0 = history[0]
            x1, y1, t1 = history[-1]
            dt = t1 - t0
            if dt <= 0:
                continue

            px_dist = math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2)
            meters = px_dist / self.config.pixels_per_meter
            speed_ms = meters / dt
            speed_kmh = speed_ms * 3.6
            speed_mph = speed_kmh * 0.621371

            det["speed_kmh"] = round(speed_kmh, 1)
            det["speed_mph"] = round(speed_mph, 1)

            if speed_kmh > self.config.speed_limit_kmh:
                events.append({
                    "track_id": tid,
                    "object_type": det.get("object_type", "unknown"),
                    "speed_kmh": round(speed_kmh, 1),
                    "speed_mph": round(speed_mph, 1),
                    "confidence": det.get("confidence", 0),
                })

        return events

    def cleanup(self, active_ids: set[str]) -> None:
        """Remove history for tracks no longer active."""
        stale = [k for k in self._history if k not in active_ids]
        for k in stale:
            del self._history[k]


# ─────────────────────────────────────────────────────────────────────────────
# 3. Wrong-way / Directional Line-crossing Detection
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class LineCrossConfig:
    """A directional line defined by two endpoints and an allowed direction vector."""
    line_id: str = ""
    name: str = ""
    # Line endpoints (normalised 0–1)
    x1: float = 0.0
    y1: float = 0.5
    x2: float = 1.0
    y2: float = 0.5
    # Allowed direction unit-vector (objects crossing against this → wrong-way)
    allowed_dx: float = 0.0
    allowed_dy: float = 1.0   # default: allowed direction is top-to-bottom


class WrongWayDetector:
    """Detects objects crossing a line in the wrong direction."""

    def __init__(self):
        self._lines: list[LineCrossConfig] = []
        # track_id → last side (-1 or +1) relative to each line
        self._sides: dict[str, dict[str, int]] = {}
        # track_id → centroid history for direction vector
        self._prev_pos: dict[str, tuple[float, float]] = {}
        # Cooldown: track_id:line_id → last alert timestamp
        self._last_alert: dict[str, float] = {}
        self._cooldown = 10.0  # seconds

    def update_lines(self, lines: list[dict]) -> None:
        """Load/refresh directional lines from backend config."""
        self._lines = []
        for l in lines:
            self._lines.append(LineCrossConfig(
                line_id=l.get("id", ""),
                name=l.get("name", ""),
                x1=l.get("x1", 0), y1=l.get("y1", 0.5),
                x2=l.get("x2", 1), y2=l.get("y2", 0.5),
                allowed_dx=l.get("allowed_dx", 0),
                allowed_dy=l.get("allowed_dy", 1),
            ))
        logger.info("WrongWayDetector: loaded %d directional line(s)", len(self._lines))

    def _side_of_line(self, px: float, py: float, lx1: float, ly1: float, lx2: float, ly2: float) -> int:
        """Returns +1 or -1 depending on which side of the line the point is."""
        cross = (lx2 - lx1) * (py - ly1) - (ly2 - ly1) * (px - lx1)
        return 1 if cross >= 0 else -1

    def check(
        self,
        detections: list[dict],
        frame_width: int,
        frame_height: int,
    ) -> list[dict]:
        """
        Returns wrong-way events:
        [{ track_id, object_type, line_id, line_name, direction }]
        """
        if not self._lines:
            return []

        events: list[dict] = []
        now = time.time()

        for det in detections:
            tid = det.get("track_id")
            if tid is None:
                continue
            tid = str(tid)
            box = det.get("smooth_box") or det.get("box")
            if not box or len(box) != 4:
                continue

            cx = (box[0] + box[2]) / 2 / frame_width   # normalise to 0–1
            cy = (box[1] + box[3]) / 2 / frame_height

            prev = self._prev_pos.get(tid)
            self._prev_pos[tid] = (cx, cy)
            if prev is None:
                continue

            # Direction vector of movement
            dx = cx - prev[0]
            dy = cy - prev[1]
            if abs(dx) < 1e-6 and abs(dy) < 1e-6:
                continue  # no movement

            for line in self._lines:
                side_now = self._side_of_line(cx, cy, line.x1, line.y1, line.x2, line.y2)
                sides = self._sides.setdefault(tid, {})
                prev_side = sides.get(line.line_id)
                sides[line.line_id] = side_now

                if prev_side is None or prev_side == side_now:
                    continue  # hasn't crossed

                # Object crossed the line — check if direction is wrong
                dot = dx * line.allowed_dx + dy * line.allowed_dy
                if dot >= 0:
                    continue  # correct direction

                key = f"{tid}:{line.line_id}"
                if (now - self._last_alert.get(key, 0)) < self._cooldown:
                    continue

                self._last_alert[key] = now
                events.append({
                    "track_id": tid,
                    "object_type": det.get("object_type", "unknown"),
                    "line_id": line.line_id,
                    "line_name": line.name,
                    "direction": "WRONG_WAY",
                })
                logger.warning(
                    "Wrong-way detected: track %s crossed %s against allowed direction",
                    tid, line.name,
                )

        return events

    def cleanup(self, active_ids: set[str]) -> None:
        stale = [k for k in self._sides if k not in active_ids]
        for k in stale:
            del self._sides[k]
            self._prev_pos.pop(k, None)
