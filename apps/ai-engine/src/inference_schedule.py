"""Bounded inference cadence, independent of display frame rate."""
import math


class InferenceSchedule:
    """Guarantee periodic scans even when motion detection sees no changes."""

    def __init__(self, fps=10.0, idle_interval=0.5, continuous=False):
        if not math.isfinite(fps) or fps <= 0:
            raise ValueError('Inference FPS must be positive and finite')
        if not math.isfinite(idle_interval) or idle_interval <= 0:
            raise ValueError('Idle scan interval must be positive and finite')
        self.interval = 1.0 / fps
        self.idle_interval = max(self.interval, idle_interval)
        self.continuous = continuous
        self.last_scan = float('-inf')

    def due(self, now, motion=False, threat=False):
        """Return whether a fresh frame should be scanned at this time."""
        interval = self.interval if self.continuous or motion or threat else self.idle_interval
        return now - self.last_scan >= interval

    def started(self, now):
        """Record an actual inference start, not a skipped source frame."""
        self.last_scan = now
