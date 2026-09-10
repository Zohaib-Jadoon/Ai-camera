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
    - Custom SOP metadata: title, description, alert_title, alert_message, alert_severity, target_class
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
        title: str | None = None,
        description: str | None = None,
        alert_title: str | None = None,
        alert_message: str | None = None,
        alert_severity: str | None = None,
        target_class: str | None = None,
    ) -> None:
        """Add or update a model entry in the registry with custom SOP metadata."""
        clean_sop = sop_name.strip().lower().replace(" ", "_")
        self._data[clean_sop] = {
            "sop_name": clean_sop,
            "model_path": str(model_path),
            "title": title or clean_sop.replace("_", " ").title(),
            "description": description or f"Specialized vision model for {clean_sop}",
            "alert_title": alert_title or f"⚠️ {clean_sop.replace('_', ' ').upper()} DETECTED",
            "alert_message": alert_message or f"{clean_sop.replace('_', ' ').title()} breach detected on camera {{camera_id}}",
            "alert_severity": alert_severity or "HIGH",
            "target_class": target_class or clean_sop,
            "map50": map50,
            "epochs": epochs,
            "notes": notes,
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }
        self._save()
        logger.info(f"ModelRegistry: registered '{clean_sop}' → {model_path} (alert='{self._data[clean_sop]['alert_title']}')")

    def get_sop_config(self, sop_name: str | None) -> dict | None:
        """Retrieve SOP configuration including alert title, message, and target class."""
        if not sop_name:
            return None
        clean_sop = sop_name.strip().lower().replace(" ", "_")
        if clean_sop == "weapon":
            clean_sop = "weapon_detection"

        if clean_sop in self._data:
            return dict(self._data[clean_sop])

        # Built-in fallback SOP profiles
        if clean_sop == "weapon_detection":
            return {
                "sop_name": "weapon_detection",
                "title": "General Weapon Detection",
                "description": "Unifies knife, bat, gun, blade, and rifle into single Weapon Detected alert",
                "alert_title": "⚠️ WEAPON DETECTED",
                "alert_message": "Weapon detected on camera {camera_id}. Immediate response required.",
                "alert_severity": "CRITICAL",
                "target_class": "weapon",
            }
        if clean_sop in ("hardhat_required", "ppe"):
            return {
                "sop_name": "hardhat_required",
                "title": "PPE & Hardhat Compliance",
                "description": "Enforces PPE safety protocols requiring hard hats and high-vis vests",
                "alert_title": "⚠️ PPE SAFETY VIOLATION",
                "alert_message": "Personnel missing required safety equipment on camera {camera_id}",
                "alert_severity": "MEDIUM",
                "target_class": "hardhat",
            }
        if clean_sop in ("fire_smoke", "fire"):
            return {
                "sop_name": "fire_smoke",
                "title": "Fire & Smoke Early Hazard Warning",
                "description": "Identifies early smoke plumes, embers, and open flames",
                "alert_title": "🔥 FIRE / HAZARD DETECTED",
                "alert_message": "Fire or smoke hazard detected on camera {camera_id}. Evacuate area.",
                "alert_severity": "CRITICAL",
                "target_class": "fire",
            }
        return None

    def resolve(self, sop_name: str | None = None) -> str:
        """
        Return the model path for a given SOP.
        - 'weapon_detection': maps to yolov8s-worldv2.pt (Open-vocabulary gun/handgun/pistol/rifle model)
        - Registered custom models in registry.json
        - Base fallback to yolov8n.pt or yolov8s-worldv2.pt
        """
        if sop_name == "weapon":
            sop_name = "weapon_detection"
        if sop_name and sop_name in self._data:
            path = self._data[sop_name]["model_path"]
            if Path(path).exists():
                return path
            raise FileNotFoundError(f"Registered model missing for '{sop_name}'")
        if sop_name == "weapon_detection":
            return os.getenv("WEAPON_MODEL", "yolov8s-worldv2.pt")
        if sop_name in ("fire_smoke", "fire"):
            fire_model = MODELS_DIR / "fire_smoke.pt"
            if fire_model.exists():
                return str(fire_model)
        return os.getenv("YOLO_MODEL", "yolov8s-worldv2.pt")

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
            try:
                with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load registry: {e}")
        return {}

    def _save(self) -> None:
        try:
            with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
                json.dump(self._data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save registry: {e}")
