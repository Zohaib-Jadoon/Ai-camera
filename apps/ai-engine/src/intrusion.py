"""
IntrusionDetector — Frigate-inspired zone intrusion checker.

Key changes vs original:
- Uses cv2.pointPolygonTest (same algorithm Frigate uses) instead of a
  pure-Python ray-casting loop — faster and handles edge cases correctly.
- Polygon points are normalised (0.0-1.0) from the web canvas editor.
  The detector scales them to pixel coordinates using the frame dimensions.
- Supports both [[x,y],…] (canvas editor) and [{x,y},…] (legacy) formats.
- Emits per-zone events with metadata so the backend can log which zone fired.
"""

import time
import logging
import numpy as np

logger = logging.getLogger(__name__)

try:
    import cv2 as _cv2
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False
    logger.warning("cv2 not available — falling back to ray-casting for polygon tests")


class IntrusionDetector:
    """
    Boundary intrusion and zone violation detector.

    Zones are received via sync_zones socket event and have this shape:
        {
          "id": "<uuid>",
          "name": "North Gate",
          "rule_type": "intrusion" | "loitering" | "line_crossing" | …,
          "polygon_points": [[x,y], [x,y], …]  ← normalised 0.0–1.0
        }

    Detections have:
        { "box": [x1, y1, x2, y2], "object_type": "person", "confidence": 0.87, … }
    where box coordinates are in PIXEL space (matching the frame dimensions).
    """

    def __init__(self):
        self.zones: list = []
        self.loiter_tracker: dict[tuple[str, str], float] = {}

    def update_zones(self, zones: list):
        self.zones = zones
        logger.info(f"Updated {len(zones)} intrusion zones")

    def check(self, detections: list, frame_width: int = 640, frame_height: int = 360) -> list:
        """
        Check if any detected objects fall within configured zones.

        Evaluates multi-point containment (centroid, corners, keypoints/wrists)
        and box-polygon intersection to reliably catch reach-in, hand, and upper-body intrusions.

        Args:
            detections:   List of detection dicts from the AI engine.
            frame_width:  Width of the source frame in pixels (for norm→px conversion).
            frame_height: Height of the source frame in pixels.

        Returns:
            List of intrusion dicts  { zone_id, zone_name, rule_type,
                                       object_type, confidence, track_id }
        """
        intrusions = []
        now = time.monotonic()
        active_in_zones: set[tuple[str, str]] = set()

        for det in detections:
            # Tracker outputs 'box'; raw detector uses 'bbox' — accept both
            bbox = det.get('box', det.get('bbox', []))
            if len(bbox) < 4:
                continue

            x1, y1, x2, y2 = float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
            cx = (x1 + x2) / 2.0
            cy = (y1 + y2) / 2.0

            prev_bbox = det.get('prev_box', bbox)
            prev_cx = (prev_bbox[0] + prev_bbox[2]) / 2.0
            prev_cy = (prev_bbox[1] + prev_bbox[3]) / 2.0

            track_id = str(det.get('track_id') or det.get('object_type') or 'unknown')

            # Multi-point candidate points for robust boundary testing
            test_points: list[tuple[float, float]] = [
                (cx, cy),                # Centroid
                (cx, y2),                # Bottom-center (ground plane / feet)
                (cx, y1),                # Top-center (head / upper body)
                (x1, cy),                # Left-center
                (x2, cy),                # Right-center
                (x1, y1), (x2, y1),      # Top corners
                (x1, y2), (x2, y2),      # Bottom corners
            ]

            # If pose keypoints exist (e.g. wrists, elbows, hands), include high-confidence keypoints
            keypoints = det.get('keypoints')
            if keypoints and isinstance(keypoints, (list, tuple)):
                # Keypoints index 9 & 10 are wrists (hands), 7 & 8 are elbows
                for kp_idx in (9, 10, 7, 8):
                    if len(keypoints) > kp_idx:
                        kp = keypoints[kp_idx]
                        if len(kp) >= 2:
                            kpx, kpy = float(kp[0]), float(kp[1])
                            kp_conf = float(kp[2]) if len(kp) >= 3 else 1.0
                            if kp_conf >= 0.2 and kpx > 0 and kpy > 0:
                                test_points.append((kpx, kpy))

            for zone in self.zones:
                polygon = self._extract_polygon(zone, frame_width, frame_height)
                rule_type = zone.get('rule_type', 'intrusion')
                zone_id = str(zone.get('id') or 'default')

                if rule_type == 'line_crossing':
                    if len(polygon) < 2:
                        continue
                        
                    # Check if object movement path intersects the line segment
                    if self._segments_intersect((prev_cx, prev_cy), (cx, cy), polygon[0], polygon[1]):
                        intrusions.append({
                            'zone_id':     zone.get('id'),
                            'zone_name':   zone.get('name', rule_type),
                            'rule_type':   rule_type,
                            'object_type': det.get('object_type', 'unknown'),
                            'confidence':  det.get('confidence', 0.0),
                            'track_id':    det.get('track_id'),
                        })
                else:
                    if len(polygon) < 3:
                        continue

                    # 1. Check if any test point is inside polygon
                    is_inside = any(self._point_in_polygon(px, py, polygon) for px, py in test_points)

                    # 2. Check if polygon vertices fall inside bounding box
                    if not is_inside:
                        is_inside = any(x1 <= px <= x2 and y1 <= py <= y2 for px, py in polygon)

                    # 3. Check if bounding box perimeter intersects polygon perimeter
                    if not is_inside:
                        is_inside = self._box_intersects_polygon((x1, y1, x2, y2), polygon)

                    if is_inside:
                        active_in_zones.add((track_id, zone_id))

                        if rule_type == 'loitering':
                            # Dwell-time gate: only alert if object has stayed >= threshold
                            dwell_key = (track_id, zone_id)
                            first_seen = self.loiter_tracker.setdefault(dwell_key, now)
                            dwell_time = now - first_seen
                            dwell_threshold = float(zone.get('loitering_threshold', 3.0))

                            if dwell_time >= dwell_threshold:
                                intrusions.append({
                                    'zone_id':     zone.get('id'),
                                    'zone_name':   zone.get('name', rule_type),
                                    'rule_type':   rule_type,
                                    'object_type': det.get('object_type', 'unknown'),
                                    'confidence':  det.get('confidence', 0.0),
                                    'track_id':    det.get('track_id'),
                                    'dwell_time':  round(dwell_time, 1),
                                })
                        else:
                            # Immediate intrusion alert
                            intrusions.append({
                                'zone_id':     zone.get('id'),
                                'zone_name':   zone.get('name', rule_type),
                                'rule_type':   rule_type,
                                'object_type': det.get('object_type', 'unknown'),
                                'confidence':  det.get('confidence', 0.0),
                                'track_id':    det.get('track_id'),
                            })

        # Prune loiter tracker for objects that have left the zone
        for k in list(self.loiter_tracker.keys()):
            if k not in active_in_zones:
                self.loiter_tracker.pop(k, None)

        return intrusions

    # ── private helpers ──────────────────────────────────────────────────────

    def _extract_polygon(
        self, zone: dict, frame_width: int, frame_height: int
    ) -> list[tuple[float, float]]:
        """
        Extract pixel-space polygon from a zone dict.

        Handles three input formats:
          1. [[x,y], …]           ← canvas editor (normalised)
          2. [{"x": x, "y": y}]  ← legacy JSON object format
          3. {"points": [[x,y]]}  ← old DTO wrapper format
        """
        raw = (
            zone.get('polygon_points')
            or zone.get('polygon')
            or zone.get('points')
            or zone.get('coordinates')
        )

        # Unwrap old {"points": [...]} wrapper
        if isinstance(raw, dict) and 'points' in raw:
            raw = raw['points']

        # Guard against None / non-iterable polygon_points
        if not raw or not isinstance(raw, (list, tuple)):
            return []

        pts: list[tuple[float, float]] = []
        for pt in raw:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                nx, ny = float(pt[0]), float(pt[1])
                # If coords are normalised (<=1.0) scale to pixels
                if nx <= 1.0 and ny <= 1.0:
                    pts.append((nx * frame_width, ny * frame_height))
                else:
                    pts.append((nx, ny))
            elif isinstance(pt, dict):
                nx = float(pt.get('x', 0))
                ny = float(pt.get('y', 0))
                if nx <= 1.0 and ny <= 1.0:
                    pts.append((nx * frame_width, ny * frame_height))
                else:
                    pts.append((nx, ny))

        return pts

    def _point_in_polygon(self, x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
        """
        Test whether (x, y) is inside the polygon.

        Prefers cv2.pointPolygonTest when OpenCV is available (Frigate approach)
        — it handles degenerate polygons and edge cases better than ray-casting.
        """
        if len(polygon) < 3:
            return False

        if _HAS_CV2:
            # cv2 expects int32 contour array of shape (N, 1, 2)
            contour = np.array(polygon, dtype=np.float32).reshape((-1, 1, 2))
            # measureDist=False returns +1 (inside), -1 (outside), 0 (on boundary)
            result = _cv2.pointPolygonTest(contour, (x, y), measureDist=False)
            return result >= 0  # inside or on boundary

        # Fallback: ray-casting algorithm
        return self._ray_cast(x, y, polygon)

    @staticmethod
    def _ray_cast(x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
        """Pure-Python ray-casting fallback."""
        n = len(polygon)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i]
            xj, yj = polygon[j]
            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    @staticmethod
    def _segments_intersect(p1: tuple[float, float], p2: tuple[float, float], p3: tuple[float, float], p4: tuple[float, float]) -> bool:
        """Check if line segment p1-p2 intersects with line segment p3-p4."""
        def ccw(A, B, C):
            return (C[1]-A[1]) * (B[0]-A[0]) > (B[1]-A[1]) * (C[0]-A[0])
        return ccw(p1, p3, p4) != ccw(p2, p3, p4) and ccw(p1, p2, p3) != ccw(p1, p2, p4)

    def _box_intersects_polygon(self, box: tuple[float, float, float, float], polygon: list[tuple[float, float]]) -> bool:
        """Check if any of the 4 bounding box edges intersect with any edge of the polygon."""
        x1, y1, x2, y2 = box
        box_segments = [
            ((x1, y1), (x2, y1)),
            ((x2, y1), (x2, y2)),
            ((x2, y2), (x1, y2)),
            ((x1, y2), (x1, y1)),
        ]
        n = len(polygon)
        for i in range(n):
            poly_seg = (polygon[i], polygon[(i + 1) % n])
            for b1, b2 in box_segments:
                if self._segments_intersect(b1, b2, poly_seg[0], poly_seg[1]):
                    return True
        return False

