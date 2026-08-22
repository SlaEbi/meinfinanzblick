from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..db import get_db
from ..models import Versicherung, Vertrag
from ..schemas import (
    VersicherungCreate, VersicherungUpdate, VersicherungResponse,
    VertragCreate, VertragUpdate, VertragResponse,
)
from .anhaenge import delete_anhaenge_fuer

router = APIRouter(tags=['Versicherungen'])


# ── Versicherungen ─────────────────────────────────────────────────────────────

@router.get('/versicherungen/', response_model=list[VersicherungResponse])
def list_versicherungen(db: Session = Depends(get_db)):
    return db.query(Versicherung).order_by(Versicherung.art, Versicherung.bezeichnung).all()


@router.post('/versicherungen/', response_model=VersicherungResponse, status_code=201)
def create_versicherung(data: VersicherungCreate, db: Session = Depends(get_db)):
    v = Versicherung(**data.model_dump(), erstellt_am=datetime.now(timezone.utc))
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.put('/versicherungen/{vid}', response_model=VersicherungResponse)
def update_versicherung(vid: int, data: VersicherungUpdate, db: Session = Depends(get_db)):
    v = db.query(Versicherung).filter(Versicherung.id == vid).first()
    if not v:
        raise HTTPException(status_code=404, detail='Versicherung nicht gefunden')
    for k, val in data.model_dump(exclude_unset=True).items():
        setattr(v, k, val)
    db.commit()
    db.refresh(v)
    return v


@router.delete('/versicherungen/{vid}', status_code=204)
def delete_versicherung(vid: int, db: Session = Depends(get_db)):
    v = db.query(Versicherung).filter(Versicherung.id == vid).first()
    if not v:
        raise HTTPException(status_code=404, detail='Versicherung nicht gefunden')
    delete_anhaenge_fuer('versicherung', vid, db)
    db.delete(v)
    db.commit()


# ── Verträge ───────────────────────────────────────────────────────────────────

@router.get('/vertraege/', response_model=list[VertragResponse])
def list_vertraege(db: Session = Depends(get_db)):
    return db.query(Vertrag).order_by(Vertrag.art, Vertrag.bezeichnung).all()


@router.post('/vertraege/', response_model=VertragResponse, status_code=201)
def create_vertrag(data: VertragCreate, db: Session = Depends(get_db)):
    v = Vertrag(**data.model_dump(), erstellt_am=datetime.now(timezone.utc))
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.put('/vertraege/{vid}', response_model=VertragResponse)
def update_vertrag(vid: int, data: VertragUpdate, db: Session = Depends(get_db)):
    v = db.query(Vertrag).filter(Vertrag.id == vid).first()
    if not v:
        raise HTTPException(status_code=404, detail='Vertrag nicht gefunden')
    for k, val in data.model_dump(exclude_unset=True).items():
        setattr(v, k, val)
    db.commit()
    db.refresh(v)
    return v


@router.delete('/vertraege/{vid}', status_code=204)
def delete_vertrag(vid: int, db: Session = Depends(get_db)):
    v = db.query(Vertrag).filter(Vertrag.id == vid).first()
    if not v:
        raise HTTPException(status_code=404, detail='Vertrag nicht gefunden')
    delete_anhaenge_fuer('vertrag', vid, db)
    db.delete(v)
    db.commit()
