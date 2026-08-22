from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Dokument
from ..schemas import DokumentCreate, DokumentUpdate, DokumentResponse
from .anhaenge import delete_anhaenge_fuer

router = APIRouter(tags=['Dokumente'])


@router.get('/dokumente/', response_model=list[DokumentResponse])
def list_dokumente(db: Session = Depends(get_db)):
    return db.query(Dokument).order_by(Dokument.kategorie, Dokument.titel).all()


@router.post('/dokumente/', response_model=DokumentResponse, status_code=201)
def create_dokument(data: DokumentCreate, db: Session = Depends(get_db)):
    d = Dokument(**data.model_dump())
    db.add(d)
    db.commit()
    db.refresh(d)
    return d


@router.put('/dokumente/{id}', response_model=DokumentResponse)
def update_dokument(id: int, data: DokumentUpdate, db: Session = Depends(get_db)):
    d = db.get(Dokument, id)
    if not d:
        raise HTTPException(404, 'Dokument nicht gefunden')
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(d, field, val)
    db.commit()
    db.refresh(d)
    return d


@router.delete('/dokumente/{id}', status_code=204)
def delete_dokument(id: int, db: Session = Depends(get_db)):
    d = db.get(Dokument, id)
    if not d:
        raise HTTPException(404, 'Dokument nicht gefunden')
    delete_anhaenge_fuer('dokument', id, db)
    db.delete(d)
    db.commit()
