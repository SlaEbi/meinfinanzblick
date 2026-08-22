from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Kontakt, NotfallEintrag
from ..schemas import (
    KontaktCreate, KontaktUpdate, KontaktResponse,
    NotfallEintragCreate, NotfallEintragUpdate, NotfallEintragResponse,
)
from .anhaenge import delete_anhaenge_fuer

router = APIRouter(tags=['Notfall'])


# ── Kontakte ───────────────────────────────────────────────────────────────────

@router.get('/kontakte/', response_model=list[KontaktResponse])
def list_kontakte(db: Session = Depends(get_db)):
    return db.query(Kontakt).order_by(Kontakt.rolle, Kontakt.name).all()


@router.post('/kontakte/', response_model=KontaktResponse, status_code=201)
def create_kontakt(data: KontaktCreate, db: Session = Depends(get_db)):
    k = Kontakt(**data.model_dump())
    db.add(k)
    db.commit()
    db.refresh(k)
    return k


@router.put('/kontakte/{id}', response_model=KontaktResponse)
def update_kontakt(id: int, data: KontaktUpdate, db: Session = Depends(get_db)):
    k = db.get(Kontakt, id)
    if not k:
        raise HTTPException(404, 'Kontakt nicht gefunden')
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(k, field, val)
    db.commit()
    db.refresh(k)
    return k


@router.delete('/kontakte/{id}', status_code=204)
def delete_kontakt(id: int, db: Session = Depends(get_db)):
    k = db.get(Kontakt, id)
    if not k:
        raise HTTPException(404, 'Kontakt nicht gefunden')
    db.delete(k)
    db.commit()


# ── Notfall-Einträge ───────────────────────────────────────────────────────────

@router.get('/notfall/', response_model=list[NotfallEintragResponse])
def list_eintraege(db: Session = Depends(get_db)):
    return db.query(NotfallEintrag).order_by(
        NotfallEintrag.kategorie, NotfallEintrag.sort_order, NotfallEintrag.titel
    ).all()


@router.post('/notfall/', response_model=NotfallEintragResponse, status_code=201)
def create_eintrag(data: NotfallEintragCreate, db: Session = Depends(get_db)):
    e = NotfallEintrag(**data.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@router.put('/notfall/{id}', response_model=NotfallEintragResponse)
def update_eintrag(id: int, data: NotfallEintragUpdate, db: Session = Depends(get_db)):
    e = db.get(NotfallEintrag, id)
    if not e:
        raise HTTPException(404, 'Eintrag nicht gefunden')
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(e, field, val)
    db.commit()
    db.refresh(e)
    return e


@router.delete('/notfall/{id}', status_code=204)
def delete_eintrag(id: int, db: Session = Depends(get_db)):
    e = db.get(NotfallEintrag, id)
    if not e:
        raise HTTPException(404, 'Eintrag nicht gefunden')
    delete_anhaenge_fuer('notfall', id, db)
    db.delete(e)
    db.commit()
