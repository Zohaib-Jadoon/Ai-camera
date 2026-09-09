"""Lifecycle and bounded background work tests without model dependencies."""
import asyncio
import socket
import threading
import unittest
from unittest.mock import AsyncMock, MagicMock

from src.launcher import reserve_port
from src.background_analysis import BackgroundAnalysis
from src.client_cleanup import close_client


class LauncherTests(unittest.TestCase):
    def test_duplicate_port_fails_before_model_import(self):
        with reserve_port('127.0.0.1', 0) as listener:
            with self.assertRaises(OSError):
                reserve_port('127.0.0.1', listener.getsockname()[1])

    def test_released_port_can_be_used_again(self):
        listener = reserve_port('127.0.0.1', 0)
        port = listener.getsockname()[1]
        listener.close()
        with reserve_port('127.0.0.1', port):
            pass


class WorkerTests(unittest.IsolatedAsyncioTestCase):
    async def test_slow_analysis_does_not_block_or_queue_frames(self):
        worker = BackgroundAnalysis()
        release = threading.Event()
        def slow():
            release.wait(2)
            return ['result']
        try:
            self.assertTrue(worker.submit(slow))
            self.assertFalse(worker.submit(slow))
            await asyncio.sleep(0)
            self.assertIsNone(worker.result())
            release.set()
            await asyncio.wait_for(asyncio.shield(worker.task), 3)
            self.assertEqual(worker.result(), ['result'])
            self.assertTrue(worker.submit(lambda: []))
        finally:
            release.set()
            await worker.close()

    async def test_failed_analysis_recovers(self):
        worker = BackgroundAnalysis()
        def fail():
            raise ValueError('test failure')
        worker.submit(fail)
        await asyncio.gather(worker.task, return_exceptions=True)
        self.assertIsNone(worker.result())
        self.assertTrue(worker.submit(lambda: []))
        await worker.close()

    async def test_disconnected_client_still_closes_transport(self):
        client = MagicMock()
        client.shutdown = AsyncMock()
        client.eio.disconnect = AsyncMock()
        await close_client(client)
        client.eio.disconnect.assert_awaited_once_with(abort=True)

    async def test_transport_closes_even_if_socket_shutdown_fails(self):
        client = MagicMock()
        client.shutdown = AsyncMock(side_effect=RuntimeError('shutdown failed'))
        client.eio.disconnect = AsyncMock()
        with self.assertRaises(RuntimeError):
            await close_client(client)
        client.eio.disconnect.assert_awaited_once_with(abort=True)
