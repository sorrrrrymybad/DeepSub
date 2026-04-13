from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.deps import get_db
from core.crypto import encrypt
from models.smb_server import SMBServer
from schemas.smb_server import SMBServerCreate, SMBServerResponse, SMBServerUpdate
from smb.client import SMBClient, SMBConnectionError

router = APIRouter(prefix="/api/smb", tags=["smb"])


@router.get("", response_model=list[SMBServerResponse])
def list_servers(db: Session = Depends(get_db)):
    return db.query(SMBServer).all()


@router.post("", response_model=SMBServerResponse, status_code=201)
def create_server(data: SMBServerCreate, db: Session = Depends(get_db)):
    server = SMBServer(
        **data.model_dump(exclude={"password"}),
        password=encrypt(data.password),
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


@router.put("/{server_id}", response_model=SMBServerResponse)
def update_server(
    server_id: int,
    data: SMBServerUpdate,
    db: Session = Depends(get_db),
):
    server = db.query(SMBServer).filter(SMBServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    update_data = data.model_dump(exclude_none=True)
    if "password" in update_data:
        update_data["password"] = encrypt(update_data["password"])

    for key, value in update_data.items():
        setattr(server, key, value)
    db.commit()
    db.refresh(server)
    return server


@router.delete("/{server_id}", status_code=204)
def delete_server(server_id: int, db: Session = Depends(get_db)):
    server = db.query(SMBServer).filter(SMBServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    db.delete(server)
    db.commit()


@router.post("/{server_id}/test")
def test_connection(server_id: int, db: Session = Depends(get_db)):
    server = db.query(SMBServer).filter(SMBServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    try:
        client = SMBClient.from_server_model(server)
        client.connect()
        return {"ok": True}
    except SMBConnectionError as exc:
        return {"ok": False, "error": str(exc)}


@router.get("/{server_id}/browse")
def browse_directory(server_id: int, path: str = "/", db: Session = Depends(get_db)):
    server = db.query(SMBServer).filter(SMBServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")

    try:
        client = SMBClient.from_server_model(server)
        return client.list_directory(path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
