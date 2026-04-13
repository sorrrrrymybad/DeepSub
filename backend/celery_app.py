from celery import Celery

from core.config import settings


celery_app = Celery(
    "deepsub",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["worker.subtitle_task", "tasks.scheduler"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

celery_app.conf.beat_schedule = {
    "poll-scheduled-jobs": {
        "task": "tasks.scheduler.poll_scheduled_jobs",
        "schedule": 60.0,
    }
}
