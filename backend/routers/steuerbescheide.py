from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import SteuerBescheid, SteuerBescheidGemeinde
from ..schemas import SteuerBescheidCreate, SteuerBescheidUpdate, SteuerBescheidResponse
from .anhaenge import delete_anhaenge_fuer

router = APIRouter(prefix='/steuerbescheide', tags=['Steuerbescheide'])


def _get_or_404(db: Session, jahr: int) -> SteuerBescheid:
    obj = (
        db.query(SteuerBescheid)
        .options(joinedload(SteuerBescheid.gemeinden))
        .filter(SteuerBescheid.jahr == jahr)
        .first()
    )
    if not obj:
        raise HTTPException(404, f'Kein Steuerbescheid für {jahr} gefunden')
    return obj


def _apply_gemeinden(obj: SteuerBescheid, data: SteuerBescheidCreate) -> None:
    obj.gemeinden = [
        SteuerBescheidGemeinde(
            gemeinde=g.gemeinde, arbeitsloehne=g.arbeitsloehne,
            zerlegungsanteil=g.zerlegungsanteil, hebesatz=g.hebesatz,
            gewerbesteuer=g.gewerbesteuer,
        )
        for g in data.gemeinden
    ]


@router.get('/', response_model=list[SteuerBescheidResponse])
def list_bescheide(db: Session = Depends(get_db)):
    return (
        db.query(SteuerBescheid)
        .options(joinedload(SteuerBescheid.gemeinden))
        .order_by(SteuerBescheid.jahr.desc())
        .all()
    )


@router.get('/{jahr}', response_model=SteuerBescheidResponse)
def get_bescheid(jahr: int, db: Session = Depends(get_db)):
    return _get_or_404(db, jahr)


@router.post('/', response_model=SteuerBescheidResponse, status_code=201)
def create_bescheid(data: SteuerBescheidCreate, db: Session = Depends(get_db)):
    existing = db.query(SteuerBescheid).filter(SteuerBescheid.jahr == data.jahr).first()
    if existing:
        raise HTTPException(409, f'Für {data.jahr} existiert bereits ein Steuerbescheid — PUT zum Aktualisieren nutzen')
    obj = SteuerBescheid(**data.model_dump(exclude={'gemeinden'}))
    db.add(obj)
    db.flush()
    _apply_gemeinden(obj, data)
    db.commit()
    db.refresh(obj)
    return obj


@router.put('/{jahr}', response_model=SteuerBescheidResponse)
def update_bescheid(jahr: int, data: SteuerBescheidUpdate, db: Session = Depends(get_db)):
    obj = _get_or_404(db, jahr)
    for k, v in data.model_dump(exclude={'gemeinden'}).items():
        setattr(obj, k, v)
    obj.aktualisiert_am = datetime.now(timezone.utc)
    _apply_gemeinden(obj, data)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete('/{jahr}', status_code=204)
def delete_bescheid(jahr: int, db: Session = Depends(get_db)):
    obj = _get_or_404(db, jahr)
    delete_anhaenge_fuer('steuerbescheid', obj.id, db)
    db.delete(obj)
    db.commit()
