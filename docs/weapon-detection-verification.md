# Weapon detection remediation

## Implemented

- Camera SOP selects its inference model; SOP changes restart that camera task. Model instances are shared only by model path, with serialized inference.
- Custom registered weapon models take precedence. A missing registered model fails visibly instead of silently falling back to a different detector.
- Weapon mode scans at the configured PROCESS_FPS target without requiring motion. Other modes scan idle scenes at least every IDLE_SCAN_INTERVAL (default 0.5 seconds), subject to processing capacity.
- Stationary threat tracks are not suppressed by the stationary-object classifier. The firearm class now reaches threat alerts.
- Current overlays publish before slower enrichment. Weapon-mode face/ReID/LPR/CLIP enrichment is limited to at most one pass per second; individual enrichment calls can still delay the next scan.
- Every ten seconds, camera logs report model, inference FPS, mean inference milliseconds (including detector-lock wait), and inference error status.
- YOLO_DEVICE=auto explicitly selects CUDA when available, otherwise logs CPU fallback. An explicit unsupported device fails model loading rather than silently claiming acceleration.
- Health reporting includes the models required by active cameras.

## Local evidence and limitations

The running engine's environment reports torch 2.12.1+cpu and CUDA available: False. The host has a GTX 1660 SUPER, but the engine cannot use it with this PyTorch build. Replacing PyTorch requires a compatible CUDA-enabled torch/torchvision pair and a controlled engine restart; do not overwrite DLLs while the engine is using them. Follow the official PyTorch installation matrix: https://pytorch.org/get-started/locally/ .

36 dependency-light regression tests pass, including scheduling/model-routing and GPU selection checks. These use no weapon images and do not measure recall, false positives, or live latency.

## GPU activation — 2026-09-08

With user authorization, replaced the CPU builds with torch 2.12.1+cu126 and torchvision 0.27.1+cu126 from the official PyTorch wheel index. Both downloaded wheels matched the index SHA-256 hashes. `pip check` reports no broken requirements. The local `.env` now requires `YOLO_DEVICE=cuda:0`.

`verify_gpu.py` passed a CUDA matrix operation and actual YOLO-World inference on the NVIDIA GTX 1660 SUPER (compute capability 7.5). Model parameters are on cuda:0; five warm synthetic-frame inferences averaged 13.37 ms. This is not a live latency or accuracy benchmark. The engine was restarted on its original port 8000; its startup log confirms `YOLO inference device=cuda:0 torch=2.12.1+cu126`.

For reproducible installation, stop the engine and install `requirements-gpu.txt` after the base requirements. Run `.venv\Scripts\python.exe -X utf8 verify_gpu.py` from apps/ai-engine to verify kernels and detector placement. Face recognition remains configured independently through ONNX Runtime; this CUDA change verifies YOLO/PyTorch, not every AI module.

Live restart verification: a stale engine occupying port 8000 was identified and stopped before the successful restart. The replacement bound port 8000, connected to the backend, synchronized the configured camera, and used yolov8s-worldv2.pt. The first live interval reported inference_fps=5.69, mean_inference_ms=41.7, error=None. The camera currently uses general mode (continuous_weapon_scan=False); it still uses the weapon-capable World model and periodic idle scans. These timings are observations, not guaranteed performance. Live startup/runtime output is in the ignored engine-gpu-active logs.

Validate with recorded, labeled positive and negative clips (or an inert prop), including small/occluded weapons, dark scenes, stationary objects, and confusing ordinary objects. Measure missed incidents, false alarms per camera-hour, and capture-to-alert latency before operational use. YOLO-World prompts do not establish weapon detection accuracy; maintain human review for consequential alerts.
