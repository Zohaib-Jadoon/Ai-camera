"""
Madad Vision AI Engine — centralized configuration.
All environment variables are read here with sensible defaults.
"""
import os
import pathlib

# Load .env file so env vars are available when running via uvicorn
# (uvicorn does not auto-source .env files).
try:
    from dotenv import load_dotenv
    load_dotenv(pathlib.Path(__file__).parent.parent / ".env")
except ImportError:
    pass  # python-dotenv not installed — rely on OS environment variables


class Config:
    """Immutable configuration container."""

    # Backend connectivity
    BACKEND_WS_URL: str = os.getenv("BACKEND_WS_URL", "http://localhost:3001")
    BACKEND_REST_URL: str = os.getenv("BACKEND_REST_URL", "http://localhost:3001")

    # AI model settings
    MODEL_CONFIDENCE_THRESHOLD: float = float(os.getenv("MODEL_CONFIDENCE_THRESHOLD", "0.55"))
    YOLO_MODEL: str = os.getenv("YOLO_MODEL", "yolov8n.pt")
    FACE_DETECTOR: str = os.getenv("FACE_DETECTOR", "retinaface")
    FACE_RECOGNIZER: str = os.getenv("FACE_RECOGNIZER", "arcface")
    FACE_SIMILARITY_THRESHOLD: float = float(os.getenv("FACE_SIMILARITY_THRESHOLD", "0.6"))

    # Processing
    PROCESS_FPS: int = int(os.getenv("PROCESS_FPS", "10"))
    FACE_PROCESS_INTERVAL: int = int(os.getenv("FACE_PROCESS_INTERVAL", "5"))
    MAX_CONSECUTIVE_ERRORS: int = int(os.getenv("MAX_CONSECUTIVE_ERRORS", "10"))
    ERROR_BACKOFF_SECONDS: int = int(os.getenv("ERROR_BACKOFF_SECONDS", "30"))
    # Frames a track must be motionless before StationaryMotionClassifier activates.
    # At 15 fps ≈ 3 s; at 30 fps ≈ 1.7 s. Increase for longer dwell tolerance.
    STATIONARY_FRAMES: int = int(os.getenv("STATIONARY_FRAMES", "50"))

    # Storage
    SNAPSHOT_DIR: str = os.getenv("SNAPSHOT_DIR", "./snapshots")
    SAVE_SNAPSHOTS: bool = os.getenv("SAVE_SNAPSHOTS", "false").lower() == "true"

    # GPU / CUDA
    USE_GPU: bool = os.getenv("USE_GPU", "true").lower() == "true"
    CUDA_DEVICE: int = int(os.getenv("CUDA_DEVICE", "0"))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv(
        "LOG_FORMAT",
        "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    @classmethod
    def to_dict(cls) -> dict:
        return {
            k: getattr(cls, k)
            for k in dir(cls)
            if not k.startswith("_") and not callable(getattr(cls, k))
        }


config = Config()
