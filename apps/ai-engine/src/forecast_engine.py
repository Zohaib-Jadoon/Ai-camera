"""
Predictive Forecasting Engine.

Uses simple time-series analysis to forecast crowd density, traffic patterns,
and detection trends. This provides actionable intelligence like:
  - "Expect high foot traffic between 2-4 PM based on historical patterns"
  - "Vehicle congestion likely in next 30 minutes"

Methods:
  1. Moving Average with trend projection
  2. Seasonal decomposition (hour-of-day patterns)
  3. Exponential smoothing for real-time predictions

Does NOT require heavy ML frameworks — uses only numpy for lightweight operation.
"""
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class ForecastConfig:
    """Configuration for predictive forecasting."""
    # How many hours of history to retain for pattern analysis
    history_hours: int = 168  # 1 week
    # Forecast window (hours ahead)
    forecast_hours: int = 4
    # Bucket size for aggregation (minutes)
    bucket_minutes: int = 15
    # Smoothing factor for exponential smoothing (0-1, higher = more reactive)
    alpha: float = 0.3
    # Minimum data points before generating forecasts
    min_data_points: int = 20


@dataclass
class TimeSeriesPoint:
    """A single point in the time series."""
    timestamp: float
    count: int
    camera_id: str
    object_type: str


class ForecastEngine:
    """Predictive forecasting for crowd and traffic patterns."""

    def __init__(self, config: Optional[ForecastConfig] = None):
        self.config = config or ForecastConfig()
        # Raw event history: list of TimeSeriesPoints
        self._history: list[TimeSeriesPoint] = []
        # Hourly pattern cache: hour_of_day (0-23) -> average count
        self._hourly_patterns: dict[int, float] = {}
        # Per-camera patterns
        self._camera_patterns: dict[str, dict[int, float]] = {}
        self._last_pattern_update = 0.0
        self._pattern_update_interval = 300.0  # rebuild patterns every 5 min

    def record_event(self, camera_id: str, object_type: str, count: int = 1) -> None:
        """Record a detection/event for pattern analysis."""
        now = time.time()
        self._history.append(TimeSeriesPoint(
            timestamp=now,
            count=count,
            camera_id=camera_id,
            object_type=object_type,
        ))

        # Evict old history
        cutoff = now - (self.config.history_hours * 3600)
        self._history = [p for p in self._history if p.timestamp > cutoff]

    def _update_patterns(self) -> None:
        """Rebuild hourly patterns from history."""
        now = time.time()
        if (now - self._last_pattern_update) < self._pattern_update_interval:
            return
        self._last_pattern_update = now

        if len(self._history) < self.config.min_data_points:
            return

        from datetime import datetime

        # Global hourly pattern
        hourly_counts: dict[int, list[int]] = defaultdict(list)
        camera_hourly: dict[str, dict[int, list[int]]] = defaultdict(lambda: defaultdict(list))

        # Group by hour-of-day buckets
        bucket_size = self.config.bucket_minutes * 60
        bucket_counts: dict[str, int] = defaultdict(int)

        for point in self._history:
            dt = datetime.fromtimestamp(point.timestamp)
            hour = dt.hour
            bucket_key = f"{dt.date()}:{hour}:{dt.minute // self.config.bucket_minutes}"
            bucket_counts[bucket_key] += point.count

        # Now aggregate by hour
        for bucket_key, count in bucket_counts.items():
            parts = bucket_key.split(":")
            hour = int(parts[1])
            hourly_counts[hour].append(count)

        # Compute averages
        for hour, counts in hourly_counts.items():
            self._hourly_patterns[hour] = float(np.mean(counts))

        # Per-camera patterns
        camera_bucket_counts: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
        for point in self._history:
            dt = datetime.fromtimestamp(point.timestamp)
            hour = dt.hour
            bucket_key = f"{dt.date()}:{hour}:{dt.minute // self.config.bucket_minutes}"
            camera_bucket_counts[point.camera_id][bucket_key] += point.count

        for cam_id, buckets in camera_bucket_counts.items():
            cam_hourly: dict[int, list[int]] = defaultdict(list)
            for bucket_key, count in buckets.items():
                hour = int(bucket_key.split(":")[1])
                cam_hourly[hour].append(count)
            self._camera_patterns[cam_id] = {
                hour: float(np.mean(counts)) for hour, counts in cam_hourly.items()
            }

        logger.debug("Forecast patterns updated: %d hours, %d cameras",
                      len(self._hourly_patterns), len(self._camera_patterns))

    def forecast(self, camera_id: Optional[str] = None) -> list[dict]:
        """
        Generate hourly forecasts for the next N hours.
        Returns: [{ hour, predicted_count, confidence, trend }]
        """
        self._update_patterns()

        if not self._hourly_patterns:
            return []

        from datetime import datetime, timedelta

        patterns = self._camera_patterns.get(camera_id, self._hourly_patterns) if camera_id else self._hourly_patterns
        if not patterns:
            patterns = self._hourly_patterns

        now = datetime.now()
        forecasts = []

        # Get recent trend (last hour vs previous hour)
        recent_count = sum(1 for p in self._history if p.timestamp > time.time() - 3600)
        prev_count = sum(1 for p in self._history if time.time() - 7200 < p.timestamp <= time.time() - 3600)
        trend_factor = 1.0
        if prev_count > 0:
            trend_factor = recent_count / prev_count

        for h_offset in range(self.config.forecast_hours):
            future_hour = (now + timedelta(hours=h_offset + 1)).hour
            base_prediction = patterns.get(future_hour, 0)

            # Apply trend correction with exponential decay
            decay = self.config.alpha ** (h_offset + 1)
            adjusted = base_prediction * (1 + (trend_factor - 1) * decay)

            # Confidence decreases with forecast horizon
            confidence = max(0.3, 1.0 - (h_offset * 0.15))

            trend = "stable"
            if trend_factor > 1.2:
                trend = "increasing"
            elif trend_factor < 0.8:
                trend = "decreasing"

            forecasts.append({
                "hour": future_hour,
                "hour_label": f"{future_hour:02d}:00",
                "predicted_count": round(max(0, adjusted), 1),
                "confidence": round(confidence, 2),
                "trend": trend,
            })

        return forecasts

    def get_anomalies(self, camera_id: Optional[str] = None) -> list[dict]:
        """
        Detect anomalies by comparing current activity to historical patterns.
        Returns: [{ hour, expected, actual, deviation_pct, is_anomaly }]
        """
        self._update_patterns()

        if not self._hourly_patterns:
            return []

        from datetime import datetime

        patterns = self._camera_patterns.get(camera_id, self._hourly_patterns) if camera_id else self._hourly_patterns
        now = datetime.now()
        current_hour = now.hour

        # Count events in the current hour
        hour_start = time.time() - (now.minute * 60 + now.second)
        actual = sum(1 for p in self._history if p.timestamp >= hour_start)
        expected = patterns.get(current_hour, 0)

        anomalies = []
        if expected > 0:
            deviation = ((actual - expected) / expected) * 100
            is_anomaly = abs(deviation) > 50  # 50% deviation = anomaly

            anomalies.append({
                "hour": current_hour,
                "expected": round(expected, 1),
                "actual": actual,
                "deviation_pct": round(deviation, 1),
                "is_anomaly": is_anomaly,
                "message": (
                    f"Current activity is {abs(deviation):.0f}% {'above' if deviation > 0 else 'below'} expected"
                    if is_anomaly else "Activity is within normal range"
                ),
            })

        return anomalies

    def get_stats(self) -> dict:
        """Return statistics about the forecasting data."""
        return {
            "total_events": len(self._history),
            "hours_of_data": round((time.time() - self._history[0].timestamp) / 3600, 1) if self._history else 0,
            "cameras_tracked": len(self._camera_patterns),
            "pattern_hours": len(self._hourly_patterns),
        }
