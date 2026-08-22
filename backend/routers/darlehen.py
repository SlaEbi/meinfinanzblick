from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Darlehen
from ..schemas import DarlehenCreate, DarlehenUpdate, DarlehenResponse, TilgungsplanResponse
from ..services.tilgung import restlaufzeit_monate, tilgungsplan
from .anhaenge import delete_anhaenge_fuer

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


@router.get('/{darlehen_id}/tilgungsplan', response_model=TilgungsplanResponse)
def get_tilgungsplan(darlehen_id: int, sondertilgung_jahr: float = 0.0, db: Session = Depends(get_db)):
    """Jahresweiser Tilgungsplan, optional mit jährlicher Sondertilgung.

    Liefert immer auch die Baseline ohne Sondertilgung mit, damit das Frontend
    Laufzeitverkürzung und Zinsersparnis ohne zweiten Request anzeigen kann.
    """
    darlehen = db.query(Darlehen).filter(Darlehen.id == darlehen_id).first()
    if not darlehen:
        raise HTTPException(status_code=404, detail='Darlehen nicht gefunden')

    kwargs = dict(
        darlehen_typ=darlehen.darlehen_typ or 'annuitaet',
        tilgungsrate_monatlich=float(darlehen.tilgungsrate_monatlich or 0),
    )
    plan = tilgungsplan(
        float(darlehen.restschuld or 0), float(darlehen.zinssatz or 0),
        float(darlehen.rate_monatlich or 0), sondertilgung_jahr=sondertilgung_jahr, **kwargs,
    )
    baseline = plan if sondertilgung_jahr <= 0 else tilgungsplan(
        float(darlehen.restschuld or 0), float(darlehen.zinssatz or 0),
        float(darlehen.rate_monatlich or 0), sondertilgung_jahr=0, **kwargs,
    )
    return TilgungsplanResponse(
        jahre=plan.jahre, monate_gesamt=plan.monate_gesamt, zinsen_gesamt=plan.zinsen_gesamt,
        monate_ohne_sondertilgung=baseline.monate_gesamt, zinsen_ohne_sondertilgung=baseline.zinsen_gesamt,
    )


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
    delete_anhaenge_fuer('darlehen', darlehen_id, db)
    db.delete(darlehen)
    db.commit()
