"""Regression and integration tests for multi-camera concurrent inference and threat tracking."""
import concurrent.futures
import importlib
import threading
import time
import unittest
from unittest.mock import MagicMock, patch

import numpy as np

# Native capture and model packages are mocked to run without GPU/CUDA requirement in test suite
with patch.dict('sys.modules', {'cv2': MagicMock(), 'ultralytics': None, 'ultralytics.utils': None, 'insightface': None}):
    detector_module = importlib.import_module('src.detector')
    tracker_module = importlib.import_module('src.tracker')
    import src.main as main_module


class MultiCameraInferenceTests(unittest.TestCase):
    def test_independent_detectors_allow_concurrent_inference(self):
        """Dedicated detector instances per camera do not block or serialize each other."""
        detector1 = detector_module.Detector()
        detector2 = detector_module.Detector()
        detector1._loaded = True
        detector2._loaded = True
        detector1.model = object()
        detector2.model = object()

        active = 0
        maximum = 0
        lock = threading.Lock()
        started_event = threading.Event()

        def mock_infer(frame):
            nonlocal active, maximum
            with lock:
                active += 1
                if active > maximum:
                    maximum = active
                if active >= 2:
                    started_event.set()
            time.sleep(0.05)
            with lock:
                active -= 1
            return []

        detector1._yolo_detect = mock_infer
        detector2._yolo_detect = mock_infer

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            fut1 = pool.submit(detector1.detect, np.zeros((10, 10, 3)))
            fut2 = pool.submit(detector2.detect, np.zeros((10, 10, 3)))
            fut1.result()
            fut2.result()

        # Both detectors executed concurrently
        self.assertGreaterEqual(maximum, 2)

    def test_camera_detectors_have_isolated_tracks(self):
        """Object tracking IDs and states are completely isolated between cameras."""
        tracker1 = tracker_module.CentroidTracker()
        tracker2 = tracker_module.CentroidTracker()

        # Camera 1 tracks object at (100, 100)
        box1 = [100, 100, 150, 150]
        objs1 = tracker1.update([{"object_type": "gun", "confidence": 0.85, "box": box1}])
        self.assertEqual(len(objs1), 1)

        # Camera 2 tracks object at completely different location (500, 500)
        box2 = [500, 500, 550, 550]
        objs2 = tracker2.update([{"object_type": "gun", "confidence": 0.82, "box": box2}])
        self.assertEqual(len(objs2), 1)

        # Both have independent tracks
        self.assertEqual(len(tracker1._tracks), 1)
        self.assertEqual(len(tracker2._tracks), 1)
        # Verify track IDs are independent instances
        t1 = list(tracker1._tracks.values())[0]
        t2 = list(tracker2._tracks.values())[0]
        self.assertIsNot(t1, t2)

    def test_threat_tracker_extended_persistence(self):
        """Threat classes (gun, knife, weapon) persist in tracks for 15 frames vs 5 frames for normal objects."""
        threat_tracker = tracker_module.CentroidTracker()
        normal_tracker = tracker_module.CentroidTracker()

        box = [100, 100, 150, 150]
        # Frame 0: Both see an object
        threat_tracker.update([{"object_type": "gun", "confidence": 0.85, "box": box}])
        normal_tracker.update([{"object_type": "person", "confidence": 0.85, "box": box}])

        self.assertEqual(len(threat_tracker._tracks), 1)
        self.assertEqual(len(normal_tracker._tracks), 1)

        # After 6 empty frames (e.g. slight occlusion or head turn)
        for _ in range(6):
            threat_tracker.update([])
            normal_tracker.update([])

        # Normal object track is pruned after 5 frames
        self.assertEqual(len(normal_tracker._tracks), 0, "Normal track should be pruned after 5 frames")
        # Threat object track persists across brief occlusions (up to 15 frames)
        self.assertEqual(len(threat_tracker._tracks), 1, "Threat track should persist across 6 dropped frames")

        # After 10 more empty frames (total 16 frames > 15 limit)
        for _ in range(10):
            threat_tracker.update([])

        self.assertEqual(len(threat_tracker._tracks), 0, "Threat track should eventually be pruned after 15 frames")

    def test_weapon_filters_and_prompts_configured(self):
        """Uniform low threshold 0.15 is set for all weapon classes."""
        filters = detector_module.DEFAULT_OBJECT_FILTERS
        for cls in ('gun', 'handgun', 'pistol', 'rifle', 'firearm', 'knife', 'weapon'):
            self.assertIn(cls, filters)
            self.assertAlmostEqual(filters[cls].min_score, 0.15)

        self.assertIn('black handgun', detector_module.CANONICAL_LABEL_MAP)
        self.assertEqual(detector_module.CANONICAL_LABEL_MAP['black handgun'], 'gun')
        self.assertIn('firearm held in hand', detector_module.CANONICAL_LABEL_MAP)
        self.assertEqual(detector_module.CANONICAL_LABEL_MAP['firearm held in hand'], 'gun')


class MultiCameraLifecycleAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_get_camera_detector_allocates_and_caches_per_camera(self):
        """main.get_camera_detector creates dedicated detectors per camera and reuses them."""
        # Reset active cache for clean test
        main_module.active_camera_detectors.clear()

        def create_mock_detector(*args, **kwargs):
            mock_det = MagicMock()
            mock_det.is_loaded.return_value = True
            return mock_det

        with patch.object(main_module, 'Detector', side_effect=create_mock_detector):
            det1, _ = await main_module.get_camera_detector('weapon', 'cam-1')
            det2, _ = await main_module.get_camera_detector('weapon', 'cam-2')

            self.assertIsNot(det1, det2, "Each camera must receive an independent Detector instance")

            # Calling again with cam-1 returns the cached instance
            det1_again, _ = await main_module.get_camera_detector('weapon', 'cam-1')
            self.assertIs(det1, det1_again, "Detector instance for cam-1 should be cached")

            # When cache cleared, a new instance is created
            main_module.active_camera_detectors.clear()
            det1_new, _ = await main_module.get_camera_detector('weapon', 'cam-1')
            self.assertIsNot(det1, det1_new, "Cleared cache must instantiate new detector")

        # Cleanup
        main_module.active_camera_detectors.clear()


if __name__ == '__main__':
    unittest.main()
