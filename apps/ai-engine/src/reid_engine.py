"""
Cross-Camera Re-Identification (ReID) Engine.

Uses appearance embeddings extracted from person crops to match individuals
across different camera feeds. When a person appears on Camera A and later
on Camera B, this engine correlates them as the same individual.

Embedding approach:
  - Primary: torchvision ResNet-18 pretrained on ImageNet (lightweight, fast).
  - Fallback: average color histogram (if torch is unavailable).

The engine maintains a gallery of recent person embeddings and performs
cosine-similarity matching to find cross-camera correspondences.
"""
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Attempt torch for embeddings
try:
    import torch
    import torchvision.transforms as T
    from torchvision import models
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available — ReID using histogram fallback")


@dataclass
class ReIDConfig:
    """Configuration for cross-camera re-identification."""
    # Cosine similarity threshold for positive match
    match_threshold: float = 0.70
    # Maximum gallery size (oldest entries evicted on overflow)
    max_gallery_size: int = 500
    # How long to keep a gallery entry (seconds)
    gallery_ttl_sec: float = 300.0  # 5 minutes
    # Minimum person crop size (pixels) to attempt embedding
    min_crop_size: int = 40
    # Process every Nth frame (ReID is CPU-heavy)
    frame_skip: int = 5


@dataclass
class GalleryEntry:
    """A single person appearance in the ReID gallery."""
    global_id: str
    camera_id: str
    track_id: str
    embedding: np.ndarray
    timestamp: float
    # Timeline of sightings: [(camera_id, timestamp)]
    sightings: list[tuple[str, float]] = field(default_factory=list)


