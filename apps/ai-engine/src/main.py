import cv2
import asyncio
import logging
import socketio
import uuid
from datetime import datetime
import os
import numpy as np
from src.detector import Detector
from src.stream_handler import StreamHandler
from src.advanced_ai import FaceProcessor, IntrusionDetector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi import FastAPI
app = FastAPI(title="Madad Vision AI - Engine")

detector = Detector()
face_processor = FaceProcessor()
intrusion_detector = IntrusionDetector()

# Socket.IO client to connect to backend
sio = socketio.AsyncClient()
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:3000')

active_streams = {}

@app.get("/")
async def root():
    return {"message": "AI Engine is running", "socket_connected": sio.connected, "active_streams": list(active_streams.keys())}

async def processing_loop():
    logger.info("Starting AI processing loop...")
    if not active_streams:
        active_streams['camera-1'] = StreamHandler(source=0)

    while True:
        try:
            if not sio.connected:
                try:
                    await sio.connect(BACKEND_URL)
                    logger.info(f"Connected to backend at {BACKEND_URL}")
                except Exception as e:
                    logger.error(f"Failed to connect to backend: {e}")
                    await asyncio.sleep(5)
                    continue

            for camera_id, handler in list(active_streams.items()):
                frame = handler.get_frame()

                # 1. Object Detection & Tracking
                detections = detector.detect(frame)

                # 2. Face Recognition
                faces = face_processor.detect_and_recognize(frame)

                # 3. Intrusion Detection
                intrusions = intrusion_detector.check_intrusion(detections)

                # Emit Detections
                for det in detections:
                    await sio.emit('detection', {
                        'id': str(uuid.uuid4()),
                        'camera_id': camera_id,
                        'object_type': det['object_type'],
                        'confidence': det['confidence'],
                        'bbox': det['bbox'],
                        'track_id': det.get('track_id'),
                        'timestamp': datetime.utcnow().isoformat() + 'Z'
                    })

                # Emit Face Events
                for face in faces:
                    await sio.emit('face_event', {
                        'id': str(uuid.uuid4()),
                        'camera_id': camera_id,
                        'person_id': face.get('person_id'),
                        'person_name': face.get('person_name'),
                        'is_known': face['is_known'],
                        'confidence': face['confidence'],
                        'bbox': face['bbox'],
                        'timestamp': datetime.utcnow().isoformat() + 'Z'
                    })

                # Emit Intrusion Alerts
                for intrusion in intrusions:
                    await sio.emit('alert', {
                        'id': str(uuid.uuid4()),
                        'event_id': str(uuid.uuid4()),
                        'alert_type': 'INTRUSION',
                        'camera_id': camera_id,
                        'confidence': intrusion['confidence'],
                        'timestamp': datetime.utcnow().isoformat() + 'Z'
                    })

            await asyncio.sleep(0.5)
        except Exception as e:
            logger.error(f"Error in processing loop: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(processing_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
