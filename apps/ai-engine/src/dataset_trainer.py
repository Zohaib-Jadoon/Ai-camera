"""
Dataset Trainer & Fine-Tuning Pipeline for Madad Vision AI Engine.

Features:
1. Ingests uploaded dataset .zip archives.
2. Unpacks and auto-normalizes images and YOLO annotation .txt files.
3. Class Generalization: Optionally remaps multi-class threat datasets
   (e.g. knife=0, handgun=1, bat=2, rifle=3) into a single unified class (0: weapon)
   so the trained model directly predicts "weapon".
4. Auto-splits into 80% train / 20% validation if splits are missing.
5. Generates standard YOLO data.yaml configuration.
6. Trains YOLOv8 (ultralytics) with live progress logging to progress.json.
7. Registers resulting best.pt in ModelRegistry for hot-deployment to live cameras.
"""

import argparse
import json
import logging
import os
import shutil
import sys
import time
import zipfile
from pathlib import Path
from typing import Optional

logger = logging.getLogger("DatasetTrainer")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

BASE_DIR = Path(__file__).resolve().parent.parent
TRAINING_DATA_ROOT = BASE_DIR / "training_data"
MODELS_DIR = BASE_DIR / "models"
DEFAULT_BASE_MODEL = os.getenv("BASE_MODEL", "yolov8n.pt")


