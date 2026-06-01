"""
StreamHandler — production RTSP/webcam video capture.
Uses a background thread to decode frames at full speed so the
main async processing loop never blocks on cap.read().
"""
from __future__ import annotations
import cv2
import numpy as np
import threading
import logging
import time

logger = logging.getLogger(__name__)

_RECONNECT_BASE_DELAY = 5.0   # starting delay in seconds
_RECONNECT_MAX_DELAY  = 60.0  # cap at 60 seconds



class StreamHandler:
    """
    Thread-backed video capture with automatic reconnection.

    Usage:
        stream = StreamHandler(source="rtsp://...")
        stream.start()
        frame = stream.get_frame()
        stream.stop()
    """

    def __init__(self, source: str | int = 0):
        self.source = source
        self.frame_count: int = 0
        self._cap: cv2.VideoCapture | None = None
        self._lock = threading.Lock()
        self._latest_frame: np.ndarray | None = None
        self._running = False
        self._thread: threading.Thread | None = None
        self._connected = False  # tracks whether stream is actually delivering frames
        self._fail_count: int = 0  # consecutive open failures for backoff


    def start(self) -> None:
        """Start the background read thread. Stream opens inside the thread."""
        self._running = True
        self._thread = threading.Thread(target=self._read_loop, daemon=True)
        self._thread.start()
        logger.info(f"StreamHandler started: {self.source}")

    def _open(self) -> bool:
        """Open capture, return True on success.

        Key changes:
        - TCP pre-check via socket.connect_ex before touching FFmpeg.
          If the port is not reachable, we skip all 8 URL candidates instantly
          instead of waiting 8s × 8 = 64s (which would starve Socket.IO heartbeats).
        - 3s timeout per candidate (not 8s) to keep total block time short.
        - Tries common mobile-app RTSP paths automatically.
        """
        import socket as _socket

        src = int(self.source) if str(self.source).isdigit() else self.source

        if isinstance(src, str):
            # ── TCP pre-check ───────────────────────────────────────────────
            # Parse host:port from the RTSP URL.  If the TCP port isn't open,
            # skip all OpenCV/FFmpeg attempts entirely — they'd just block for
            # timeout × n_candidates seconds while holding the GIL.
            try:
                from urllib.parse import urlparse
                parsed = urlparse(src)
                host = parsed.hostname or ""
                port = parsed.port or 554
                sock = _socket.socket(_socket.AF_INET, _socket.SOCK_STREAM)
                sock.settimeout(1.0)           # 1-second TCP handshake check
                result = sock.connect_ex((host, port))
                sock.close()
                if result != 0:
                    # Port closed / host unreachable — no point trying OpenCV
                    self._connected = False
                    logger.debug(
                        f"TCP pre-check failed for {host}:{port} (err={result}) "
                        f"— skipping RTSP open"
                    )
                    return False
                logger.debug(f"TCP pre-check OK for {host}:{port} — trying RTSP")
            except Exception as tcp_err:
                logger.debug(f"TCP pre-check exception: {tcp_err}")
                # Continue anyway — let OpenCV try

            # ── Build URL candidate list ────────────────────────────────────
            base = src.rstrip('/')
            candidates = [src]
            if src.endswith('/') or src.count('/') <= 2:
                candidates += [
                    f"{base}/h264_ulaw.sdp",   # IP Webcam (Android)
                    f"{base}/video",            # IP Webcam alternative
                    f"{base}/live",             # DJI / generic
                    f"{base}/h264",             # iVCam / generic
                    f"{base}/stream",           # various apps
                    f"{base}/0",                # MediaMTX / go2rtc
                    f"{base}/cam",              # various
                ]

            for url in candidates:
                logger.info(f"Trying RTSP URL: {url}")
                # 3s timeout — short enough to try all candidates before the
                # Socket.IO ping interval (25s) fires.
                cap = cv2.VideoCapture(
                    url,
                    cv2.CAP_FFMPEG,
                    [
                        cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 3_000,
                        cv2.CAP_PROP_READ_TIMEOUT_MSEC, 3_000,
                    ],
                )
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

                if cap.isOpened():
                    self._cap = cap
                    self._connected = True
                    if url != src:
                        logger.info(
                            f"Stream opened on alternative path: {url} "
                            f"(update your camera RTSP URL to this)"
                        )
                    else:
                        logger.info(f"Stream opened: {url}")
                    return True

                cap.release()

            self._connected = False
            logger.error(
                f"Cannot open stream: {self.source}\n"
                f"  Tried {len(candidates)} URL(s). Check:\n"
                f"  1. PC and phone on the SAME WiFi (no AP Isolation)\n"
                f"  2. Mobile app RTSP URL — look in the app's settings\n"
                f"  3. Firewall allowing inbound connections on the port"
            )
            return False
        else:
            cap = cv2.VideoCapture(src)
            if cap.isOpened():
                self._cap = cap
                self._connected = True
                return True
            cap.release()
            self._connected = False
            logger.error(f"Cannot open webcam index: {self.source}")
            return False

    def _read_loop(self) -> None:
        """Background thread that continuously reads frames."""
        while self._running:
            if self._cap is None or not self._cap.isOpened():
                self._connected = False
                # Exponential backoff: 5s, 10s, 20s, 40s, 60s (capped)
                delay = min(
                    _RECONNECT_BASE_DELAY * (2 ** self._fail_count),
                    _RECONNECT_MAX_DELAY,
                )
                logger.warning(
                    f"Stream {self.source} disconnected — reconnecting in {delay:.0f}s"
                )
                time.sleep(delay)
                success = self._open()
                if success:
                    self._fail_count = 0
                else:
                    self._fail_count += 1
                continue

            ret, frame = self._cap.read()
            if ret and frame is not None:
                with self._lock:
                    self._latest_frame = frame
                    self.frame_count += 1
                    if not self._connected:
                        self._connected = True
                        self._fail_count = 0  # reset backoff on first successful frame
            else:
                logger.warning(f"Frame read failed for {self.source}")
                time.sleep(0.5)

    def get_frame(self) -> np.ndarray:
        """Return the most recent frame decoded by the background thread."""
        with self._lock:
            if self._latest_frame is not None:
                return self._latest_frame.copy()

        # Return a black placeholder if no frame is available yet
        placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(
            placeholder,
            f"Connecting... {self.source}",
            (40, 240),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (200, 200, 200),
            2,
        )
        return placeholder

    def stop(self) -> None:
        self._running = False
        self._connected = False
        if self._thread:
            self._thread.join(timeout=2.0)
        if self._cap:
            self._cap.release()
            self._cap = None
        logger.info(f"StreamHandler stopped: {self.source}")

    @property
    def is_running(self) -> bool:
        return self._running

    @property
    def is_online(self) -> bool:
        """True when the stream is open and delivering frames."""
        return self._connected
