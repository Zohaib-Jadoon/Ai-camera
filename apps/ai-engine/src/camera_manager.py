"""
CameraManager — thin wrapper around the active camera set.
The main processing loop creates one task per camera managed here.
"""
from __future__ import annotations
import asyncio
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ActiveCamera:
    id: str
    name: str
    rtsp_url: str
    task: asyncio.Task | None = field(default=None, repr=False)


class CameraManager:
    """Thread-safe registry of currently-processing cameras."""

    def __init__(self):
        self._cameras: dict[str, ActiveCamera] = {}

    def register(self, camera_id: str, name: str, rtsp_url: str, task: asyncio.Task) -> None:
        self._cameras[camera_id] = ActiveCamera(
            id=camera_id,
            name=name,
            rtsp_url=rtsp_url,
            task=task,
        )
        logger.info(f"Camera registered: {name} ({camera_id})")

    def remove(self, camera_id: str) -> None:
        if camera := self._cameras.pop(camera_id, None):
            if camera.task and not camera.task.done():
                camera.task.cancel()
            logger.info(f"Camera removed: {camera_id}")

    def get(self, camera_id: str) -> ActiveCamera | None:
        return self._cameras.get(camera_id)

    def count(self) -> int:
        return len(self._cameras)

    def ids(self) -> list[str]:
        return list(self._cameras.keys())

    def all(self) -> list[ActiveCamera]:
        return list(self._cameras.values())

    async def shutdown_all(self) -> None:
        tasks = [c.task for c in self._cameras.values() if c.task and not c.task.done()]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self._cameras.clear()
        logger.info("All cameras shut down")
