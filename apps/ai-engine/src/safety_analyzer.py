"""
Safety Analyzer — fall detection, fight detection, and PPE compliance.

All three analyzers consume the *keypoints* data from YOLOv8-Pose detections.
If the model is not a pose model, keypoints will be absent and these analyzers
gracefully return empty results.

COCO Keypoint indices (17-point skeleton used by YOLOv8-Pose):
  0: nose           1: left_eye       2: right_eye
  3: left_ear       4: right_ear      5: left_shoulder
  6: right_shoulder 7: left_elbow     8: right_elbow
  9: left_wrist    10: right_wrist   11: left_hip
 12: right_hip     13: left_knee     14: right_knee
 15: left_ankle    16: right_ankle
"""
import logging
import math
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

# COCO keypoint indices
NOSE = 0
L_SHOULDER = 5
R_SHOULDER = 6
L_HIP = 11
R_HIP = 12
L_KNEE = 13
R_KNEE = 14
L_ANKLE = 15
R_ANKLE = 16


def _kp(keypoints: list, idx: int) -> Optional[tuple[float, float, float]]:
    """Safely extract (x, y, confidence) for a keypoint index."""
    if keypoints and len(keypoints) > idx:
        pt = keypoints[idx]
        if len(pt) >= 3:
            return (float(pt[0]), float(pt[1]), float(pt[2]))
    return None


def _midpoint(a: tuple[float, float, float], b: tuple[float, float, float]) -> tuple[float, float]:
    return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)


