from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from api.deps import get_db
from models.task import Task
from schemas.task import TaskCreate, TaskListResponse, TaskResponse, TaskSummary
from worker.subtitle_task import process_subtitle_task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("", response_model=list[TaskResponse], status_code=201)
def create_tasks(data: TaskCreate, db: Session = Depends(get_db)):
    tasks = []
    for file_path in data.file_paths:
        task = Task(
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
    return tasks


@router.get("", response_model=TaskListResponse)
def list_tasks(
    status: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)

    total = query.count()
    items = (
        query.order_by(Task.created_at.desc())
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


@router.delete("/{task_id}", status_code=204)
def cancel_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if task.celery_task_id:
        from celery.result import AsyncResult

        AsyncResult(task.celery_task_id).revoke(terminate=True)
    task.status = "cancelled"
    db.commit()


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
    return task


@router.get("/{task_id}/logs")
def stream_logs(task_id: int):
    from core.config import settings

    log_path = settings.log_dir / f"{task_id}.log"

    def generate():
        if log_path.exists():
            with open(log_path, "r", encoding="utf-8") as log_file:
                yield from log_file
        else:
            yield ""

    return StreamingResponse(generate(), media_type="text/plain")
