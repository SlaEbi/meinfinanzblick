from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Darlehen
from ..schemas import DarlehenCreate, DarlehenUpdate, DarlehenResponse
from ..services.tilgung import restlaufzeit_monate

router = APIRouter(prefix='/darlehen', tags=['Darlehen'])


def _berechne_restlaufzeit(darlehen: Darlehen) -> None:
    """Setzt restlaufzeit autoritativ aus restschuld/zinssatz/rate (Annuität)."""
    res = restlaufzeit_monate(
        float(darlehen.restschuld or 0),
        float(darlehen.zinssatz or 0),
        float(darlehen.rate_monatlich or 0),
    )
    darlehen.restlaufzeit = res.monate  # None bei unvollständig / Rate zu niedrig


@router.get('/', response_model=list[DarlehenResponse])
def list_darlehen(db: Session = Depends(get_db)):
    return db.query(Darlehen).order_by(Darlehen.bezeichnung).all()


@router.post('/', response_model=DarlehenResponse, status_code=201)
def create_darlehen(data: DarlehenCreate, db: Session = Depends(get_db)):
    darlehen = Darlehen(**data.model_dump())
    _berechne_restlaufzeit(darlehen)
    db.add(darlehen)
    db.commit()
    db.refresh(darlehen)
    return darlehen


@router.get('/{darlehen_id}', response_model=DarlehenResponse)
def get_darlehen(darlehen_id: int, db: Session = Depends(get_db)):
    darlehen = db.query(Darlehen).filter(Darlehen.id == darlehen_id).first()
    if not darlehen:
        raise HTTPException(status_code=404, detail='Darlehen nicht gefunden')
    return darlehen


@router.put('/{darlehen_id}', response_model=DarlehenResponse)
def update_darlehen(darlehen_id: int, data: DarlehenUpdate, db: Session = Depends(get_db)):
    darlehen = db.query(Darlehen).filter(Darlehen.id == darlehen_id).first()
    if not darlehen:
        raise HTTPException(status_code=404, detail='Darlehen nicht gefunden')
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(darlehen, field, value)
    _berechne_restlaufzeit(darlehen)
    db.commit()
    db.refresh(darlehen)
    return darlehen


@router.delete('/{darlehen_id}', status_code=204)
def delete_darlehen(darlehen_id: int, db: Session = Depends(get_db)):
    darlehen = db.query(Darlehen).filter(Darlehen.id == darlehen_id).first()
    if not darlehen:
        raise HTTPException(status_code=404, detail='Darlehen nicht gefunden')
    db.delete(darlehen)
    db.commit()
