from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..db import get_db
from ..models import Depot, DepotPosition
from ..schemas import DepotCreate, DepotUpdate, DepotResponse, DepotPositionCreate, DepotPositionResponse

router = APIRouter(prefix='/depots', tags=['Depots'])


@router.get('/', response_model=list[DepotResponse])
def list_depots(db: Session = Depends(get_db)):
    return db.query(Depot).order_by(Depot.name).all()


@router.post('/', response_model=DepotResponse, status_code=201)
def create_depot(data: DepotCreate, db: Session = Depends(get_db)):
    depot = Depot(**data.model_dump(), aktualisiert_am=datetime.now(timezone.utc))
    db.add(depot)
    db.commit()
    db.refresh(depot)
    return depot


@router.get('/{depot_id}', response_model=DepotResponse)
def get_depot(depot_id: int, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail='Depot nicht gefunden')
    return depot


@router.put('/{depot_id}', response_model=DepotResponse)
def update_depot(depot_id: int, data: DepotUpdate, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail='Depot nicht gefunden')
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(depot, field, value)
    depot.aktualisiert_am = datetime.now(timezone.utc)
    db.commit()
    db.refresh(depot)
    return depot


@router.delete('/{depot_id}', status_code=204)
def delete_depot(depot_id: int, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail='Depot nicht gefunden')
    db.delete(depot)
    db.commit()


# ── Positionen ──────────────────────────────────────────────────────────────────

@router.get('/{depot_id}/positionen', response_model=list[DepotPositionResponse])
def list_positionen(depot_id: int, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail='Depot nicht gefunden')
    return depot.positionen


@router.post('/{depot_id}/positionen', response_model=DepotPositionResponse, status_code=201)
def create_position(depot_id: int, data: DepotPositionCreate, db: Session = Depends(get_db)):
    depot = db.query(Depot).filter(Depot.id == depot_id).first()
    if not depot:
        raise HTTPException(status_code=404, detail='Depot nicht gefunden')
    position = DepotPosition(**data.model_dump(), depot_id=depot_id)
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


@router.delete('/{depot_id}/positionen/{position_id}', status_code=204)
def delete_position(depot_id: int, position_id: int, db: Session = Depends(get_db)):
    pos = db.query(DepotPosition).filter(
        DepotPosition.id == position_id,
        DepotPosition.depot_id == depot_id
    ).first()
    if not pos:
        raise HTTPException(status_code=404, detail='Position nicht gefunden')
    db.delete(pos)
    db.commit()
