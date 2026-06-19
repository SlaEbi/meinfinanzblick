from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Darlehen
from ..schemas import DarlehenCreate, DarlehenUpdate, DarlehenResponse

router = APIRouter(prefix='/darlehen', tags=['Darlehen'])


@router.get('/', response_model=list[DarlehenResponse])
def list_darlehen(db: Session = Depends(get_db)):
    return db.query(Darlehen).order_by(Darlehen.bezeichnung).all()


@router.post('/', response_model=DarlehenResponse, status_code=201)
def create_darlehen(data: DarlehenCreate, db: Session = Depends(get_db)):
    darlehen = Darlehen(**data.model_dump())
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
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(darlehen, field, value)
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
