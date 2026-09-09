"""
Face recognition engine using InsightFace (ArcFace + RetinaFace).
Reports unavailable recognition when InsightFace cannot initialize.
Fetches known embeddings from backend on startup.
"""
import numpy as np
import logging
import os
import threading
from typing import TYPE_CHECKING, Optional

from .config import config

if TYPE_CHECKING:
    from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

try:
    import insightface  # type: ignore[import-untyped]
    from insightface.app import FaceAnalysis  # type: ignore[import-untyped]
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    INSIGHTFACE_AVAILABLE = False
    logger.warning("InsightFace not available — face recognition unavailable")


class FaceEngine:
    SIMILARITY_THRESHOLD = config.FACE_SIMILARITY_THRESHOLD  # 0.6

    def __init__(self):
        self.app: Optional["FaceAnalysis"] = None
        self._loaded = False
        self._lock = threading.RLock()
        self.last_error = "MODEL_UNAVAILABLE"
        # {person_id: (name, embedding_vector, alert_message, alert_enabled)}
        self.known_faces: dict[str, tuple[str, np.ndarray, Optional[str], bool]] = {}

        if INSIGHTFACE_AVAILABLE:
            try:
                import onnxruntime as ort
                if hasattr(ort, 'preload_dlls') and 'CUDAExecutionProvider' in ort.get_available_providers():
                    ort.preload_dlls()
                has_cuda = "CUDAExecutionProvider" in ort.get_available_providers()
            except ImportError:
                has_cuda = False
                
            try:
                root = os.getenv("INSIGHTFACE_ROOT", os.path.expanduser("~/.insightface"))
                ctx_id = int(os.getenv("INSIGHTFACE_CTX_ID", "0" if has_cuda else "-1"))
                if ctx_id >= 0 and not has_cuda:
                    raise RuntimeError('GPU face recognition requested but ONNX CUDA provider is unavailable')
                providers = [('CUDAExecutionProvider', {'device_id': ctx_id}), 'CPUExecutionProvider'] if ctx_id >= 0 else ['CPUExecutionProvider']
                self.app = FaceAnalysis(name="buffalo_l", root=root, providers=providers,
                                        allowed_modules=['detection', 'recognition'])
                self.app.prepare(ctx_id=ctx_id, det_size=(320, 320))
                if ctx_id >= 0 and any('CUDAExecutionProvider' not in model.session.get_providers()
                                       for model in self.app.models.values()):
                    raise RuntimeError('ONNX face model silently fell back from CUDA')
                self._loaded = True
                self.last_error = None
                logger.info(f"InsightFace (buffalo_l) loaded successfully (ctx_id={ctx_id})")
            except Exception as e:
                self.app = None
                logger.error(f"InsightFace load failed: {e}")

    def is_loaded(self) -> bool:
        return self._loaded

    def register_face(self, person_id: str, name: str, embedding: list[float], alert_message: Optional[str] = None, alert_enabled: bool = False):
        """Register a known face embedding."""
        with self._lock:
            self.known_faces[person_id] = (name, np.array(embedding, dtype=np.float32), alert_message, alert_enabled)
        logger.info(f"Registered face: {name} (id={person_id}, alert_enabled={alert_enabled})")

    def load_embeddings(self, data: list):
        """Load known face embeddings from a provided list of records."""
        with self._lock:
            self._load_embeddings(data)

    def _load_embeddings(self, data: list):
        try:
            self.known_faces.clear()
            for item in data:
                if item.get("embedding_vector") and item.get("person_id"):
                    person = item.get("person", {})
                    self.register_face(
                        item["person_id"],
                        person.get("name", "Unknown"),
                        item["embedding_vector"],
                        person.get("alert_message"),
                        person.get("alert_enabled", False),
                    )
            logger.info(f"Loaded {len(self.known_faces)} face embeddings from backend sync")
        except Exception as e:
            logger.error(f"Failed to load face embeddings: {e}")

    def extract_embedding(self, frame) -> Optional[list[float]]:
        """Extract embedding for the largest face in the frame."""
        with self._lock:
            return self._extract_embedding(frame)

    def _extract_embedding(self, frame) -> Optional[list[float]]:
        if frame is None or not self._loaded or self.app is None:
            return None
        try:
            detected = self.app.get(frame)
            if not detected:
                return None
            
            largest_face = max(
                detected, 
                key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
            )
            return largest_face.normed_embedding.tolist()
        except Exception as e:
            logger.error(f"Failed to extract embedding: {e}")
            return None

    def process(self, frame) -> list[dict]:
        """Detect and recognize faces in a video frame."""
        if frame is None:
            return []

        with self._lock:
            if self._loaded and self.app is not None:
                return self._real_process(frame)
            return []

    def _real_process(self, frame) -> list[dict]:
        assert self.app is not None
        faces = []
        try:
            detected = self.app.get(frame)
            self.last_error = None
            for face in detected:
                embedding = face.normed_embedding
                person_id, person_name, score, alert_message, alert_enabled = self._match(embedding)
                faces.append({
                    "is_known": person_id is not None,
                    "person_id": person_id,
                    "person_name": person_name,
                    "confidence": round(score, 3),
                    "bbox": face.bbox.astype(int).tolist(),
                    "alert_message": alert_message,
                    "alert_enabled": alert_enabled,
                })
        except Exception as e:
            self.last_error = "INFERENCE_FAILED"
            logger.error(f"Face processing error: {e}")
            return []
        return faces

    def _match(self, embedding: np.ndarray) -> tuple[Optional[str], Optional[str], float, Optional[str], bool]:
        """Cosine similarity match against known faces."""
        best_id, best_name, best_score = None, None, 0.0
        best_alert_message, best_alert_enabled = None, False

        for pid, (name, known_emb, alert_msg, alert_en) in self.known_faces.items():
            norm_a = np.linalg.norm(embedding)
            norm_b = np.linalg.norm(known_emb)
            if norm_a == 0 or norm_b == 0:
                continue
            score = float(np.dot(embedding, known_emb) / (norm_a * norm_b))
            if score > best_score:
                best_score = score
                best_id = pid
                best_name = name
                best_alert_message = alert_msg
                best_alert_enabled = alert_en

        if best_score >= self.SIMILARITY_THRESHOLD:
            return best_id, best_name, best_score, best_alert_message, best_alert_enabled
        return None, None, best_score, None, False
