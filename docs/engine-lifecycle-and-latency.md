# Engine lifecycle and latency work — 2026-09-08

## Implemented and checked

- `npm start`/`npm run dev` use `src.launcher`, which reserves the listening socket before importing AI models. Docker uses the same launcher. A duplicate live startup exited in under one second with a clear port-conflict message and no model load.
- Socket.IO cleanup now shuts down reconnect activity and unconditionally disconnects Engine.IO, closing sessions left by interrupted connection attempts. Regression tests exercise disconnected and failed-shutdown paths; a live signal-driven shutdown has not been verified.
- Face/LPR/ReID/CLIP enrichment runs in a single-flight background job per camera, with shared mutable enrichment state serialized. Busy jobs do not queue frames. Completion does not block the detection loop; results carry source timestamps and are dropped when privacy masks changed. Native jobs drain before camera teardown.
- Removed the previous behavior that copied one recognized person's name onto all person tracks. Face identity is emitted as a face event; it is not assigned to unrelated tracked people.
- FaceAnalysis requests detection and recognition modules only, selects explicit providers, preloads GPU libraries, and fails visibly if a requested GPU session falls back to CPU.
- Installed and verified onnxruntime-gpu 1.23.2 against the existing CUDA 12 PyTorch build. Version 1.27 was tested and rejected because it required CUDA 13 DLLs. Compatibility reference: https://onnxruntime.ai/docs/execution-providers/CUDA-ExecutionProvider.html .
- `verify_face_gpu.py` executed synthetic detection and recognition inputs successfully with CUDAExecutionProvider present in both sessions. These are execution checks, not face-accuracy tests.
- 42 dependency-light regression tests passed. Git diff whitespace checks passed.

## Live verification

The engine is running in the background using `python -X utf8 -m src.launcher` on port 8000. Startup logs confirm YOLO cuda:0, InsightFace ctx_id=0, CLIP cuda, backend connection, and camera synchronization. Initial live intervals reported 6.04 and 5.91 inference frames/s, mean detector time 43.8 and 30.4 ms, error=None. This is not a controlled before/after performance benchmark; no speedup claim is established.

Do not run a second engine while this one is active. The launcher will refuse to load another instance. Runtime logs are in ignored `engine-managed.stdout.log` and `engine-managed.stderr.log` files.

## Remaining limitations

- InsightFace 1.0.1 declares CPU `onnxruntime` in distribution metadata. `pip check` therefore reports that declaration as unmet with GPU-only installation. Both distributions share the same import namespace; do not install CPU ONNX Runtime over the verified GPU package. The actual face graphs executed successfully. Coloredlogs, required by the GPU package, was installed.
- EasyOCR/LPR remains disabled. No plate accuracy or external alert-delivery test was performed.
- Follow-up at 16:38: camera SOP was changed through the authenticated Calibration dashboard from general_detection to weapon_detection using the browser-automation skill. The engine restarted that camera task and logged continuous_weapon_scan=True with yolov8s-worldv2.pt. A subsequent interval reported 7.56 inference frames/s, mean detector time 36.4 ms, error=None. Browser reload confirmed the persisted weapon_detection setting and ONLINE camera, with no console warnings/errors observed. This enables continuous scanning but does not establish weapon accuracy.
- Weapon recall, false alarms, darkness/occlusion performance, end-to-end latency, and long-running outage/load behavior require representative labeled footage and dedicated testing. No claim of enterprise readiness or reliable weapon detection is made.
- Background analysis can still contend for GPU/CPU resources; draining a hung native inference at shutdown is not yet time-bounded or process-isolated.