class ReIDEngine:
    """Cross-camera person re-identification engine."""

    def __init__(self, config: Optional[ReIDConfig] = None):
        self.config = config or ReIDConfig()
        self._model = None
        self._transform = None
        self._loaded = False
        self._frame_counter = 0
        self._gallery: list[GalleryEntry] = []
        self._next_global_id = 1
        # track_id@camera_id → global_id mapping (avoids re-matching same track)
        self._track_map: dict[str, str] = {}

        if TORCH_AVAILABLE:
            try:
                logger.info("Loading ReID feature extractor (ResNet-18)...")
                self._model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
                # Remove classification head, keep feature extractor
                self._model = torch.nn.Sequential(*list(self._model.children())[:-1])
                self._model.eval()
                self._transform = T.Compose([
                    T.ToPILImage(),
                    T.Resize((128, 64)),
                    T.ToTensor(),
                    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
                ])
                self._loaded = True
                logger.info("ReID feature extractor loaded")
            except Exception as e:
                logger.error(f"ReID model load failed: {e}")

    def is_loaded(self) -> bool:
        return self._loaded

    def _extract_embedding(self, crop: np.ndarray) -> Optional[np.ndarray]:
        """Extract a feature embedding from a person crop."""
        if self._loaded and self._model is not None and self._transform is not None:
            try:
                import cv2
                # Ensure RGB
                if len(crop.shape) == 2:
                    crop = cv2.cvtColor(crop, cv2.COLOR_GRAY2RGB)
                elif crop.shape[2] == 4:
                    crop = cv2.cvtColor(crop, cv2.COLOR_BGRA2RGB)
                else:
                    crop = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)

                tensor = self._transform(crop).unsqueeze(0)
                with torch.no_grad():
                    feat = self._model(tensor)
                embedding = feat.squeeze().numpy()
                # L2 normalize
                norm = np.linalg.norm(embedding)
                if norm > 0:
                    embedding = embedding / norm
                return embedding
            except Exception as e:
                logger.debug(f"Embedding extraction failed: {e}")
                return None
        else:
            # Histogram fallback
            return self._histogram_embedding(crop)

    def _histogram_embedding(self, crop: np.ndarray) -> Optional[np.ndarray]:
        """Fallback: compute a color histogram embedding."""
        try:
            import cv2
            hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
            hist = cv2.calcHist([hsv], [0, 1], None, [32, 32], [0, 180, 0, 256])
            hist = hist.flatten().astype(np.float32)
            norm = np.linalg.norm(hist)
            if norm > 0:
                hist = hist / norm
            return hist
        except Exception:
            return None

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        return float(np.dot(a, b))

    def _evict_stale(self) -> None:
        """Remove gallery entries older than TTL."""
        now = time.time()
        self._gallery = [
            e for e in self._gallery
            if (now - e.timestamp) < self.config.gallery_ttl_sec
        ]
        # Also enforce max size
        if len(self._gallery) > self.config.max_gallery_size:
            self._gallery = self._gallery[-self.config.max_gallery_size:]

    def process(
        self,
        detections: list[dict],
        frame: np.ndarray,
        camera_id: str,
    ) -> list[dict]:
        """
        Process person detections for cross-camera matching.
        Returns: [{ track_id, global_id, matched_camera, matched_track, similarity }]
        """
        self._frame_counter += 1
        if self._frame_counter % self.config.frame_skip != 0:
            return []

        self._evict_stale()
        events: list[dict] = []
        now = time.time()
        fh, fw = frame.shape[:2]

        for det in detections:
            if det.get("object_type") != "person":
                continue
            tid = str(det.get("track_id", ""))
            if not tid:
                continue

            box = det.get("smooth_box") or det.get("box")
            if not box or len(box) != 4:
                continue

            x1, y1, x2, y2 = [max(0, int(v)) for v in box]
            x2 = min(fw, x2)
            y2 = min(fh, y2)
            if (x2 - x1) < self.config.min_crop_size or (y2 - y1) < self.config.min_crop_size:
                continue

            crop = frame[y1:y2, x1:x2]
            embedding = self._extract_embedding(crop)
            if embedding is None:
                continue

            track_key = f"{tid}@{camera_id}"

            # Check if this track already has a global_id
            if track_key in self._track_map:
                global_id = self._track_map[track_key]
                # Update the gallery entry timestamp
                for entry in self._gallery:
                    if entry.global_id == global_id:
                        entry.timestamp = now
                        entry.embedding = embedding  # refresh appearance
                        break
                continue

            # Search gallery for match (exclude same camera)
            best_match: Optional[GalleryEntry] = None
            best_sim = 0.0

            for entry in self._gallery:
                if entry.camera_id == camera_id:
                    continue  # skip same-camera matches
                sim = self._cosine_similarity(embedding, entry.embedding)
                if sim > best_sim and sim >= self.config.match_threshold:
                    best_sim = sim
                    best_match = entry

            if best_match is not None:
                # Cross-camera match found!
                global_id = best_match.global_id
                self._track_map[track_key] = global_id
                best_match.sightings.append((camera_id, now))
                events.append({
                    "track_id": tid,
                    "global_id": global_id,
                    "matched_camera": best_match.camera_id,
                    "matched_track": best_match.track_id,
                    "similarity": round(best_sim, 3),
                    "camera_id": camera_id,
                    "object_type": "CROSS_CAMERA_MATCH",
                    "sighting_count": len(best_match.sightings),
                })
                logger.info(
                    "ReID match: track %s@%s ↔ global %s (from %s) sim=%.2f",
                    tid, camera_id, global_id, best_match.camera_id, best_sim,
                )
            else:
                # New person — add to gallery
                global_id = f"person-{self._next_global_id}"
                self._next_global_id += 1
                self._track_map[track_key] = global_id
                self._gallery.append(GalleryEntry(
                    global_id=global_id,
                    camera_id=camera_id,
                    track_id=tid,
                    embedding=embedding,
                    timestamp=now,
                    sightings=[(camera_id, now)],
                ))

        return events

    def get_timeline(self, global_id: str) -> list[tuple[str, float]]:
        """Return the sighting timeline for a global person ID."""
        for entry in self._gallery:
            if entry.global_id == global_id:
                return entry.sightings
        return []

    def cleanup(self, active_ids: set[str], camera_id: str) -> None:
        """Remove track mappings for tracks no longer active on a camera."""
        stale = [k for k in self._track_map if k.endswith(f"@{camera_id}") and k.split("@")[0] not in active_ids]
        for k in stale:
            del self._track_map[k]