class DatasetTrainer:
    """Manages ZIP dataset unpacking, formatting, training, and registration."""

    def __init__(
        self,
        sop_name: str,
        base_model: str = "yolov8n.pt",
        title: Optional[str] = None,
        description: Optional[str] = None,
        alert_title: Optional[str] = None,
        alert_message: Optional[str] = None,
        alert_severity: Optional[str] = "HIGH",
        target_class: Optional[str] = None,
    ):
        self.sop_name = sop_name.strip().lower().replace(" ", "_")
        self.base_model = base_model
        self.title = title
        self.description = description
        self.alert_title = alert_title
        self.alert_message = alert_message
        self.alert_severity = alert_severity
        self.target_class = target_class
        self.sop_dir = TRAINING_DATA_ROOT / self.sop_name
        self.log_file = self.sop_dir / "training.log"
        self.progress_file = self.sop_dir / "progress.json"
        self.metadata_file = self.sop_dir / "metadata.json"
        self.sop_dir.mkdir(parents=True, exist_ok=True)
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self._write_metadata()

    def _write_metadata(self):
        meta = {
            "sop_name": self.sop_name,
            "title": self.title or self.sop_name.replace("_", " ").title(),
            "description": self.description or f"Custom vision model for {self.sop_name}",
            "alert_title": self.alert_title or f"⚠️ {self.sop_name.replace('_', ' ').upper()} DETECTED",
            "alert_message": self.alert_message or f"{self.sop_name.replace('_', ' ').title()} violation on camera {{camera_id}}",
            "alert_severity": self.alert_severity or "HIGH",
            "target_class": self.target_class or self.sop_name,
            "base_model": self.base_model,
            "updated_at": time.time(),
        }
        try:
            self.metadata_file.write_text(json.dumps(meta, indent=2), encoding="utf-8")
        except Exception as e:
            logger.warning(f"Could not write metadata.json: {e}")

    def write_progress(
        self,
        status: str,
        epoch: int = 0,
        total_epochs: int = 0,
        box_loss: float = 0.0,
        cls_loss: float = 0.0,
        map50: float = 0.0,
        message: str = "",
        error: Optional[str] = None,
    ):
        """Write real-time training progress to progress.json."""
        progress_pct = round((epoch / total_epochs * 100), 1) if total_epochs > 0 else 0.0
        data = {
            "sop_name": self.sop_name,
            "status": status,
            "epoch": epoch,
            "total_epochs": total_epochs,
            "progress_pct": progress_pct,
            "box_loss": round(box_loss, 4),
            "cls_loss": round(cls_loss, 4),
            "map50": round(map50, 4),
            "message": message,
            "error": error,
            "updated_at": time.time(),
        }
        try:
            temp_file = self.progress_file.with_suffix(".tmp")
            temp_file.write_text(json.dumps(data, indent=2))
            temp_file.replace(self.progress_file)
        except Exception as e:
            logger.warning(f"Failed to write progress: {e}")

    def extract_zip(self, zip_path: Path | str) -> Path:
        """Extract a dataset zip file into the SOP training directory."""
        zip_path = Path(zip_path)
        if not zip_path.exists():
            raise FileNotFoundError(f"Dataset archive not found: {zip_path}")

        raw_dir = self.sop_dir / "raw"
        if raw_dir.exists():
            shutil.rmtree(raw_dir)
        raw_dir.mkdir(parents=True, exist_ok=True)

        self.write_progress("EXTRACTING", message=f"Extracting {zip_path.name}...")
        logger.info(f"Extracting {zip_path} → {raw_dir}")

        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(raw_dir)

        return raw_dir

    def prepare_dataset(
        self,
        raw_dir: Path,
        generalize_class: Optional[str] = "weapon",
        target_classes: Optional[list[str]] = None,
    ) -> Path:
        """
        Normalize dataset files into standard YOLO format:
        training_data/<sop_name>/
            train/images, train/labels
            val/images, val/labels
            data.yaml
        """
        self.write_progress("PREPARING", message="Validating and structuring dataset...")

        # Find all images (.jpg, .jpeg, .png, .bmp, .webp)
        image_exts = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        all_images = [p for p in raw_dir.rglob("*") if p.suffix.lower() in image_exts]

        if len(all_images) < 4:
            raise ValueError(f"Dataset contains only {len(all_images)} images. At least 4 images are required.")

        dataset_root = self.sop_dir / "dataset"
        train_img_dir = dataset_root / "train" / "images"
        train_lbl_dir = dataset_root / "train" / "labels"
        val_img_dir = dataset_root / "val" / "images"
        val_lbl_dir = dataset_root / "val" / "labels"

        # Clean prior dataset structure
        if dataset_root.exists():
            shutil.rmtree(dataset_root)

        train_img_dir.mkdir(parents=True, exist_ok=True)
        train_lbl_dir.mkdir(parents=True, exist_ok=True)
        val_img_dir.mkdir(parents=True, exist_ok=True)
        val_lbl_dir.mkdir(parents=True, exist_ok=True)

        # Shuffle and split 80% train / 20% val
        import random
        random.seed(42)
        random.shuffle(all_images)
        split_idx = max(1, int(len(all_images) * 0.8))
        train_files = all_images[:split_idx]
        val_files = all_images[split_idx:]

        def process_split(img_list: list[Path], target_img_dir: Path, target_lbl_dir: Path):
            for img_p in img_list:
                stem = img_p.stem
                # Copy image
                target_img = target_img_dir / img_p.name
                shutil.copy2(img_p, target_img)

                # Locate label file in same or neighboring folder
                lbl_candidates = [
                    img_p.with_suffix(".txt"),
                    img_p.parent.parent / "labels" / f"{stem}.txt",
                    img_p.parent / f"{stem}.txt",
                ]
                lbl_found = None
                for cand in lbl_candidates:
                    if cand.exists():
                        lbl_found = cand
                        break

                target_lbl = target_lbl_dir / f"{stem}.txt"
                if lbl_found and lbl_found.exists():
                    lines = lbl_found.read_text(encoding="utf-8", errors="ignore").splitlines()
                    out_lines = []
                    for line in lines:
                        parts = line.strip().split()
                        if len(parts) >= 5:
                            if generalize_class:
                                # Remap all classes to 0 (unified single class e.g. weapon)
                                parts[0] = "0"
                            out_lines.append(" ".join(parts))
                    target_lbl.write_text("\n".join(out_lines))
                else:
                    # Empty annotation (background/negative image)
                    target_lbl.write_text("")

        process_split(train_files, train_img_dir, train_lbl_dir)
        process_split(val_files, val_img_dir, val_lbl_dir)

        # Build data.yaml
        class_names = [generalize_class] if generalize_class else (target_classes or ["object"])
        yaml_content = (
            f"path: {dataset_root.resolve().as_posix()}\n"
            f"train: train/images\n"
            f"val: val/images\n"
            f"nc: {len(class_names)}\n"
            f"names: {class_names}\n"
        )
        data_yaml = dataset_root / "data.yaml"
        data_yaml.write_text(yaml_content)
        logger.info(f"Dataset prepared with {len(train_files)} train, {len(val_files)} val images")
        return data_yaml

    def train(
        self,
        data_yaml: Path,
        epochs: int = 30,
        batch: int = 16,
        imgsz: int = 640,
        device: Optional[str] = None,
    ) -> Path:
        """Run YOLO training using Ultralytics with GPU support."""
        try:
            import torch
            from ultralytics import YOLO
        except ImportError:
            raise RuntimeError("ultralytics or torch is not installed.")

        if device is None:
            device = "0" if torch.cuda.is_available() else "cpu"

        logger.info(f"Starting YOLO training: SOP={self.sop_name}, model={self.base_model}, device={device}, epochs={epochs}")
        self.write_progress("TRAINING", epoch=0, total_epochs=epochs, message="Initializing YOLO model...")

        model = YOLO(self.base_model)

        class ProgressCallback:
            def __init__(self, trainer_inst):
                self.trainer_inst = trainer_inst

            def on_train_epoch_end(self, yolo_trainer):
                ep = getattr(yolo_trainer, "epoch", 0) + 1
                t_ep = getattr(yolo_trainer, "epochs", epochs)
                loss_items = getattr(yolo_trainer, "loss_items", None)
                box_l = float(loss_items[0]) if loss_items is not None and len(loss_items) > 0 else 0.0
                cls_l = float(loss_items[1]) if loss_items is not None and len(loss_items) > 1 else 0.0
                
                # Validation metrics
                validator = getattr(yolo_trainer, "validator", None)
                metrics = getattr(validator, "metrics", None) if validator else None
                m50 = 0.0
                if metrics and hasattr(metrics, "results_dict"):
                    m50 = float(metrics.results_dict.get("metrics/mAP50(B)", 0.0))

                self.trainer_inst.write_progress(
                    "TRAINING",
                    epoch=ep,
                    total_epochs=t_ep,
                    box_loss=box_l,
                    cls_loss=cls_l,
                    map50=m50,
                    message=f"Completed epoch {ep}/{t_ep}",
                )

        callback = ProgressCallback(self)
        model.add_callback("on_train_epoch_end", callback.on_train_epoch_end)

        run_project = self.sop_dir / "runs"
        results = model.train(
            data=str(data_yaml.resolve()),
            epochs=epochs,
            batch=batch,
            imgsz=imgsz,
            device=device,
            project=str(run_project),
            name="train",
            exist_ok=True,
            verbose=True,
        )

        # Identify best.pt weights
        best_pt = run_project / "train" / "weights" / "best.pt"
        if not best_pt.exists():
            # Fallback to last.pt if best.pt not found
            last_pt = run_project / "train" / "weights" / "last.pt"
            if last_pt.exists():
                best_pt = last_pt
            else:
                raise FileNotFoundError(f"Trained weights not found in {run_project / 'train' / 'weights'}")

        # Compute final mAP50
        final_map50 = 0.0
        try:
            res_dict = getattr(results, "results_dict", None)
            if isinstance(res_dict, dict):
                final_map50 = float(res_dict.get("metrics/mAP50(B)", 0.0))
        except Exception:
            pass

        # Deploy best.pt to models directory
        return self.deploy(best_pt, map50=final_map50, epochs=epochs)

    def deploy(self, best_pt: Path, map50: float = 0.0, epochs: int = 0) -> Path:
        """Deploy weights to MODELS_DIR and update ModelRegistry."""
        dest_model = MODELS_DIR / f"{self.sop_name}.pt"
        shutil.copy2(best_pt, dest_model)
        logger.info(f"Model saved → {dest_model}")

        # Register in ModelRegistry
        try:
            from .model_registry import ModelRegistry
            registry = ModelRegistry()
            registry.register(
                sop_name=self.sop_name,
                model_path=str(dest_model.resolve()),
                map50=round(map50, 4),
                epochs=epochs,
                notes=f"Auto-trained ({self.base_model})",
                title=self.title,
                description=self.description,
                alert_title=self.alert_title,
                alert_message=self.alert_message,
                alert_severity=self.alert_severity,
                target_class=self.target_class,
            )
        except Exception as reg_err:
            logger.warning(f"Could not register model in registry: {reg_err}")

        self.write_progress(
            "COMPLETED",
            epoch=epochs,
            total_epochs=epochs,
            map50=map50,
            message=f"Training finished successfully. Model deployed as '{self.sop_name}.pt'.",
        )
        return dest_model



