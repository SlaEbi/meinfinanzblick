from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import DarlehensSzenario
from ..schemas import DarlehensSzenarioCreate, DarlehensSzenarioResponse

router = APIRouter(prefix='/darlehens-szenarien', tags=['Darlehensrechner-Szenarien'])


@router.get('/', response_model=list[DarlehensSzenarioResponse])
def list_szenarien(db: Session = Depends(get_db)):
    return db.query(DarlehensSzenario).order_by(DarlehensSzenario.erstellt_am.desc()).all()


@router.post('/', response_model=DarlehensSzenarioResponse, status_code=201)
def create_szenario(data: DarlehensSzenarioCreate, db: Session = Depends(get_db)):
    szenario = DarlehensSzenario(**data.model_dump())
    db.add(szenario)
    db.commit()
    db.refresh(szenario)
    return szenario


@router.delete('/{szenario_id}', status_code=204)
def delete_szenario(szenario_id: int, db: Session = Depends(get_db)):
    szenario = db.query(DarlehensSzenario).filter(DarlehensSzenario.id == szenario_id).first()
    if not szenario:
        raise HTTPException(status_code=404, detail='Szenario nicht gefunden')
    db.delete(szenario)
    db.commit()
