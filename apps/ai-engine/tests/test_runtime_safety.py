"""Deterministic safety regressions without model downloads or camera access."""
import concurrent.futures
import importlib
import threading
import time
import unittest
from unittest.mock import MagicMock, patch

import numpy as np

from src.privacy import apply_privacy_masks

# Native capture and model packages are deliberately substituted. Image masking
# uses real NumPy arrays; model accuracy and native decoding are not tested here.
with patch.dict('sys.modules', {'cv2': MagicMock(), 'ultralytics': None, 'ultralytics.utils': None, 'insightface': None}):
    detector_module = importlib.import_module('src.detector')
    face_module = importlib.import_module('src.face_engine')
    stream_module = importlib.import_module('src.stream_handler')


class PrivacyTests(unittest.TestCase):
    def test_masks_copy_and_cover_fractional_boundary_pixels(self):
        original = np.ones((10, 10, 3), dtype=np.uint8)
        masked = apply_privacy_masks(original, [{'x': .11, 'y': .11, 'width': .2, 'height': .2}])
        self.assertTrue(np.all(masked[1:4, 1:4] == 0))
        self.assertTrue(np.all(masked[0, :] == 1))
        self.assertTrue(np.all(original == 1))

    def test_invalid_masks_fail_closed(self):
        for masks in (None, [{}], [{'x': -.2, 'y': 0, 'width': .5, 'height': .5}],
                      [{'x': float('nan'), 'y': 0, 'width': .5, 'height': .5}],
                      [{'x': 0, 'y': 0, 'width': True, 'height': .5}],
                      [{'x': .9, 'y': 0, 'width': .5, 'height': .5}]):
            with self.subTest(masks=masks):
                self.assertTrue(np.all(apply_privacy_masks(np.ones((10, 10, 3)), masks) == 0))

    def test_empty_mask_list_preserves_image(self):
        original = np.ones((10, 10, 3))
        np.testing.assert_array_equal(apply_privacy_masks(original, []), original)


class ModelSafetyTests(unittest.TestCase):
    def test_auto_device_uses_cuda_when_available(self):
        detector = detector_module.Detector()
        model = MagicMock()
        torch = MagicMock()
        torch.__version__ = 'test-cuda'
        torch.cuda.is_available.return_value = True
        with patch.dict('sys.modules', {'torch': torch}), patch.dict('os.environ', {'YOLO_DEVICE': 'auto'}):
            detector._configure_device(model)
        model.to.assert_called_once_with('cuda:0')
        self.assertEqual(detector.device, 'cuda:0')

    def test_explicit_cuda_does_not_silently_fallback(self):
        detector = detector_module.Detector()
        model = MagicMock()
        model.to.side_effect = RuntimeError('CUDA unavailable')
        with patch.dict('sys.modules', {'torch': MagicMock()}), patch.dict('os.environ', {'YOLO_DEVICE': 'cuda:0'}):
            with self.assertRaises(RuntimeError):
                detector._configure_device(model)

    def test_missing_models_never_fabricate_events(self):
        detector = detector_module.Detector()
        faces = face_module.FaceEngine()
        frame = np.ones((10, 10, 3))
        for _ in range(100):
            self.assertEqual(detector.detect(frame), [])
            self.assertEqual(faces.process(frame), [])
        self.assertFalse(detector.is_loaded())
        self.assertFalse(faces.is_loaded())
        self.assertEqual(detector.last_error, 'MODEL_UNAVAILABLE')

    def test_failed_face_preparation_discards_partial_model(self):
        app = MagicMock()
        app.prepare.side_effect = RuntimeError('Model initialization failed')
        with patch.object(face_module, 'INSIGHTFACE_AVAILABLE', True), patch.object(face_module, 'FaceAnalysis', return_value=app, create=True):
            faces = face_module.FaceEngine()
        self.assertIsNone(faces.app)
        self.assertEqual(faces.process(np.ones((10, 10, 3))), [])
        app.get.assert_not_called()

    def test_inference_failure_is_reported_and_recovery_clears_error(self):
        detector = detector_module.Detector(enable_tracking=False)
        detector._loaded = True
        detector.model = MagicMock(side_effect=RuntimeError('Inference failed'))
        self.assertEqual(detector.detect(np.ones((10, 10, 3))), [])
        self.assertEqual(detector.last_error, 'INFERENCE_FAILED')
        detector.model.side_effect = None
        detector.model.return_value = []
        self.assertEqual(detector.detect(np.ones((10, 10, 3))), [])
        self.assertIsNone(detector.last_error)

    def test_shared_detector_serializes_inference(self):
        detector = detector_module.Detector()
        detector._loaded = True
        detector.model = object()
        entered = threading.Event()
        active = 0
        maximum = 0

        def infer(frame):
            nonlocal active, maximum
            active += 1
            maximum = max(maximum, active)
            entered.set()
            time.sleep(.02)
            active -= 1
            return []

        detector._yolo_detect = infer
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(detector.detect, object())
            self.assertTrue(entered.wait(1))
            second = pool.submit(detector.detect, object())
            first.result()
            second.result()
        self.assertEqual(maximum, 1)

    def test_failed_swap_preserves_previous_model(self):
        detector = detector_module.Detector()
        previous = object()
        detector.model = previous
        detector._loaded = True
        with patch.object(detector_module, 'YOLO_AVAILABLE', True), patch.object(detector_module, 'YOLO', side_effect=RuntimeError('Bad model'), create=True):
            with self.assertRaises(RuntimeError):
                detector.load_model('test-only.pt')
        self.assertIs(detector.model, previous)


class CaptureTests(unittest.TestCase):
    def test_open_without_frames_is_not_online(self):
        stream = stream_module.StreamHandler('rtsp://test:secret@example.invalid/live')
        stream._running = True
        stream._connected = True
        self.assertFalse(stream.is_online)
        self.assertIsNone(stream.get_frame())

    def test_stale_frames_are_not_returned_as_live_footage(self):
        stream = stream_module.StreamHandler()
        stream._running = stream._connected = True
        stream._latest_frame = np.ones((10, 10, 3))
        stream._last_frame_time = time.monotonic() - 6
        self.assertFalse(stream.is_online)
        self.assertIsNone(stream.get_frame())

    def test_fresh_frame_sequence_and_copy(self):
        stream = stream_module.StreamHandler()
        stream._running = stream._connected = True
        stream._latest_frame = np.ones((10, 10, 3))
        stream._last_frame_time = time.monotonic()
        stream.frame_count = 7
        frame, sequence = stream.get_frame_with_sequence()
        self.assertTrue(stream.is_online)
        self.assertEqual(sequence, 7)
        frame[:] = 0
        self.assertTrue(np.all(stream._latest_frame == 1))

    def test_read_failure_reopens_capture_and_shutdown_releases_it(self):
        stream = stream_module.StreamHandler()
        failed = MagicMock()
        failed.read.return_value = (False, None)
        recovered = MagicMock()

        def read():
            stream._stop_event.set()
            return True, np.ones((10, 10, 3))

        recovered.read.side_effect = read
        captures = iter([failed, recovered])

        def open_capture():
            stream._cap = next(captures)
            return True

        stream._open = open_capture
        with patch.object(stream._stop_event, 'wait', return_value=False):
            stream._read_loop()
        failed.release.assert_called_once()
        recovered.release.assert_called_once()
        self.assertFalse(stream.is_online)
        self.assertIsNone(stream.get_frame())


if __name__ == '__main__':
    unittest.main()