def run_training_job(
    zip_path: str,
    sop_name: str,
    generalize_weapon: bool = True,
    target_class: Optional[str] = "weapon",
    title: Optional[str] = None,
    description: Optional[str] = None,
    alert_title: Optional[str] = None,
    alert_message: Optional[str] = None,
    alert_severity: Optional[str] = "HIGH",
    epochs: int = 30,
    batch_size: int = 16,
    base_model: str = "yolov8n.pt",
    device: Optional[str] = None,
) -> Path:
    """Execute complete end-to-end training pipeline."""
    target = "weapon" if generalize_weapon else (target_class or "object")
    trainer = DatasetTrainer(
        sop_name=sop_name,
        base_model=base_model,
        title=title,
        description=description,
        alert_title=alert_title,
        alert_message=alert_message,
        alert_severity=alert_severity,
        target_class=target,
    )
    try:
        raw_dir = trainer.extract_zip(zip_path)
        data_yaml = trainer.prepare_dataset(raw_dir, generalize_class=target if generalize_weapon else None, target_classes=[target])
        output_model = trainer.train(data_yaml, epochs=epochs, batch=batch_size, device=device)
        return output_model
    except Exception as e:
        logger.exception(f"Training failed: {e}")
        trainer.write_progress("FAILED", error=str(e), message="Training job failed.")
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="YOLO Dataset Trainer")
    parser.add_argument("--zip", type=str, required=True, help="Path to dataset ZIP file")
    parser.add_argument("--sop", type=str, required=True, help="SOP name (e.g. weapon_detection)")
    parser.add_argument("--title", type=str, default=None, help="Display name/title for what this SOP is")
    parser.add_argument("--description", type=str, default=None, help="Why this SOP is being trained")
    parser.add_argument("--alert-title", type=str, default=None, help="Alert headline to generate")
    parser.add_argument("--alert-message", type=str, default=None, help="Alert message description")
    parser.add_argument("--alert-severity", type=str, default="HIGH", help="Alert severity (LOW, MEDIUM, HIGH, CRITICAL)")
    parser.add_argument("--target-class", type=str, default="weapon", help="Target class name")
    parser.add_argument("--generalize-weapon", action="store_true", default=False, help="Remap classes to unified 'weapon'")
    parser.add_argument("--epochs", type=int, default=30, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model architecture")
    parser.add_argument("--device", type=str, default=None, help="Device (0, cpu, etc.)")
    args = parser.parse_args()

    run_training_job(
        zip_path=args.zip,
        sop_name=args.sop,
        generalize_weapon=args.generalize_weapon,
        target_class=args.target_class,
        title=args.title,
        description=args.description,
        alert_title=args.alert_title,
        alert_message=args.alert_message,
        alert_severity=args.alert_severity,
        epochs=args.epochs,
        batch_size=args.batch,
        base_model=args.model,
        device=args.device,
    )

