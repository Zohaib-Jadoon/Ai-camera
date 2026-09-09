"""Single-flight offloading: busy analyzers drop work instead of queuing frames."""
import asyncio
import logging

logger = logging.getLogger(__name__)


class BackgroundAnalysis:
    """Keep at most one native analysis call in flight per worker."""
    def __init__(self):
        self.task = None

    def submit(self, function, *args):
        """Schedule only if idle; the caller must consume the prior result first."""
        if self.task is not None:
            return False
        self.task = asyncio.create_task(asyncio.to_thread(function, *args))
        return True

    def result(self):
        """Read a completed result without ever waiting on inference."""
        if self.task is None or not self.task.done():
            return None
        task, self.task = self.task, None
        try:
            return task.result()
        except Exception:
            logger.exception('Background analysis failed')
            return None

    async def close(self):
        """Drain native work before camera state is torn down (threads cannot be killed)."""
        if self.task is not None:
            await asyncio.gather(self.task, return_exceptions=True)
            self.task = None
