from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, datetime, timezone

from ..db import get_db
from ..models import SpendingPlan, SpendingPosition
from ..schemas import (
    SpendingPlanCreate, SpendingPlanUpdate, SpendingPlanResponse,
    SpendingPositionCreate, SpendingPositionUpdate, SpendingPositionResponse,
)

router = APIRouter(prefix='/spending', tags=['Spending Plan'])

DEFAULT_POSITIONEN = [
    # Fixkosten
    ('fixkosten', 'Miete / Hauszahlung (inkl. Grundsteuer)', 0, 0),
    ('fixkosten', 'Nebenkosten (Strom, Wasser, Heizung, Internet)', 0, 1),
    ('fixkosten', 'Versicherungen (KV, KFZ, Haus, Unfall)', 0, 2),
    ('fixkosten', 'Mobilität (Auto, ÖPNV, Tankkosten)', 0, 3),
    ('fixkosten', 'Lebensmittel & Hygiene', 0, 4),
    ('fixkosten', 'Kleidung', 0, 5),
    ('fixkosten', 'Abonnements & Telefon', 0, 6),
    ('fixkosten', 'Sport & Hobbies', 0, 7),
    ('fixkosten', 'Geschenke', 0, 8),
    # Investments
    ('investments', 'ETF Sparplan', 0, 0),
    # Sparziele
    ('sparziele', 'Urlaub', 0, 0),
    ('sparziele', 'Notgroschen', 0, 1),
]


@router.get('/', response_model=list[SpendingPlanResponse])
def list_plans(db: Session = Depends(get_db)):
    return db.query(SpendingPlan).order_by(SpendingPlan.stand.desc()).all()


@router.post('/', response_model=SpendingPlanResponse, status_code=201)
def create_plan(data: SpendingPlanCreate, db: Session = Depends(get_db)):
    # Bestehende Pläne als inaktiv markieren
    db.query(SpendingPlan).update({'ist_aktiv': False})

    plan_data = data.model_dump()
    plan_data['stand'] = plan_data.get('stand') or date.today()
    plan = SpendingPlan(
        **plan_data,
        ist_aktiv=True,
        erstellt_am=datetime.now(timezone.utc),
    )
    db.add(plan)
    db.flush()

    for kat, bez, betrag, order in DEFAULT_POSITIONEN:
        db.add(SpendingPosition(plan_id=plan.id, kategorie=kat,
                                bezeichnung=bez, betrag=betrag, sort_order=order))
    db.commit()
    db.refresh(plan)
    return plan


@router.get('/aktiv', response_model=SpendingPlanResponse)
def get_aktiv(db: Session = Depends(get_db)):
    plan = db.query(SpendingPlan).filter(SpendingPlan.ist_aktiv == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail='Kein aktiver Plan vorhanden')
    return plan


@router.get('/{plan_id}', response_model=SpendingPlanResponse)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(SpendingPlan).filter(SpendingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail='Plan nicht gefunden')
    return plan


@router.put('/{plan_id}', response_model=SpendingPlanResponse)
def update_plan(plan_id: int, data: SpendingPlanUpdate, db: Session = Depends(get_db)):
    plan = db.query(SpendingPlan).filter(SpendingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail='Plan nicht gefunden')
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    db.commit()
    db.refresh(plan)
    return plan


@router.delete('/{plan_id}', status_code=204)
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(SpendingPlan).filter(SpendingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail='Plan nicht gefunden')
    db.delete(plan)
    db.commit()


# ── Positionen ──────────────────────────────────────────────────────────────────

@router.post('/{plan_id}/positionen', response_model=SpendingPositionResponse, status_code=201)
def add_position(plan_id: int, data: SpendingPositionCreate, db: Session = Depends(get_db)):
    plan = db.query(SpendingPlan).filter(SpendingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail='Plan nicht gefunden')
    pos = SpendingPosition(**data.model_dump(), plan_id=plan_id)
    db.add(pos)
    db.commit()
    db.refresh(pos)
    return pos


@router.put('/{plan_id}/positionen/{pos_id}', response_model=SpendingPositionResponse)
def update_position(plan_id: int, pos_id: int, data: SpendingPositionUpdate,
                    db: Session = Depends(get_db)):
    pos = db.query(SpendingPosition).filter(
        SpendingPosition.id == pos_id,
        SpendingPosition.plan_id == plan_id
    ).first()
    if not pos:
        raise HTTPException(status_code=404, detail='Position nicht gefunden')
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pos, field, value)
    db.commit()
    db.refresh(pos)
    return pos


@router.delete('/{plan_id}/positionen/{pos_id}', status_code=204)
def delete_position(plan_id: int, pos_id: int, db: Session = Depends(get_db)):
    pos = db.query(SpendingPosition).filter(
        SpendingPosition.id == pos_id,
        SpendingPosition.plan_id == plan_id
    ).first()
    if not pos:
        raise HTTPException(status_code=404, detail='Position nicht gefunden')
    db.delete(pos)
    db.commit()