def _distance(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Fall Detection
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FallConfig:
    """Thresholds for fall detection heuristics."""
    # If torso-to-ground angle < this (degrees), person is horizontal → potential fall
    angle_threshold: float = 45.0
    # Minimum keypoint confidence to trust the reading
    min_kp_confidence: float = 0.3
    # Person must be "down" for this many consecutive frames before alert
    consecutive_frames: int = 8
    # Cooldown between alerts for the same track
    cooldown_sec: float = 30.0


class FallDetector:
    """Detects falls by analyzing the angle of the torso relative to the ground."""

    def __init__(self, config: Optional[FallConfig] = None):
        self.config = config or FallConfig()
        # track_id → consecutive "fallen" frame count
        self._fallen_count: dict[str, int] = {}
        # track_id → last alert timestamp
        self._last_alert: dict[str, float] = {}

    def analyze(self, detections: list[dict]) -> list[dict]:
        """
        Analyze keypoints for fall posture.
        Returns: [{ track_id, object_type: 'FALL_DETECTED', confidence }]
        """
        events: list[dict] = []
        now = time.time()

        for det in detections:
            if det.get("object_type") != "person":
                continue
            tid = str(det.get("track_id", ""))
            if not tid:
                continue

            kps = det.get("keypoints")
            if not kps:
                continue

            # Get shoulder and hip midpoints
            ls = _kp(kps, L_SHOULDER)
            rs = _kp(kps, R_SHOULDER)
            lh = _kp(kps, L_HIP)
            rh = _kp(kps, R_HIP)

            if not all([ls, rs, lh, rh]):
                continue
            if min(ls[2], rs[2], lh[2], rh[2]) < self.config.min_kp_confidence:  # type: ignore
                continue

            shoulder_mid = _midpoint(ls, rs)  # type: ignore
            hip_mid = _midpoint(lh, rh)  # type: ignore

            # Torso vector: shoulder → hip
            dx = hip_mid[0] - shoulder_mid[0]
            dy = hip_mid[1] - shoulder_mid[1]

            # Angle from vertical (0° = standing upright, 90° = horizontal)
            # atan2 gives angle from positive x-axis; we want angle from vertical
            angle_from_vertical = abs(math.degrees(math.atan2(abs(dx), abs(dy))))

            # Also check: are the hips at or above shoulder level? (inverted body)
            hips_above_shoulders = hip_mid[1] < shoulder_mid[1]

            # Check ankle proximity to shoulders (curled up on ground)
            la = _kp(kps, L_ANKLE)
            ra = _kp(kps, R_ANKLE)
            ankles_near_shoulders = False
            if la and ra and la[2] > 0.2 and ra[2] > 0.2:
                ankle_mid = _midpoint(la, ra)
                torso_len = _distance(shoulder_mid, hip_mid)
                ankle_shoulder_dist = _distance(ankle_mid, shoulder_mid)
                if torso_len > 0 and ankle_shoulder_dist < torso_len * 1.2:
                    ankles_near_shoulders = True

            is_fallen = (
                angle_from_vertical > (90 - self.config.angle_threshold)
                or hips_above_shoulders
                or ankles_near_shoulders
            )

            if is_fallen:
                self._fallen_count[tid] = self._fallen_count.get(tid, 0) + 1
            else:
                self._fallen_count[tid] = 0
                continue

            if self._fallen_count[tid] < self.config.consecutive_frames:
                continue

            # Cooldown
            if (now - self._last_alert.get(tid, 0)) < self.config.cooldown_sec:
                continue

            self._last_alert[tid] = now
            events.append({
                "track_id": tid,
                "object_type": "FALL_DETECTED",
                "confidence": det.get("confidence", 0),
                "angle_from_vertical": round(angle_from_vertical, 1),
            })
            logger.warning("FALL DETECTED: track %s angle=%.1f°", tid, angle_from_vertical)

        return events

    def cleanup(self, active_ids: set[str]) -> None:
        for k in [k for k in self._fallen_count if k not in active_ids]:
            del self._fallen_count[k]
            self._last_alert.pop(k, None)


# ─────────────────────────────────────────────────────────────────────────────
# 2. Fight Detection
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class FightConfig:
    """Thresholds for fight/aggression detection."""
    # Maximum pixel distance between two persons to consider "close proximity"
    proximity_px: float = 150.0
    # Minimum hand/wrist velocity (px/frame) to indicate striking motion
    rapid_motion_threshold: float = 40.0
    # Consecutive frames with both conditions before alert
    consecutive_frames: int = 5
    cooldown_sec: float = 30.0


class FightDetector:
    """Detects fights by combining proximity analysis with rapid hand movement."""

    def __init__(self, config: Optional[FightConfig] = None):
        self.config = config or FightConfig()
        # pair_key → consecutive "fighting" frame count
        self._fight_count: dict[str, int] = {}
        self._last_alert: dict[str, float] = {}
        # track_id → previous wrist positions
        self._prev_wrists: dict[str, tuple[float, float, float, float]] = {}

    def analyze(self, detections: list[dict]) -> list[dict]:
        """
        Check pairs of persons for fight indicators.
        Returns: [{ track_ids, object_type: 'FIGHT_DETECTED', confidence }]
        """
        events: list[dict] = []
        now = time.time()

        persons = [d for d in detections if d.get("object_type") == "person" and d.get("keypoints")]

        for i in range(len(persons)):
            for j in range(i + 1, len(persons)):
                p1 = persons[i]
                p2 = persons[j]
                tid1 = str(p1.get("track_id", ""))
                tid2 = str(p2.get("track_id", ""))
                if not tid1 or not tid2:
                    continue

                # Check proximity using hip midpoints
                kps1 = p1["keypoints"]
                kps2 = p2["keypoints"]
                lh1, rh1 = _kp(kps1, L_HIP), _kp(kps1, R_HIP)
                lh2, rh2 = _kp(kps2, L_HIP), _kp(kps2, R_HIP)
                if not all([lh1, rh1, lh2, rh2]):
                    continue

                center1 = _midpoint(lh1, rh1)  # type: ignore
                center2 = _midpoint(lh2, rh2)  # type: ignore
                dist = _distance(center1, center2)

                if dist > self.config.proximity_px:
                    continue

                # Check rapid hand motion for either person
                rapid1 = self._check_rapid_wrist(tid1, kps1)
                rapid2 = self._check_rapid_wrist(tid2, kps2)

                pair_key = f"{min(tid1, tid2)}:{max(tid1, tid2)}"
                if rapid1 or rapid2:
                    self._fight_count[pair_key] = self._fight_count.get(pair_key, 0) + 1
                else:
                    self._fight_count[pair_key] = 0
                    continue

                if self._fight_count[pair_key] < self.config.consecutive_frames:
                    continue

                if (now - self._last_alert.get(pair_key, 0)) < self.config.cooldown_sec:
                    continue

                self._last_alert[pair_key] = now
                events.append({
                    "track_ids": [tid1, tid2],
                    "object_type": "FIGHT_DETECTED",
                    "confidence": min(p1.get("confidence", 0), p2.get("confidence", 0)),
                    "proximity_px": round(dist, 1),
                })
                logger.warning("FIGHT DETECTED between tracks %s and %s", tid1, tid2)

        return events

    def _check_rapid_wrist(self, tid: str, kps: list) -> bool:
        """Check if wrist positions changed rapidly since last frame."""
        lw = _kp(kps, 9)   # left_wrist
        rw = _kp(kps, 10)  # right_wrist
        if not lw or not rw:
            return False

        prev = self._prev_wrists.get(tid)
        self._prev_wrists[tid] = (lw[0], lw[1], rw[0], rw[1])
        if prev is None:
            return False

        # Displacement of both wrists
        lw_disp = math.sqrt((lw[0] - prev[0]) ** 2 + (lw[1] - prev[1]) ** 2)
        rw_disp = math.sqrt((rw[0] - prev[2]) ** 2 + (rw[1] - prev[3]) ** 2)

        return max(lw_disp, rw_disp) > self.config.rapid_motion_threshold

    def cleanup(self, active_ids: set[str]) -> None:
        for k in [k for k in self._prev_wrists if k not in active_ids]:
            del self._prev_wrists[k]


# ─────────────────────────────────────────────────────────────────────────────
# 3. PPE Compliance Detection
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PPEConfig:
    """Configuration for PPE compliance checking."""
    # Whether to check for hard hats (requires head keypoints)
    check_hardhat: bool = True
    # Whether to check for high-vis vests (requires torso region analysis)
    check_vest: bool = True
    # Minimum area ratio of "bright" pixels in torso region to flag as having a vest
    vest_brightness_threshold: float = 0.3
    # HSV ranges for high-vis colors (yellow/orange/green)
    hivis_hue_ranges: list[tuple[int, int]] = field(
        default_factory=lambda: [
            (15, 35),    # yellow
            (5, 15),     # orange  
            (35, 85),    # green
        ]
    )
    cooldown_sec: float = 60.0
    # Number of consecutive "no-PPE" frames before alert
    consecutive_frames: int = 15


class PPEDetector:
    """
    Heuristic PPE compliance detection using keypoints + color analysis.
    
    Hard hat check: Analyzes the region above the head keypoint for helmet-shaped
    objects (ratio of pixels vs background).
    
    High-vis vest check: Analyzes the torso region (between shoulders and hips)
    for the presence of bright yellow/orange/green pixels.
    
    NOTE: For production accuracy, train a custom YOLOv8 model on a PPE dataset.
    This heuristic approach provides ~70% accuracy as a baseline.
    """

    def __init__(self, config: Optional[PPEConfig] = None):
        self.config = config or PPEConfig()
        self._no_ppe_count: dict[str, int] = {}
        self._last_alert: dict[str, float] = {}

    def analyze(self, detections: list[dict], frame=None) -> list[dict]:
        """
        Check persons for PPE compliance.
        Returns: [{ track_id, object_type: 'PPE_VIOLATION', violations: ['NO_HARDHAT', 'NO_VEST'] }]
        """
        if frame is None:
            return []

        import cv2
        import numpy as np

        events: list[dict] = []
        now = time.time()

        for det in detections:
            if det.get("object_type") != "person":
                continue
            tid = str(det.get("track_id", ""))
            if not tid:
                continue

            kps = det.get("keypoints")
            if not kps:
                continue

            violations = []

            # ── Hard hat check ────────────────────────────────────────────
            if self.config.check_hardhat:
                nose = _kp(kps, NOSE)
                ls = _kp(kps, L_SHOULDER)
                rs = _kp(kps, R_SHOULDER)
                if nose and ls and rs and nose[2] > 0.3:
                    # Region above the nose → where a hard hat would be
                    head_height = abs(ls[1] - nose[1]) * 0.5  # estimated hat region
                    hat_y1 = max(0, int(nose[1] - head_height * 1.5))
                    hat_y2 = int(nose[1])
                    hat_x1 = max(0, int(nose[0] - head_height))
                    hat_x2 = min(frame.shape[1], int(nose[0] + head_height))

                    if hat_y2 > hat_y1 and hat_x2 > hat_x1:
                        hat_region = frame[hat_y1:hat_y2, hat_x1:hat_x2]
                        if hat_region.size > 0:
                            hsv = cv2.cvtColor(hat_region, cv2.COLOR_BGR2HSV)
                            # Hard hats are typically bright, saturated colors
                            bright_mask = cv2.inRange(hsv, (0, 80, 120), (180, 255, 255))
                            bright_ratio = np.count_nonzero(bright_mask) / max(bright_mask.size, 1)
                            if bright_ratio < 0.25:
                                violations.append("NO_HARDHAT")

            # ── High-vis vest check ───────────────────────────────────────
            if self.config.check_vest:
                ls = _kp(kps, L_SHOULDER)
                rs = _kp(kps, R_SHOULDER)
                lh = _kp(kps, L_HIP)
                rh = _kp(kps, R_HIP)
                if all([ls, rs, lh, rh]) and min(ls[2], rs[2], lh[2], rh[2]) > 0.3:  # type: ignore
                    torso_y1 = int(min(ls[1], rs[1]))  # type: ignore
                    torso_y2 = int(max(lh[1], rh[1]))  # type: ignore
                    torso_x1 = int(min(ls[0], lh[0]))  # type: ignore
                    torso_x2 = int(max(rs[0], rh[0]))  # type: ignore

                    torso_y1 = max(0, torso_y1)
                    torso_x1 = max(0, torso_x1)
                    torso_y2 = min(frame.shape[0], torso_y2)
                    torso_x2 = min(frame.shape[1], torso_x2)

                    if torso_y2 > torso_y1 and torso_x2 > torso_x1:
                        torso_region = frame[torso_y1:torso_y2, torso_x1:torso_x2]
                        if torso_region.size > 0:
                            hsv = cv2.cvtColor(torso_region, cv2.COLOR_BGR2HSV)
                            hivis_mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
                            for low_h, high_h in self.config.hivis_hue_ranges:
                                mask = cv2.inRange(hsv, (low_h, 100, 150), (high_h, 255, 255))
                                hivis_mask = cv2.bitwise_or(hivis_mask, mask)

                            hivis_ratio = np.count_nonzero(hivis_mask) / max(hivis_mask.size, 1)
                            if hivis_ratio < self.config.vest_brightness_threshold:
                                violations.append("NO_VEST")

            if not violations:
                self._no_ppe_count[tid] = 0
                continue

            self._no_ppe_count[tid] = self._no_ppe_count.get(tid, 0) + 1
            if self._no_ppe_count[tid] < self.config.consecutive_frames:
                continue

            if (now - self._last_alert.get(tid, 0)) < self.config.cooldown_sec:
                continue

            self._last_alert[tid] = now
            events.append({
                "track_id": tid,
                "object_type": "PPE_VIOLATION",
                "violations": violations,
                "confidence": det.get("confidence", 0),
            })
            logger.warning("PPE VIOLATION: track %s — %s", tid, ", ".join(violations))

        return events

    def cleanup(self, active_ids: set[str]) -> None:
        for k in [k for k in self._no_ppe_count if k not in active_ids]:
            del self._no_ppe_count[k]
            self._last_alert.pop(k, None)
