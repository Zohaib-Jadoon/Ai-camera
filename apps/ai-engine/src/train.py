"""
SOP Fine-Tuning Script for Madad Vision AI Engine.

Trains a custom YOLOv8 model on data collected by DataCollector for a specific
Standard Operating Procedure (SOP). After training, the resulting .pt file is
registered in the ModelRegistry so the live engine can pick it up automatically.

Usage (standalone):
    python -m src.train --sop hardhat_required --epochs 50

Or call programmatically (e.g. via a backend admin endpoint in the future):
    from src.train import train_sop
    train_sop(sop_name="hardhat_required", epochs=50, imgsz=640)
"""

import argparse
import json
import logging
import os
import shutil
from pathlib import Path

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

DATASETS_ROOT = Path(os.getenv("TRAINING_DATA_DIR", "./training_data"))
MODELS_DIR = Path(os.getenv("MODELS_DIR", "./models"))
BASE_MODEL = os.getenv("BASE_MODEL", "yolov8n.pt")


def build_yaml(sop_name: str) -> Path:
    """
    Generate a YOLO dataset YAML file from the collected meta.json.
    The YAML is written to training_data/<sop>/dataset.yaml.
    """
    sop_dir = DATASETS_ROOT / sop_name
    meta_path = sop_dir / "meta.json"

    if not meta_path.exists():
        raise FileNotFoundError(f"No meta.json found for SOP '{sop_name}'. "
                                f"Enable COLLECT_TRAINING_DATA=true and run the engine to collect data first.")

    with open(meta_path) as f:
        meta = json.load(f)

    classes: dict[str, int] = meta.get("classes", {})
    if not classes:
        raise ValueError(f"No class labels found in meta.json for SOP '{sop_name}'.")

    # Sort by class id to build names list
    names = [k for k, _ in sorted(classes.items(), key=lambda x: x[1])]

    # Split images into train / val (80 / 20)
    images = sorted((sop_dir / "images").glob("*.jpg"))
    if len(images) < 10:
        raise ValueError(f"Need at least 10 frames to train. Only {len(images)} collected for '{sop_name}'.")

    split_idx = int(len(images) * 0.8)
    train_imgs = images[:split_idx]
    val_imgs = images[split_idx:]

    # Write split manifests (YOLO accepts txt lists of image paths)
    train_txt = sop_dir / "train.txt"
    val_txt = sop_dir / "val.txt"
    train_txt.write_text("\n".join(str(p.resolve()) for p in train_imgs))
    val_txt.write_text("\n".join(str(p.resolve()) for p in val_imgs))

    yaml_content = (
        f"# Auto-generated dataset YAML for SOP: {sop_name}\n"
        f"train: {train_txt.resolve()}\n"
        f"val: {val_txt.resolve()}\n"
        f"nc: {len(names)}\n"
        f"names: {names}\n"
    )

    yaml_path = sop_dir / "dataset.yaml"
    yaml_path.write_text(yaml_content)
    logger.info(f"Dataset YAML written → {yaml_path}")
    return yaml_path


def train_sop(
    sop_name: str,
    epochs: int = 50,
    imgsz: int = 640,
    batch: int = 16,
    device: str = "cpu",
    project: str | None = None,
) -> Path:
    """
    Fine-tune a YOLOv8 model on the collected SOP dataset.

    Args:
        sop_name:  Name of the SOP (matches the folder in training_data/).
        epochs:    Number of training epochs.
        imgsz:     Input image size.
        batch:     Batch size (reduce if OOM; use -1 for AutoBatch).
        device:    'cpu', '0' for GPU 0, '0,1' for multi-GPU, 'mps' for Apple Silicon.
        project:   Output directory (defaults to models/<sop_name>/).

    Returns:
        Path to the best.pt model file.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        raise RuntimeError("ultralytics is not installed. Run: pip install ultralytics")

    yaml_path = build_yaml(sop_name)
    output_dir = Path(project) if project else MODELS_DIR / sop_name

    logger.info(f"Starting training for SOP '{sop_name}' — {epochs} epochs on device '{device}'")

    model = YOLO(BASE_MODEL)
    results = model.train(
        data=str(yaml_path),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=device,
        project=str(output_dir),
        name="train",
        exist_ok=True,
        verbose=True,
    )

    best_pt = output_dir / "train" / "weights" / "best.pt"
    if not best_pt.exists():
        raise FileNotFoundError(f"Training finished but best.pt not found at {best_pt}")

    # Copy to models/ root for easy access
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    dest = MODELS_DIR / f"{sop_name}.pt"
    shutil.copy2(best_pt, dest)
    logger.info(f"Best model copied → {dest}")

    # Register in ModelRegistry
    from .model_registry import ModelRegistry
    registry = ModelRegistry()
    map50 = None
    try:
        # results.results_dict may contain 'metrics/mAP50(B)'
        map50 = float(results.results_dict.get("metrics/mAP50(B)", 0))
    except Exception:
        pass

    registry.register(
        sop_name=sop_name,
        model_path=str(dest),
        map50=map50,
        epochs=epochs,
        notes=f"Trained from {yaml_path}",
    )

    logger.info(f"SOP '{sop_name}' model registered. mAP50: {map50}")
    return dest


# ------------------------------------------------------------------ #
#  CLI entry point                                                     #
# ------------------------------------------------------------------ #

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train a custom YOLOv8 model for a Madad Vision SOP")
    parser.add_argument("--sop", required=True, help="SOP name (must match a folder in training_data/)")
    parser.add_argument("--epochs", type=int, default=50, help="Training epochs (default: 50)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size (default: 640)")
    parser.add_argument("--batch", type=int, default=16, help="Batch size (default: 16)")
    parser.add_argument("--device", default="cpu", help="Device: cpu | 0 | 0,1 | mps (default: cpu)")
    args = parser.parse_args()

    train_sop(
        sop_name=args.sop,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
    )
