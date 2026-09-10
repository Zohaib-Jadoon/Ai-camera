"""Unit tests for DatasetTrainer pipeline."""
import json
import os
from pathlib import Path
import tempfile
import unittest
import zipfile
from unittest.mock import patch

from PIL import Image

from src.dataset_trainer import DatasetTrainer
from src.model_registry import ModelRegistry


class DatasetTrainerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.root = Path(self.temp_dir.name)
        self.training_dir = self.root / "training_data"
        self.models_dir = self.root / "models"
        self.training_dir.mkdir(parents=True, exist_ok=True)
        self.models_dir.mkdir(parents=True, exist_ok=True)

        # Patch paths in dataset_trainer and model_registry
        self.p1 = patch("src.dataset_trainer.TRAINING_DATA_ROOT", self.training_dir)
        self.p2 = patch("src.dataset_trainer.MODELS_DIR", self.models_dir)
        self.p3 = patch("src.model_registry.MODELS_DIR", self.models_dir)
        self.p4 = patch("src.model_registry.REGISTRY_PATH", self.models_dir / "registry.json")
        self.p1.start()
        self.p2.start()
        self.p3.start()
        self.p4.start()

    def tearDown(self):
        self.p1.stop()
        self.p2.stop()
        self.p3.stop()
        self.p4.stop()
        self.temp_dir.cleanup()

    def _create_dummy_zip(self, num_images: int = 5, multi_class: bool = True) -> Path:
        """Create a mock dataset zip containing images and yolo txt annotations."""
        zip_path = self.root / "sample_dataset.zip"
        with zipfile.ZipFile(zip_path, "w") as zf:
            for i in range(num_images):
                img_name = f"frame_{i}.jpg"
                img = Image.new("RGB", (64, 64), color=(i * 20, 100, 150))
                img_temp = self.root / img_name
                img.save(img_temp, "JPEG")
                zf.write(img_temp, arcname=f"images/{img_name}")

                lbl_name = f"frame_{i}.txt"
                lbl_temp = self.root / lbl_name
                # If multi-class: assign class id i % 3 (e.g., 0=knife, 1=bat, 2=gun)
                cls_id = (i % 3) if multi_class else 0
                lbl_temp.write_text(f"{cls_id} 0.5 0.5 0.2 0.2\n")
                zf.write(lbl_temp, arcname=f"labels/{lbl_name}")

        return zip_path

    def test_progress_writing(self):
        trainer = DatasetTrainer("weapon_detection")
        trainer.write_progress("TRAINING", epoch=3, total_epochs=10, box_loss=0.12, cls_loss=0.05, map50=0.88, message="Epoch 3")
        
        progress_file = trainer.progress_file
        self.assertTrue(progress_file.exists())
        data = json.loads(progress_file.read_text(encoding="utf-8"))
        self.assertEqual(data["status"], "TRAINING")
        self.assertEqual(data["epoch"], 3)
        self.assertEqual(data["total_epochs"], 10)
        self.assertEqual(data["progress_pct"], 30.0)
        self.assertEqual(data["box_loss"], 0.12)
        self.assertEqual(data["cls_loss"], 0.05)
        self.assertEqual(data["map50"], 0.88)

    def test_extract_zip(self):
        zip_path = self._create_dummy_zip(num_images=5)
        trainer = DatasetTrainer("weapon_detection")
        raw_dir = trainer.extract_zip(zip_path)
        self.assertTrue(raw_dir.exists())
        self.assertTrue(len(list(raw_dir.rglob("*.jpg"))) == 5)
        self.assertTrue(len(list(raw_dir.rglob("*.txt"))) == 5)

    def test_prepare_dataset_with_weapon_generalization(self):
        """Verify that multi-class labels (knife=0, bat=1, gun=2) are unified to 0 (weapon)."""
        zip_path = self._create_dummy_zip(num_images=6, multi_class=True)
        trainer = DatasetTrainer("weapon_detection")
        raw_dir = trainer.extract_zip(zip_path)
        
        data_yaml = trainer.prepare_dataset(raw_dir, generalize_class="weapon")
        self.assertTrue(data_yaml.exists())
        yaml_text = data_yaml.read_text(encoding="utf-8")
        self.assertIn("nc: 1", yaml_text)
        self.assertIn("names: ['weapon']", yaml_text)

        dataset_root = trainer.sop_dir / "dataset"
        train_labels = list((dataset_root / "train" / "labels").glob("*.txt"))
        val_labels = list((dataset_root / "val" / "labels").glob("*.txt"))
        self.assertGreater(len(train_labels), 0)
        self.assertGreater(len(val_labels), 0)

        # Check all lines in all labels have class 0
        for lbl_p in train_labels + val_labels:
            lines = lbl_p.read_text().splitlines()
            for line in lines:
                parts = line.split()
                if parts:
                    self.assertEqual(parts[0], "0", f"Label {lbl_p} had non-zero class: {parts[0]}")

    def test_prepare_dataset_rejects_insufficient_images(self):
        zip_path = self._create_dummy_zip(num_images=2)
        trainer = DatasetTrainer("weapon_detection")
        raw_dir = trainer.extract_zip(zip_path)
        with self.assertRaises(ValueError):
            trainer.prepare_dataset(raw_dir)

    def test_deploy_updates_model_registry(self):
        trainer = DatasetTrainer("weapon_detection")
        dummy_weights = self.root / "best.pt"
        dummy_weights.write_bytes(b"dummy_weights_content")

        deployed_path = trainer.deploy(dummy_weights)
        self.assertTrue(deployed_path.exists())

        registry = ModelRegistry()
        self.assertEqual(registry.resolve("weapon_detection"), str(deployed_path))
        snapshot = registry.snapshot()
        self.assertIn("weapon_detection", snapshot)
        self.assertEqual(snapshot["weapon_detection"]["sop_name"], "weapon_detection")


if __name__ == "__main__":
    unittest.main()
