from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from models.scheduled_job import ScheduledJob
from schemas.scheduled_job import ScheduledJobCreate, ScheduledJobResponse

router = APIRouter(prefix="/api/schedules", tags=["schedules"])


@router.get("", response_model=list[ScheduledJobResponse])
def list_schedules(db: Session = Depends(get_db)):
    return db.query(ScheduledJob).all()


@router.post("", response_model=ScheduledJobResponse, status_code=201)
def create_schedule(data: ScheduledJobCreate, db: Session = Depends(get_db)):
    job = ScheduledJob(**data.model_dump())
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


@router.put("/{job_id}", response_model=ScheduledJobResponse)
def update_schedule(job_id: int, data: ScheduledJobCreate, db: Session = Depends(get_db)):
    job = db.query(ScheduledJob).filter(ScheduledJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scheduled job not found")

    for key, value in data.model_dump().items():
        setattr(job, key, value)
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", status_code=204)
def delete_schedule(job_id: int, db: Session = Depends(get_db)):
    job = db.query(ScheduledJob).filter(ScheduledJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Scheduled job not found")
    db.delete(job)
    db.commit()
