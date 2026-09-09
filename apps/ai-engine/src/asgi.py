"""ASGI lifecycle adapter for the Socket.IO worker, with no HTTP API."""
import asyncio


class EngineApp:
    """Own and cancel the worker task with the hosting ASGI server lifecycle."""

    def __init__(self, run):
        self.run = run
        self.task = None

    async def __call__(self, scope, receive, send):
        """Handle worker startup/shutdown and reject HTTP/WebSocket requests."""
        if scope['type'] == 'http':
            await send({'type': 'http.response.start', 'status': 404,
                        'headers': [(b'content-type', b'text/plain')]})
            await send({'type': 'http.response.body', 'body': b'AI Engine is a WebSocket client service.'})
        elif scope['type'] == 'websocket':
            await send({'type': 'websocket.close', 'code': 1008})
        elif scope['type'] == 'lifespan':
            try:
                while True:
                    message = await receive()
                    if message['type'] == 'lifespan.startup':
                        self.task = asyncio.create_task(self.run())
                        await asyncio.sleep(0)
                        if self.task.done():
                            await asyncio.gather(self.task, return_exceptions=True)
                            await send({'type': 'lifespan.startup.failed', 'message': 'AI worker stopped during startup'})
                            return
                        await send({'type': 'lifespan.startup.complete'})
                    elif message['type'] == 'lifespan.shutdown':
                        await self._stop()
                        await send({'type': 'lifespan.shutdown.complete'})
                        return
            finally:
                await self._stop()

    async def _stop(self):
        if self.task is not None:
            self.task.cancel()
            await asyncio.gather(self.task, return_exceptions=True)
            self.task = None
