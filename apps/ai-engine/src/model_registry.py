"""
Model Registry for Madad Vision AI Engine.

Manages multiple fine-tuned YOLO models indexed by SOP name.
At runtime the detector can be hot-swapped to use a custom-trained model
without restarting the engine.

Directory layout:
    models/
        registry.json          ← maps sop_name → model_path + metadata
        yolov8n.pt             ← base model (already present)
        hardhat_required.pt    ← custom fine-tuned model for that SOP
        ...

Socket.IO events handled by the engine (backend can trigger these):
    request_model_swap  { sop_name: str }   → swap active model
    request_registry    {}                  → return registry snapshot
"""

import json
import logging
import os
from pathlib import Path
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MODELS_DIR = Path(os.getenv("MODELS_DIR", "./models"))
REGISTRY_PATH = MODELS_DIR / "registry.json"


class ModelRegistry:
    """
    Lightweight on-disk registry that tracks:
    - Which .pt files are available
    - Which SOP each was trained for
    - When it was registered, its mAP50, training epochs, etc.
    - The currently active model path per SOP
    """

    def __init__(self):
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self._data = self._load()

    # ------------------------------------------------------------------ #
    #  Public API                                                          #
    # ------------------------------------------------------------------ #

    def register(
        self,
        sop_name: str,
        model_path: str,
        map50: float | None = None,
        epochs: int | None = None,
        notes: str = "",
    ) -> None:
        """Add or update a model entry in the registry."""
        self._data[sop_name] = {
            "model_path": str(model_path),
            "sop_name": sop_name,
            "map50": map50,
            "epochs": epochs,
            "notes": notes,
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }
        self._save()
        logger.info(f"ModelRegistry: registered '{sop_name}' → {model_path}")

    def resolve(self, sop_name: str | None = None) -> str:
        """
        Return the model path for a given SOP.
        Falls back to the base yolov8n.pt if SOP not registered.
        """
        base = str(MODELS_DIR / "yolov8n.pt") if (MODELS_DIR / "yolov8n.pt").exists() else "yolov8n.pt"
        if sop_name and sop_name in self._data:
            path = self._data[sop_name]["model_path"]
            if Path(path).exists():
                return path
            logger.warning(f"ModelRegistry: model file missing for '{sop_name}', using base model")
        return base

    def list_models(self) -> list[dict]:
        """Return all registered models as a list."""
        return list(self._data.values())

    def snapshot(self) -> dict:
        return dict(self._data)

    # ------------------------------------------------------------------ #
    #  Internals                                                           #
    # ------------------------------------------------------------------ #

    def _load(self) -> dict:
        if REGISTRY_PATH.exists():
            with open(REGISTRY_PATH) as f:
                return json.load(f)
        return {}

    def _save(self) -> None:
        with open(REGISTRY_PATH, "w") as f:
            json.dump(self._data, f, indent=2)
