"""Offline event-level evaluation. Inputs must be independently annotated footage.

Each session defines camera_id, condition, duration_s, truth[{label,start_s,end_s}],
and predictions[{label,observed_s,alerted_s}]. One alert matches at most one incident;
duplicates are false alarms. This does not estimate accuracy from confidence scores.
"""
import argparse
import json
import math
from pathlib import Path


def evaluate(sessions):
    """Return overall and condition-stratified incident metrics."""
    buckets = {}
    if not sessions:
        raise ValueError('At least one annotated session is required')
    for session in sessions:
        duration = session['duration_s']
        if not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
            raise ValueError('Positive finite monitored duration is required')
        if not session.get('camera_id') or session.get('condition') not in ('daylight', 'darkness', 'crowded'):
            raise ValueError('Camera and declared condition are required')
        truth = session['truth']
        for event in truth:
            if not event.get('label') or not (0 <= event['start_s'] <= event['end_s'] <= duration):
                raise ValueError('Invalid ground-truth interval')
        matched, latencies, false_alarms = set(), [], 0
        for prediction in sorted(session['predictions'], key=lambda p: p['alerted_s']):
            observed, alerted = prediction['observed_s'], prediction['alerted_s']
            if not prediction.get('label') or not (0 <= observed <= alerted <= duration):
                raise ValueError('Invalid observation/alert timing')
            candidates = [i for i, event in enumerate(truth) if i not in matched
                          and event['label'] == prediction['label']
                          and event['start_s'] <= observed <= event['end_s']]
            if candidates:
                # Earliest-ending eligible interval, one-to-one matching.
                index = min(candidates, key=lambda i: truth[i]['end_s'])
                matched.add(index)
                latencies.append(alerted - truth[index]['start_s'])
            else:
                false_alarms += 1
        for key in ('overall', session['condition']):
            value = buckets.setdefault(key, {'tp': 0, 'fp': 0, 'fn': 0, 'hours': 0, 'latencies': []})
            value['tp'] += len(matched)
            value['fp'] += false_alarms
            value['fn'] += len(truth) - len(matched)
            value['hours'] += duration / 3600
            value['latencies'].extend(latencies)
    result = {}
    for key, value in buckets.items():
        tp, fp, fn = value['tp'], value['fp'], value['fn']
        times = sorted(value['latencies'])
        result[key] = {'true_incidents': tp, 'false_alarms': fp, 'missed_incidents': fn,
                       'camera_hours': value['hours'],
                       'precision': tp / (tp + fp) if tp + fp else None,
                       'recall': tp / (tp + fn) if tp + fn else None,
                       'false_alarms_per_camera_hour': fp / value['hours'],
                       'incident_to_alert_p95_s': times[math.ceil(len(times) * .95) - 1] if times else None}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('annotations', type=Path)
    args = parser.parse_args()
    print(json.dumps(evaluate(json.loads(args.annotations.read_text())), indent=2, allow_nan=False))
