import unittest
import numpy as np
import cv2
from src.fire_detector import FireDetector


class TestFireDetector(unittest.TestCase):
    def setUp(self):
        self.detector = FireDetector()

    def test_empty_frame(self):
        self.assertEqual(self.detector.detect(None), [])
        self.assertEqual(self.detector.detect(np.array([])), [])

    def test_non_fire_neutral_frame(self):
        # Grey room / office
        frame = np.ones((480, 640, 3), dtype=np.uint8) * 128
        dets = self.detector.detect(frame)
        self.assertEqual(len(dets), 0)

    def test_non_fire_orange_clothing(self):
        # Reflective orange fabric (high R, low B, non-emissive)
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        frame[:, :] = (30, 110, 220)  # BGR
        dets = self.detector.detect(frame)
        self.assertEqual(len(dets), 0)

    def test_synthetic_lighter_flame(self):
        # Dark room with small bright lighter flame
        frame = np.ones((480, 640, 3), dtype=np.uint8) * 40
        # Add flame corona (orange-yellow envelope)
        cv2.ellipse(frame, (320, 240), (12, 22), 0, 0, 360, (20, 165, 255), -1)
        # Add emissive hot core (white-hot/yellow center)
        cv2.ellipse(frame, (320, 245), (6, 12), 0, 0, 360, (140, 230, 255), -1)

        dets = self.detector.detect(frame)
        self.assertGreaterEqual(len(dets), 1)
        det = dets[0]
        self.assertEqual(det["object_type"], "fire")
        self.assertIn(det["raw_label"], ("lighter", "fire"))
        self.assertGreaterEqual(det["confidence"], 0.70)
        # Check box covers flame center (320, 240)
        x1, y1, x2, y2 = det["box"]
        self.assertLessEqual(x1, 320)
        self.assertGreaterEqual(x2, 320)
        self.assertLessEqual(y1, 240)
        self.assertGreaterEqual(y2, 240)

    def test_temporal_tracking_smoothing(self):
        # Frame with flame in motion
        frame1 = np.ones((480, 640, 3), dtype=np.uint8) * 30
        cv2.ellipse(frame1, (200, 200), (10, 18), 0, 0, 360, (20, 160, 255), -1)
        cv2.ellipse(frame1, (200, 205), (5, 9), 0, 0, 360, (130, 225, 255), -1)

        dets1 = self.detector.detect(frame1)
        self.assertGreaterEqual(len(dets1), 1)
        tid1 = dets1[0]["track_id"]
        self.assertIsNotNone(tid1)

        # Frame 2: flame moves slightly (202, 201)
        frame2 = np.ones((480, 640, 3), dtype=np.uint8) * 30
        cv2.ellipse(frame2, (202, 201), (10, 18), 0, 0, 360, (20, 160, 255), -1)
        cv2.ellipse(frame2, (202, 206), (5, 9), 0, 0, 360, (130, 225, 255), -1)

        dets2 = self.detector.detect(frame2)
        self.assertGreaterEqual(len(dets2), 1)
        tid2 = dets2[0]["track_id"]
        # Same persistent track ID preserved
        self.assertEqual(tid1, tid2)

    def test_real_lighter_flame_image(self):
        import os
        img_path = r"C:\Users\PC\.gemini\antigravity-ide\brain\eeb4c7d2-bdec-4cab-a6c9-4de3ce10fe22\lighter_flame_test_1789018077256.jpg"
        if not os.path.exists(img_path):
            return
        img = cv2.imread(img_path)
        dets = self.detector.detect(img)
        self.assertGreaterEqual(len(dets), 1)
        # Check flame detection is on the lighter flame (around x: 450-650, y: 400-650)
        found_flame = False
        for d in dets:
            if d["object_type"] == "fire":
                x1, y1, x2, y2 = d["box"]
                if 400 <= (x1 + x2) / 2 <= 650 and 400 <= (y1 + y2) / 2 <= 650:
                    found_flame = True
                    break
        self.assertTrue(found_flame, f"Expected flame around hand/lighter, got: {dets}")


if __name__ == "__main__":
    unittest.main()
