"""Synthetic regression examples, not claims of model accuracy."""
import unittest
from src.evaluate import evaluate


class EvaluationTests(unittest.TestCase):
    def test_duplicates_misses_latency_and_camera_hour_denominator(self):
        result = evaluate([{'camera_id': 'one', 'condition': 'darkness', 'duration_s': 3600,
            'truth': [{'label': 'person', 'start_s': 10, 'end_s': 30}, {'label': 'car', 'start_s': 40, 'end_s': 50}],
            'predictions': [{'label': 'person', 'observed_s': 12, 'alerted_s': 14},
                            {'label': 'person', 'observed_s': 13, 'alerted_s': 15}]}])
        self.assertEqual(result['overall']['precision'], 0.5)
        self.assertEqual(result['overall']['recall'], 0.5)
        self.assertEqual(result['overall']['false_alarms_per_camera_hour'], 1)
        self.assertEqual(result['darkness']['incident_to_alert_p95_s'], 4)

    def test_no_events_is_not_reported_as_perfect_accuracy(self):
        result = evaluate([{'camera_id': 'one', 'condition': 'crowded', 'duration_s': 60, 'truth': [], 'predictions': []}])
        self.assertIsNone(result['overall']['recall'])

    def test_invalid_exposure_is_rejected(self):
        with self.assertRaises(ValueError):
            evaluate([{'duration_s': 0}])
