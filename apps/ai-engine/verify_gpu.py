"""Verify real CUDA kernels and the application's detector without camera access."""
import json
import time

import numpy as np
import torch

from src.detector import Detector


def main():
    """Fail if GPU inference is unavailable; report warm synthetic-frame timings."""
    if not torch.cuda.is_available():
        raise RuntimeError('CUDA unavailable: install CUDA-enabled PyTorch')
    # Exercise a kernel, not only device enumeration.
    value = torch.ones((128, 128), device='cuda')
    assert (value @ value).sum().item() == 128 ** 3
    detector = Detector('yolov8s-worldv2.pt', enable_tracking=False)
    if not detector.is_loaded() or not str(detector.device).startswith('cuda'):
        raise RuntimeError('Application detector failed to load on CUDA')
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    timings = []
    for index in range(8):
        started = time.perf_counter()
        detector.detect(frame)
        torch.cuda.synchronize()
        if detector.last_error:
            raise RuntimeError(detector.last_error)
        if index >= 3:
            timings.append((time.perf_counter() - started) * 1000)
    print(json.dumps({
        'torch': torch.__version__, 'cuda': torch.version.cuda,
        'gpu': torch.cuda.get_device_name(0),
        'capability': torch.cuda.get_device_capability(0),
        'model_device': str(next(detector.model.parameters()).device),
        'warm_mean_inference_ms': round(sum(timings) / len(timings), 2),
        'note': 'Synthetic blank-frame throughput check; not an accuracy or camera-to-alert test',
    }, indent=2))


if __name__ == '__main__':
    main()
