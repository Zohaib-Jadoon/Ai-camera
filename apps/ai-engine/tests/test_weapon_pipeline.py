"""Weapon scheduling and model routing regressions; no weights/downloads required."""
import ast
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from src.inference_schedule import InferenceSchedule
from src.model_registry import ModelRegistry


class SchedulingTests(unittest.TestCase):
    def test_stationary_object_is_scanned_without_prior_threat(self):
        schedule = InferenceSchedule(fps=10, idle_interval=.5)
        self.assertTrue(schedule.due(0))
        schedule.started(0)
        self.assertFalse(schedule.due(.1))
        self.assertTrue(schedule.due(.5))

    def test_weapon_mode_is_continuous_but_bounded(self):
        schedule = InferenceSchedule(fps=10, continuous=True)
        schedule.started(0)
        self.assertFalse(schedule.due(.05))
        self.assertTrue(schedule.due(.1))

    def test_motion_and_threat_use_active_cadence(self):
        schedule = InferenceSchedule(fps=10)
        schedule.started(0)
        self.assertTrue(schedule.due(.1, motion=True))
        self.assertTrue(schedule.due(.1, threat=True))

    def test_invalid_config_rejected(self):
        for fps in (0, -1, float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                InferenceSchedule(fps=fps)


class RoutingTests(unittest.TestCase):
    def registry(self, data=None):
        registry = ModelRegistry.__new__(ModelRegistry)
        registry._data = data or {}
        return registry

    def test_weapon_alias_and_general_default(self):
        with patch.dict(os.environ, {}, clear=True):
            registry = self.registry()
            self.assertEqual(registry.resolve('weapon'), 'yolov8s-worldv2.pt')
            self.assertEqual(registry.resolve('weapon_detection'), 'yolov8s-worldv2.pt')
            self.assertEqual(registry.resolve(None), 'yolov8s-worldv2.pt')

    def test_custom_weapon_weights_take_precedence(self):
        with tempfile.TemporaryDirectory() as directory:
            weights = Path(directory) / 'custom.pt'
            weights.touch()
            registry = self.registry({'weapon_detection': {'model_path': str(weights)}})
            self.assertEqual(registry.resolve('weapon_detection'), str(weights))

    def test_missing_custom_model_does_not_silently_use_wrong_model(self):
        with tempfile.TemporaryDirectory() as directory:
            registry = self.registry({'weapon_detection': {'model_path': str(Path(directory) / 'missing.pt')}})
            with self.assertRaises(FileNotFoundError):
                registry.resolve('weapon_detection')

    def test_model_overrides_are_independent(self):
        with patch.dict(os.environ, {'YOLO_MODEL': 'general.pt', 'WEAPON_MODEL': 'weapon.pt'}):
            self.assertEqual(self.registry().resolve('weapon_detection'), 'weapon.pt')
            self.assertEqual(self.registry().resolve('general_detection'), 'general.pt')

    def test_main_routes_camera_inference_and_restarts_sop_changes(self):
        source = (Path(__file__).parents[1] / 'src' / 'main.py').read_text(encoding='utf-8')
        tree = ast.parse(source)
        process = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == 'process_camera')
        attributes = [node for node in ast.walk(process) if isinstance(node, ast.Attribute)]
        self.assertTrue(any(node.attr == 'detect' and isinstance(node.value, ast.Name) and node.value.id == 'camera_detector' for node in attributes))
        sync = next(node for node in tree.body if isinstance(node, ast.AsyncFunctionDef) and node.name == '_sync_cameras')
        self.assertTrue(any(isinstance(node, ast.Tuple) and 'sop_name' in [item.value for item in node.elts if isinstance(item, ast.Constant)] for node in ast.walk(sync)))
        self.assertIn("'firearm'", ast.get_source_segment(source, process))
