import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from api.deps import get_db
from models.task import Task
from schemas.task import TaskCreate, TaskListResponse, TaskResponse, TaskSummary
from worker.subtitle_task import process_subtitle_task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])
logger = logging.getLogger(__name__)


@router.post("", response_model=list[TaskResponse], status_code=201)
def create_tasks(payload: dict = Body(...), db: Session = Depends(get_db)):
    try:
        data = TaskCreate.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail=exc.errors(include_url=False, include_context=False),
        ) from exc

    tasks = []
    for file_path in data.file_paths:
        task = Task(
            source_type=data.source_type,
            smb_server_id=data.smb_server_id,
            file_path=file_path,
            source_lang=data.source_lang,
            target_lang=data.target_lang,
            stt_engine=data.stt_engine,
            translate_engine=data.translate_engine,
            overwrite=data.overwrite,
        )
        db.add(task)
        db.flush()
        tasks.append(task)

    db.commit()
    for task in tasks:
        db.refresh(task)
        process_subtitle_task.delay(task.id)
    logger.info(
        "Created subtitle tasks: ids=%s count=%s source_type=%s source_lang=%s target_lang=%s stt_engine=%s translate_engine=%s overwrite=%s",
        [task.id for task in tasks],
        len(tasks),
        data.source_type,
        data.source_lang,
        data.target_lang,
        data.stt_engine,
        data.translate_engine,
        data.overwrite,
    )
    return tasks


@router.get("", response_model=TaskListResponse)
def list_tasks(
    status: str | None = None,
    keyword: str | None = None,
    sort: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)
    if keyword:
        query = query.filter(Task.file_path.contains(keyword))

    if sort == "name_asc":
        order = Task.file_path.asc()
    elif sort == "name_desc":
        order = Task.file_path.desc()
    else:
        order = Task.created_at.desc()

    total = query.count()
    items = (
        query.order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/summary", response_model=TaskSummary)
def get_task_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func

    rows = db.query(Task.status, func.count(Task.id)).group_by(Task.status).all()
    counts = {status: count for status, count in rows}
    return TaskSummary(
        total=sum(counts.values()),
        pending=counts.get("pending", 0),
        running=counts.get("running", 0),
        done=counts.get("done", 0),
        failed=counts.get("failed", 0),
        cancelled=counts.get("cancelled", 0),
    )


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}/remove", status_code=204)
def remove_task(task_id: int, db: Session = Depends(get_db)):
    import os
    from core.config import settings as app_settings

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.celery_task_id and task.status == "running":
        try:
            from celery.result import AsyncResult

            logger.info(
                "Revoking running task before removal: task_id=%s celery_task_id=%s",
                task_id,
                task.celery_task_id,
            )
            AsyncResult(task.celery_task_id).revoke(terminate=True)
        except Exception as exc:
            logger.warning(
                "Failed to revoke running task before removal: task_id=%s celery_task_id=%s error=%s",
                task_id,
                task.celery_task_id,
                exc,
            )
    db.delete(task)
    db.commit()
    logger.info("Removed task record: task_id=%s", task_id)

    log_dir = app_settings.log_dir / str(task_id)
    legacy_log = app_settings.log_dir / f"{task_id}.log"
    try:
        if log_dir.exists():
            import shutil

            shutil.rmtree(log_dir, ignore_errors=True)
        legacy_log.unlink(missing_ok=True)
    except Exception as exc:
        logger.warning("Failed to remove task logs: task_id=%s error=%s", task_id, exc)


@router.post("/{task_id}/retry", response_model=TaskResponse)
def retry_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.retry_count >= 5:
        raise HTTPException(
            status_code=400,
            detail={"error": "Max retries exceeded", "code": "MAX_RETRIES"},
        )

    task.status = "pending"
    task.progress = 0
    task.error_message = None
    task.retry_count += 1
    db.commit()
    db.refresh(task)
    process_subtitle_task.delay(task.id)
    logger.info(
        "Retried subtitle task: task_id=%s retry_count=%s celery_status=%s",
        task.id,
        task.retry_count,
        task.status,
    )
    return task


@router.get("/{task_id}/logs")
def stream_logs(task_id: int):
    from core.config import settings

    log_path = settings.log_dir / str(task_id) / "task.log"
    if not log_path.exists():
        legacy = settings.log_dir / f"{task_id}.log"
        if legacy.exists():
            log_path = legacy

    def generate():
        if log_path.exists():
            with open(log_path, "r", encoding="utf-8") as log_file:
                yield from log_file
        else:
            yield ""

    return StreamingResponse(generate(), media_type="text/plain")
