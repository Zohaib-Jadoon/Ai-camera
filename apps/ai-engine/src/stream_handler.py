"""Thread-backed capture with bounded freshness and interruptible reconnects."""
from __future__ import annotations

import os
import logging
import threading
import time
import cv2
import numpy as np

logger = logging.getLogger(__name__)


class StreamHandler:
    """Keep one decoded frame; report online only while real frames arrive."""

    MAX_FRAME_AGE = 5.0

    def __init__(self, source: str | int = 0):
        self.source = source
        self.frame_count = 0
        self._cap = None
        self._lock = threading.Lock()
        self._latest_frame = None
        self._last_frame_time = 0.0
        self._running = False
        self._connected = False
        self._thread = None
        self._stop_event = threading.Event()

    def start(self) -> None:
        """Start capture once; the capture thread owns the OpenCV resource."""
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()
        logger.info("Video capture started")

    def _open(self) -> bool:
        source = int(self.source) if str(self.source).isdigit() else self.source
        if isinstance(source, str):
            # Enforce low-latency TCP RTSP capture with zero demuxer buffering
            os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|fflags;nobuffer|flags;low_delay|max_delay;0"
            self._cap = cv2.VideoCapture(
                source, cv2.CAP_FFMPEG,
                [cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 5000,
                 cv2.CAP_PROP_READ_TIMEOUT_MSEC, 5000],
            )
        else:
            self._cap = cv2.VideoCapture(source)
        if self._cap.isOpened():
            self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            return True
        return False

    def _clear_frame(self) -> None:
        with self._lock:
            self._connected = False
            self._latest_frame = None
            self._last_frame_time = 0.0

    def _release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def _read_loop(self) -> None:
        failures = 0
        try:
            while not self._stop_event.is_set():
                try:
                    if self._cap is None:
                        if not self._open() or self._cap is None:
                            raise RuntimeError("Capture unavailable")
                    ret, frame = self._cap.read()
                    if not ret or frame is None or frame.size == 0:
                        raise RuntimeError("Frame unavailable")
                    if self._stop_event.is_set():
                        break
                    with self._lock:
                        self._latest_frame = frame
                        self.frame_count += 1
                        self._last_frame_time = time.monotonic()
                        self._connected = True
                    failures = 0
                except Exception:
                    self._clear_frame()
                    self._release()
                    delay = min(5.0 * (2 ** min(failures, 4)), 60.0)
                    failures += 1
                    # Never log the source or native diagnostics: they can contain credentials.
                    logger.warning("Video capture interrupted; retrying in %.0fs", delay)
                    self._stop_event.wait(delay)
        finally:
            self._clear_frame()
            self._release()
            self._running = False

    def get_frame_with_sequence(self) -> tuple[np.ndarray | None, int]:
        """Return only a fresh frame and its sequence, atomically."""
        with self._lock:
            if (self._connected and self._latest_frame is not None
                    and time.monotonic() - self._last_frame_time <= self.MAX_FRAME_AGE):
                return self._latest_frame.copy(), self.frame_count
            return None, self.frame_count

    def get_frame(self) -> np.ndarray | None:
        """Return a fresh decoded frame or None; never fabricate placeholder footage."""
        return self.get_frame_with_sequence()[0]

    def stop(self) -> None:
        """Signal capture shutdown without releasing a resource another thread is using."""
        self._running = False
        self._stop_event.set()
        self._clear_frame()
        if self._thread and self._thread is not threading.current_thread():
            self._thread.join(timeout=2.0)
        logger.info("Video capture stopped")

    @property
    def is_running(self) -> bool:
        """Whether capture has been started and not stopped."""
        return self._running

    @property
    def is_online(self) -> bool:
        """Whether the capture thread has recently delivered a real frame."""
        with self._lock:
            return (self._running and self._connected and self._latest_frame is not None
                    and time.monotonic() - self._last_frame_time <= self.MAX_FRAME_AGE)
