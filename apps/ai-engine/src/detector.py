import cv2
from ultralytics import YOLO
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Detector:
    def __init__(self, model_name='yolov8n.pt'):
        logger.info(f"Loading model {model_name}...")
        self.model = YOLO(model_name)
        # Class names for COCO dataset
        self.target_classes = ['person', 'car', 'motorcycle', 'bus', 'truck', 'dog', 'cat', 'bird']

    def detect(self, frame):
        results = self.model(frame, verbose=False)
        detections = []

        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls = int(box.cls[0])
                label = self.model.names[cls]
                conf = float(box.conf[0])

                if label in self.target_classes:
                    x1, y1, x2, y2 = box.xyxy[0]
                    detections.append({
                        'object_type': label,
                        'confidence': conf,
                        'bbox': [float(x1), float(y1), float(x2), float(y2)]
                    })

        return detections
