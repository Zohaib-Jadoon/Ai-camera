"""Test ASGI lifecycle without models, cameras or network services."""
import asyncio
import unittest
from src.asgi import EngineApp


class EngineLifecycleTests(unittest.IsolatedAsyncioTestCase):
    async def test_http_routes_are_not_available(self):
        messages = []
        async def send(message): messages.append(message)
        await EngineApp(None)({'type': 'http'}, None, send)
        self.assertEqual(messages[0]['status'], 404)

    async def test_shutdown_cancels_and_awaits_worker(self):
        stopped = asyncio.Event()
        async def run():
            try: await asyncio.Future()
            finally: stopped.set()
        events = iter([{'type': 'lifespan.startup'}, {'type': 'lifespan.shutdown'}])
        messages = []
        async def receive(): return next(events)
        async def send(message): messages.append(message['type'])
        app = EngineApp(run)
        await app({'type': 'lifespan'}, receive, send)
        self.assertEqual(messages, ['lifespan.startup.complete', 'lifespan.shutdown.complete'])
        self.assertTrue(stopped.is_set())
        self.assertIsNone(app.task)

    async def test_failed_worker_does_not_report_startup_success(self):
        async def run(): raise RuntimeError('test failure')
        async def receive(): return {'type': 'lifespan.startup'}
        messages = []
        async def send(message): messages.append(message['type'])
        await EngineApp(run)({'type': 'lifespan'}, receive, send)
        self.assertEqual(messages, ['lifespan.startup.failed'])

    async def test_server_cancellation_cleans_up_worker(self):
        ready = asyncio.Event()
        stopped = asyncio.Event()
        async def run():
            try: await asyncio.Future()
            finally: stopped.set()
        calls = 0
        async def receive():
            nonlocal calls
            calls += 1
            if calls == 1: return {'type': 'lifespan.startup'}
            await asyncio.Future()
        async def send(message): ready.set()
        app = EngineApp(run)
        task = asyncio.create_task(app({'type': 'lifespan'}, receive, send))
        await ready.wait()
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        self.assertTrue(stopped.is_set())
