from fastapi import FastAPI
import asyncio
import logging
import socketio
import uuid
from datetime import datetime
from src.detector import Detector
from src.stream_handler import StreamHandler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Madad Vision AI - Engine")
detector = Detector()
stream_handler = StreamHandler()

# Socket.IO client to connect to backend
sio = socketio.AsyncClient()

@app.get("/")
async def root():
    return {"message": "AI Engine is running", "socket_connected": sio.connected}

@app.get("/status")
async def status():
    return {"status": "ok", "model": "YOLOv8n"}

async def processing_loop():
    logger.info("Starting AI processing loop...")
    stream_handler.start()

    while True:
        try:
            if not sio.connected:
                try:
                    await sio.connect('http://localhost:3000')
                    logger.info("Connected to backend via Socket.IO")
                except Exception as e:
                    logger.error(f"Failed to connect to backend: {e}")
                    await asyncio.sleep(5)
                    continue

            frame = stream_handler.get_frame()
            detections = detector.detect(frame)

            for det in detections:
                payload = {
                    'id': str(uuid.uuid4()),
                    'camera_id': 'camera-1',
                    'object_type': det['object_type'],
                    'confidence': det['confidence'],
                    'timestamp': datetime.utcnow().isoformat() + 'Z'
                }
                await sio.emit('detection', payload)
                logger.info(f"Sent detection: {payload['object_type']}")

            await asyncio.sleep(2) # Process at lower FPS for demo
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
