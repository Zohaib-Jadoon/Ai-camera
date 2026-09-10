import unittest
import time
from src.intrusion import IntrusionDetector


class TestIntrusionDetector(unittest.TestCase):
    def setUp(self):
        self.detector = IntrusionDetector()
        # Define a zone covering the upper right quadrant: (0.5, 0.0) to (1.0, 0.5)
        self.test_zones = [
            {
                "id": "zone-elevated-counter",
                "name": "Cash Counter",
                "rule_type": "intrusion",
                "points": [
                    [0.5, 0.1],
                    [0.9, 0.1],
                    [0.9, 0.5],
                    [0.5, 0.5],
                ],
            },
            {
                "id": "zone-restricted-loiter",
                "name": "Vault Area",
                "rule_type": "loitering",
                "loitering_threshold": 2.0,
                "points": [
                    [0.1, 0.6],
                    [0.4, 0.6],
                    [0.4, 0.9],
                    [0.1, 0.9],
                ],
            }
        ]
        self.detector.update_zones(self.test_zones)

    def test_hand_detection_in_intrusion_zone(self):
        """Verify an isolated hand detection inside the zone triggers immediate intrusion."""
        # Hand bounding box in normalized coords: x=0.6..0.7, y=0.2..0.3
        # Scaled to 1000x1000 frame
        detections = [
            {
                "track_id": "hand-1",
                "object_type": "hand",
                "confidence": 0.88,
                "box": (600, 200, 700, 300),
            }
        ]
        alerts = self.detector.check(detections, frame_width=1000, frame_height=1000)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["zone_id"], "zone-elevated-counter")
        self.assertEqual(alerts[0]["object_type"], "hand")
        self.assertEqual(alerts[0]["rule_type"], "intrusion")

    def test_reaching_arm_keypoint_intrusion(self):
        """
        Verify person standing with feet outside the zone (bottom edge at y=800),
        but extending wrist keypoint into the zone (x=600, y=300), triggers intrusion.
        """
        # Body box: x1=400, y1=200, x2=550, y2=800
        # Right wrist at (600, 300) inside the zone!
        keypoints = [[0, 0, 0]] * 17
        keypoints[10] = [600, 300, 0.9]  # Right wrist (COCO index 10) inside zone

        detections = [
            {
                "track_id": "person-reach-1",
                "object_type": "person",
                "confidence": 0.92,
                "box": (400, 200, 550, 800),
                "keypoints": keypoints,
            }
        ]
        alerts = self.detector.check(detections, frame_width=1000, frame_height=1000)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["zone_id"], "zone-elevated-counter")
        self.assertEqual(alerts[0]["track_id"], "person-reach-1")

    def test_bounding_box_edge_overlap_intrusion(self):
        """
        Verify person whose box overlaps the zone polygon triggers intrusion via edge intersection.
        """
        # Box from (450, 250) to (550, 350) straddles zone edge x=500
        detections = [
            {
                "track_id": "box-overlap-1",
                "object_type": "person",
                "confidence": 0.85,
                "box": (450, 250, 550, 350),
            }
        ]
        alerts = self.detector.check(detections, frame_width=1000, frame_height=1000)
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]["zone_id"], "zone-elevated-counter")

    def test_person_completely_outside_zone_no_alert(self):
        """Verify person in top-left quadrant (x=50..150, y=50..150) triggers no alert."""
        detections = [
            {
                "track_id": "person-safe",
                "object_type": "person",
                "confidence": 0.95,
                "box": (50, 50, 150, 150),
            }
        ]
        alerts = self.detector.check(detections, frame_width=1000, frame_height=1000)
        self.assertEqual(len(alerts), 0)

    def test_loitering_dwell_time_threshold(self):
        """
        Verify loitering zone requires dwell time >= loitering_threshold before alerting.
        """
        # Object inside vault area: x=200..300, y=700..800
        detections = [
            {
                "track_id": "loiterer-1",
                "object_type": "person",
                "confidence": 0.9,
                "box": (200, 700, 300, 800),
            }
        ]

        # First frame: initial sighting, dwell_time=0s < 2.0s threshold
        alerts_1 = self.detector.check(detections, frame_width=1000, frame_height=1000)
        self.assertEqual(len(alerts_1), 0)

        # Simulate dwell time elapsed by adjusting first_seen timestamp
        dwell_key = ("loiterer-1", "zone-restricted-loiter")
        self.assertIn(dwell_key, self.detector.loiter_tracker)
        self.detector.loiter_tracker[dwell_key] = time.monotonic() - 2.5

        # Subsequent frame: dwell_time > 2.0s -> alert triggered
        alerts_2 = self.detector.check(detections, frame_width=1000, frame_height=1000)
        self.assertEqual(len(alerts_2), 1)
        self.assertEqual(alerts_2[0]["rule_type"], "loitering")
        self.assertGreaterEqual(alerts_2[0]["dwell_time"], 2.0)

        # Once object leaves zone, tracker entry is purged
        self.detector.check([], frame_width=1000, frame_height=1000)
        self.assertNotIn(dwell_key, self.detector.loiter_tracker)


if __name__ == '__main__':
    unittest.main()
