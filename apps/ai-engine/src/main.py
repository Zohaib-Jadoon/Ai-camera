from fastapi import FastAPI
import asyncio
import logging
import socketio
import uuid
import os
from datetime import datetime
from src.detector import Detector
from src.stream_handler import StreamHandler
from src.advanced_ai import FaceProcessor, IntrusionDetector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Madad Vision AI - Engine")
detector = Detector()
stream_handler = StreamHandler()
face_processor = FaceProcessor()
intrusion_detector = IntrusionDetector()

# Socket.IO client to connect to backend
sio = socketio.AsyncClient()
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")

@app.get("/")
async def root():
    return {"message": "AI Engine is running", "socket_connected": sio.connected}

async def processing_loop():
    logger.info(f"Starting AI processing loop connecting to {BACKEND_URL}...")
    stream_handler.start()

    while True:
        try:
            if not sio.connected:
                try:
                    await sio.connect(BACKEND_URL)
                    logger.info("Connected to backend via Socket.IO")
                except Exception as e:
                    logger.error(f"Failed to connect to backend: {e}")
                    await asyncio.sleep(5)
                    continue

            frame = stream_handler.get_frame()

            # 1. Object Detection
            detections = detector.detect(frame)

            # 2. Intrusion Detection
            intrusions = intrusion_detector.check_intrusion(detections)
            for intr in intrusions:
                payload = {
                    'id': str(uuid.uuid4()),
                    'camera_id': 'camera-1',
                    'object_type': f"INTRUSION_{intr['object_type']}",
                    'confidence': intr['confidence'],
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
                await sio.emit('detection', payload)

            # 3. Face Recognition
            faces = face_processor.detect_and_recognize(frame)
            for face in faces:
                payload = {
                    'id': str(uuid.uuid4()),
                    'camera_id': 'camera-1',
                    'object_type': 'face',
                    'is_known': face['is_known'],
                    'person_name': face.get('person_name', 'Unknown'),
                    'confidence': face['confidence'],
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
                await sio.emit('detection', payload)

            # Regular detections
            for det in detections:
                payload = {
                    'id': str(uuid.uuid4()),
                    'camera_id': 'camera-1',
                    'object_type': det['object_type'],
                    'confidence': det['confidence'],
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
                await sio.emit('detection', payload)

            await asyncio.sleep(2)
        except Exception as e:
            logger.error(f"Error in processing loop: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(processing_loop())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
