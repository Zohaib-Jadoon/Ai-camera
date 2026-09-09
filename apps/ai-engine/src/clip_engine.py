"""
CLIP-based Natural Language Video Search Engine.

Encodes video frames into CLIP embeddings and stores them in an in-memory
vector index. Users can then search for frames/events using natural language
queries like "man in red jacket" or "truck parked near gate".

Uses OpenAI's CLIP model via the `clip` package or `open_clip` as fallback.

The engine runs a background indexing task that samples frames at a
configurable interval and builds a searchable embedding store.
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Optional, Any, Callable

import numpy as np

logger = logging.getLogger(__name__)

# Attempt to load CLIP
CLIP_AVAILABLE = False
CLIP_MODEL = None
CLIP_PREPROCESS = None
CLIP_TOKENIZE = None

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

if TORCH_AVAILABLE:
    try:
        import clip
        CLIP_AVAILABLE = True
        logger.info("OpenAI CLIP available")
    except ImportError:
        try:
            import open_clip  # pyright: ignore[reportMissingImports]
            CLIP_AVAILABLE = True
            logger.info("open_clip available (fallback)")
        except ImportError:
            logger.warning("Neither 'clip' nor 'open_clip' installed — NLP search disabled. pip install openai-clip")


@dataclass
class CLIPConfig:
    """Configuration for CLIP-based video search."""
    model_name: str = "ViT-B/32"
    # Index a frame every N seconds
    index_interval_sec: float = 2.0
    # Maximum number of indexed frames to keep in memory
    max_index_size: int = 10000
    # Number of search results to return
    top_k: int = 20
    # Minimum similarity score to include in results
    min_similarity: float = 0.15


@dataclass
class FrameIndex:
    """A single indexed frame entry."""
    camera_id: str
    timestamp: float
    embedding: np.ndarray
    # Optional metadata
    detections: list[str] = field(default_factory=list)


class CLIPSearchEngine:
    """Natural language video search using CLIP embeddings."""

    def __init__(self, config: Optional[CLIPConfig] = None):
        self.config = config or CLIPConfig()
        self._model: Any = None
        self._preprocess: Any = None
        self._tokenize: Any = None
        self._device = "cpu"
        self._loaded = False
        self._index: list[FrameIndex] = []
        self._last_index_time: dict[str, float] = {}  # camera_id → last index time

        if CLIP_AVAILABLE and TORCH_AVAILABLE:
            try:
                self._load_model()
            except Exception as e:
                logger.error(f"CLIP model load failed: {e}")

    def _load_model(self):
        """Load the CLIP model."""
        import torch

        self._device = "cuda" if torch.cuda.is_available() else "cpu"

        try:
            import clip
            self._model, self._preprocess = clip.load(self.config.model_name, device=self._device)
            self._tokenize = clip.tokenize
            self._loaded = True
            logger.info(f"CLIP model loaded: {self.config.model_name} on {self._device}")
        except (ImportError, Exception):
            try:
                import open_clip  # pyright: ignore[reportMissingImports]
                self._model, _, self._preprocess = open_clip.create_model_and_transforms(
                    'ViT-B-32', pretrained='laion2b_s34b_b79k'
                )
                self._tokenize = open_clip.get_tokenizer('ViT-B-32')
                self._model = self._model.to(self._device)
                self._loaded = True
                logger.info(f"open_clip model loaded on {self._device}")
            except Exception as e:
                logger.error(f"Failed to load any CLIP model: {e}")

    def is_loaded(self) -> bool:
        return self._loaded

    def index_frame(
        self,
        frame: np.ndarray,
        camera_id: str,
        detections: list[dict] | None = None,
    ) -> bool:
        """
        Index a frame for later search. Call periodically from the processing loop.
        Returns True if the frame was indexed.
        """
        if not self._loaded or self._preprocess is None or self._model is None:
            return False

        now = time.time()
        last = self._last_index_time.get(camera_id, 0)
        if (now - last) < self.config.index_interval_sec:
            return False

        self._last_index_time[camera_id] = now

        try:
            import torch
            from PIL import Image
            import cv2

            # Convert BGR to RGB PIL Image
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)

            # Preprocess and encode
            img_input = self._preprocess(pil_img).unsqueeze(0).to(self._device)
            with torch.no_grad():
                embedding = self._model.encode_image(img_input)
                embedding = embedding.cpu().numpy().flatten()
                # L2 normalize
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm

            det_labels = []
            if detections:
                det_labels = list(set(d.get("object_type", "") for d in detections))

            self._index.append(FrameIndex(
                camera_id=camera_id,
                timestamp=now,
                embedding=embedding,
                detections=det_labels,
            ))

            # Evict oldest if over limit
            if len(self._index) > self.config.max_index_size:
                self._index = self._index[-self.config.max_index_size:]

            return True
        except Exception as e:
            logger.debug(f"CLIP index_frame error: {e}")
            return False

    def search(self, query: str) -> list[dict]:
        """
        Search indexed frames using a natural language query.
        Returns: [{ camera_id, timestamp, similarity, detections }]
        """
        if not self._loaded or not self._index or self._tokenize is None or self._model is None:
            return []

        try:
            import torch

            # Encode text query
            text_tokens = self._tokenize([query]).to(self._device)
            with torch.no_grad():
                text_embedding = self._model.encode_text(text_tokens)
                text_embedding = text_embedding.cpu().numpy().flatten()
                norm = np.linalg.norm(text_embedding)
                if norm > 0:
                    text_embedding = text_embedding / norm

            # Compute similarities
            results = []
            for entry in self._index:
                sim = float(np.dot(text_embedding, entry.embedding))
                if sim >= self.config.min_similarity:
                    results.append({
                        "camera_id": entry.camera_id,
                        "timestamp": entry.timestamp,
                        "similarity": round(sim, 4),
                        "detections": entry.detections,
                    })

            # Sort by similarity descending
            results.sort(key=lambda x: x["similarity"], reverse=True)
            return results[:self.config.top_k]

        except Exception as e:
            logger.error(f"CLIP search error: {e}")
            return []

    def get_index_stats(self) -> dict:
        """Return statistics about the current index."""
        if not self._index:
            return {"total_frames": 0, "cameras": [], "oldest": None, "newest": None}

        cameras = list(set(e.camera_id for e in self._index))
        return {
            "total_frames": len(self._index),
            "cameras": cameras,
            "oldest": self._index[0].timestamp,
            "newest": self._index[-1].timestamp,
        }
