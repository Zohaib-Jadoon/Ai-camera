"""Deterministic multi-entity tracking regressions, independent of model weights."""
import unittest
from src.tracker import ObjectTracker


def detection(label, x):
    return {'object_type': label, 'confidence': 0.9, 'box': [x, 0, x + 50, 100]}


class MultiEntityTests(unittest.TestCase):
    def test_two_overlapping_people_remain_separate_entities(self):
        tracker = ObjectTracker()
        output = tracker.update([detection('person', 0), detection('person', 10)])
        self.assertEqual(len(output), 2)
        self.assertEqual(len({d['track_id'] for d in output}), 2)

    def test_repeated_multi_person_frames_keep_track_state_bounded(self):
        tracker = ObjectTracker()
        frame = [detection('person', x * 100) for x in range(8)]
        expected = {d['track_id'] for d in tracker.update(frame)}
        for _ in range(1000):
            self.assertEqual({d['track_id'] for d in tracker.update(frame)}, expected)
            self.assertEqual(len(tracker._tracks), 8)
            self.assertTrue(all(len(t._box_history) <= 10 for t in tracker._tracks.values()))

    def test_multiple_people_and_classes_keep_distinct_ids_when_reordered(self):
        tracker = ObjectTracker()
        frame = [detection('person', 0), detection('car', 300), detection('person', 100)]
        first = tracker.update(frame)
        second = tracker.update(list(reversed(frame)))
        self.assertEqual(len(second), 3)
        self.assertEqual({x['track_id'] for x in first}, {x['track_id'] for x in second})
        self.assertEqual(len({x['track_id'] for x in second}), 3)

    def test_pose_and_segmentation_survive_tracking_for_each_person(self):
        tracker = ObjectTracker()
        first = detection('person', 0)
        second = detection('person', 100)
        first['keypoints'] = [[1, 2, 0.9]]
        second['keypoints'] = [[110, 2, 0.8]]
        first['mask'] = [[0, 0], [50, 100]]
        output = tracker.update([first, second])
        self.assertEqual([x['keypoints'] for x in output], [first['keypoints'], second['keypoints']])
        self.assertEqual(output[0]['mask'], first['mask'])

    def test_occluded_tracks_are_not_reported_as_visible_and_expire(self):
        tracker = ObjectTracker(max_disappeared=2)
        old = tracker.update([detection('person', 0)])[0]['track_id']
        for _ in range(4):
            self.assertEqual(tracker.update([]), [])
        self.assertNotEqual(tracker.update([detection('person', 0)])[0]['track_id'], old)

    def test_camera_trackers_have_independent_identity(self):
        a = ObjectTracker().update([detection('person', 0)])
        b = ObjectTracker().update([detection('person', 0)])
        self.assertNotEqual(a[0]['track_id'], b[0]['track_id'])
