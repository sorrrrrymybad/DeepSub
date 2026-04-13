import asyncio
import json
import shutil
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis.asyncio as aioredis

import models  # noqa: F401
from api.schedules import router as schedules_router
from api.settings import router as settings_router
from api.smb import router as smb_router
from api.tasks import router as tasks_router
from api.ws import broadcast_task_update, router as ws_router
from core.config import settings
from core.database import engine
from models.base import Base


async def redis_subscriber():
    try:
        redis_client = aioredis.from_url(settings.redis_url)
        pubsub = redis_client.pubsub()
        await pubsub.subscribe("task_updates")
    except Exception:
        return

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = json.loads(message["data"])
                await broadcast_task_update(data.pop("task_id"), data)
    finally:
        try:
            await pubsub.unsubscribe("task_updates")
            await pubsub.aclose()
            await redis_client.aclose()
        except Exception:
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    settings.log_dir.mkdir(parents=True, exist_ok=True)
    settings.tmp_dir.mkdir(parents=True, exist_ok=True)
    settings.whisper_model_dir.mkdir(parents=True, exist_ok=True)

    if settings.tmp_dir.exists():
        for child in settings.tmp_dir.iterdir():
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)

    subscriber_task = asyncio.create_task(redis_subscriber())
    try:
        yield
    finally:
        subscriber_task.cancel()
        try:
            await subscriber_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="DeepSub", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(smb_router)
app.include_router(tasks_router)
app.include_router(settings_router)
app.include_router(schedules_router)
app.include_router(ws_router)
