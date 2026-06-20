from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..db import get_db
from ..models import Konto
from ..schemas import KontoCreate, KontoUpdate, KontoResponse

router = APIRouter(prefix='/konten', tags=['Konten'])


@router.get('/', response_model=list[KontoResponse])
def list_konten(db: Session = Depends(get_db)):
    return db.query(Konto).order_by(Konto.name).all()


@router.post('/', response_model=KontoResponse, status_code=201)
def create_konto(data: KontoCreate, db: Session = Depends(get_db)):
    payload = data.model_dump()
    # 'bank' wurde aus der UI entfernt, die Alt-Spalte ist aber NOT NULL → Default setzen
    if payload.get('bank') is None:
        payload['bank'] = ''
    konto = Konto(**payload, aktualisiert_am=datetime.now(timezone.utc))
    db.add(konto)
    db.commit()
    db.refresh(konto)
    return konto


@router.get('/{konto_id}', response_model=KontoResponse)
def get_konto(konto_id: int, db: Session = Depends(get_db)):
    konto = db.query(Konto).filter(Konto.id == konto_id).first()
    if not konto:
        raise HTTPException(status_code=404, detail='Konto nicht gefunden')
    return konto


@router.put('/{konto_id}', response_model=KontoResponse)
def update_konto(konto_id: int, data: KontoUpdate, db: Session = Depends(get_db)):
    konto = db.query(Konto).filter(Konto.id == konto_id).first()
    if not konto:
        raise HTTPException(status_code=404, detail='Konto nicht gefunden')
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(konto, field, value)
    konto.aktualisiert_am = datetime.now(timezone.utc)
    db.commit()
    db.refresh(konto)
    return konto


@router.delete('/{konto_id}', status_code=204)
def delete_konto(konto_id: int, db: Session = Depends(get_db)):
    konto = db.query(Konto).filter(Konto.id == konto_id).first()
    if not konto:
        raise HTTPException(status_code=404, detail='Konto nicht gefunden')
    db.delete(konto)
    db.commit()
