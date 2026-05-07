from fastapi import FastAPI, BackgroundTasks
import asyncio
import logging
import socketio
import uuid
from datetime import datetime
import os
from src.detector import Detector
from src.stream_handler import StreamHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Madad Vision AI - Engine")
detector = Detector()

# Socket.IO client to connect to backend
sio = socketio.AsyncClient()

BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:3000')

# Dictionary to manage multiple streams
active_streams = {}

@app.get("/")
async def root():
    return {"message": "AI Engine is running", "socket_connected": sio.connected, "active_streams": list(active_streams.keys())}

@app.post("/streams/start")
async def start_stream(camera_id: str, rtsp_url: str):
    if camera_id in active_streams:
        return {"message": "Stream already active"}

    handler = StreamHandler(source=rtsp_url)
    active_streams[camera_id] = handler
    logger.info(f"Started stream for camera: {camera_id}")
    return {"status": "started", "camera_id": camera_id}

async def processing_loop():
    logger.info("Starting AI processing loop...")

    # Pre-start one mock stream if none active
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
                detections = detector.detect(frame)

                for det in detections:
                    payload = {
                        'id': str(uuid.uuid4()),
                        'camera_id': camera_id,
                        'object_type': det['object_type'],
                        'confidence': det['confidence'],
                        'bbox': det['bbox'],
                        'track_id': det.get('track_id'),
                        'timestamp': datetime.utcnow().isoformat() + 'Z'
                    }
                    await sio.emit('detection', payload)
                    logger.info(f"Sent detection: {payload['object_type']} from {camera_id}")

            await asyncio.sleep(0.5) # Process at ~2 FPS for demo/resource saving
        except Exception as e:
            logger.error(f"Error in processing loop: {e}")
            await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(processing_loop())

@app.on_event("shutdown")
async def shutdown_event():
    await sio.disconnect()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
