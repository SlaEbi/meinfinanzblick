from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..db import get_db
from ..models import Sachvermoegen
from ..schemas import SachvermoegenCreate, SachvermoegenUpdate, SachvermoegenResponse

router = APIRouter(prefix='/sachvermoegen', tags=['Sachwerte'])


@router.get('/', response_model=list[SachvermoegenResponse])
def list_sachvermoegen(db: Session = Depends(get_db)):
    return db.query(Sachvermoegen).order_by(Sachvermoegen.kategorie, Sachvermoegen.bezeichnung).all()


@router.post('/', response_model=SachvermoegenResponse, status_code=201)
def create_sachvermoegen(data: SachvermoegenCreate, db: Session = Depends(get_db)):
    obj = Sachvermoegen(**data.model_dump(), aktualisiert_am=datetime.now(timezone.utc))
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get('/{item_id}', response_model=SachvermoegenResponse)
def get_sachvermoegen(item_id: int, db: Session = Depends(get_db)):
    obj = db.query(Sachvermoegen).filter(Sachvermoegen.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail='Sachwert nicht gefunden')
    return obj


@router.put('/{item_id}', response_model=SachvermoegenResponse)
def update_sachvermoegen(item_id: int, data: SachvermoegenUpdate, db: Session = Depends(get_db)):
    obj = db.query(Sachvermoegen).filter(Sachvermoegen.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail='Sachwert nicht gefunden')
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(obj, field, value)
    obj.aktualisiert_am = datetime.now(timezone.utc)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete('/{item_id}', status_code=204)
def delete_sachvermoegen(item_id: int, db: Session = Depends(get_db)):
    obj = db.query(Sachvermoegen).filter(Sachvermoegen.id == item_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail='Sachwert nicht gefunden')
    db.delete(obj)
    db.commit()
