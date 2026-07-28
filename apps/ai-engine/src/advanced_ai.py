import cv2
import numpy as np

class FaceProcessor:
    def __init__(self):
        # In real app, load RetinaFace/ArcFace models here
        self.known_embeddings = {} # {id: embedding}
        self.known_names = {} # {id: name}

    def detect_and_recognize(self, frame):
        # Mock face detection and recognition
        # Returning random detections for demonstration
        faces = []
        # Simulate a face found occasionally
        if np.random.random() > 0.8:
            faces.append({
                'is_known': True,
                'person_id': 'user-1',
                'person_name': 'John Doe',
                'confidence': 0.95,
                'bbox': [100, 100, 200, 200]
            })
        return faces

class IntrusionDetector:
    def __init__(self):
        self.zones = [] # List of polygons

    def update_zones(self, zones):
        self.zones = zones

    def check_intrusion(self, detections):
        # detections: list of {object_type, bbox}
        intrusions = []
        for det in detections:
            # Mock intrusion logic: if object is 'person' and in a zone
            # For mock, we just say if it's a person it might be an intrusion
            if det['object_type'] == 'person' and np.random.random() > 0.5:
                intrusions.append(det)
        return intrusions
