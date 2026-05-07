import cv2
import numpy as np
import time
import logging

logger = logging.getLogger(__name__)

class StreamHandler:
    def __init__(self, source=0):
        self.source = source
        self.cap = None

    def start(self):
        logger.info(f"Starting stream from source: {self.source}")
        # In a real scenario, this would be cv2.VideoCapture(self.source)
        # For mock, we'll just return a placeholder or handle it in get_frame
        pass

    def get_frame(self):
        # Return a dummy frame for now
        # Create a black image with some text
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(frame, f"Mock Stream {self.source} - {time.time()}", (50, 240),
                    cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        return frame

    def stop(self):
        if self.cap:
            self.cap.release()
