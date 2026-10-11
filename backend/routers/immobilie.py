from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ImmobilienSzenario
from ..schemas import (
    ImmobilieEingabenSchema, ImmobilieErgebnisResponse,
    ImmobilienSzenarioCreate, ImmobilienSzenarioResponse, ImmobilienVergleichZeile,
)
from ..services.immobilie import ImmobilieEingaben, berechne

router = APIRouter(prefix='/immobilie', tags=['Immobilienrechner'])


@router.post('/berechnung', response_model=ImmobilieErgebnisResponse)
def berechnung(eingaben: ImmobilieEingabenSchema):
    """Immobilienrechner (Kapitalanlage) — zustandslos, kein DB-Zugriff.
    POST statt GET, weil die Eingaben für Query-Parameter zu zahlreich sind."""
    return _rechne(eingaben)


def _rechne(eingaben: ImmobilieEingabenSchema):
    return berechne(ImmobilieEingaben(**eingaben.model_dump(exclude={'bundesland'})))


# ── Gespeicherte Szenarien (Objekte) ─────────────────────────────────────────

@router.get('/szenarien', response_model=list[ImmobilienSzenarioResponse])
def list_szenarien(db: Session = Depends(get_db)):
    return db.query(ImmobilienSzenario).order_by(ImmobilienSzenario.erstellt_am.desc()).all()


@router.get('/szenarien/vergleich', response_model=list[ImmobilienVergleichZeile])
def vergleich(db: Session = Depends(get_db)):
    """Kennzahlen aller gespeicherten Szenarien nebeneinander — jedes wird
    mit seinen eigenen Eingaben frisch durchgerechnet."""
    zeilen = []
    for s in db.query(ImmobilienSzenario).order_by(ImmobilienSzenario.erstellt_am.desc()).all():
        try:
            eingaben = ImmobilieEingabenSchema(**s.eingaben)
        except ValidationError:
            continue  # beschädigtes/veraltetes Szenario nicht den ganzen Vergleich kippen lassen
        r = _rechne(eingaben)
        zeilen.append(ImmobilienVergleichZeile(
            id=s.id, name=s.name,
            kaufpreis=eingaben.kaufpreis, eigenkapital=eingaben.eigenkapital,
            betrachtung_jahre=eingaben.betrachtung_jahre,
            bruttomietrendite=r.bruttomietrendite, kaufpreisfaktor=r.kaufpreisfaktor,
            cashflow_nach_steuern_monat=r.cashflow_nach_steuern_monat,
            eigenkapitalrendite=r.eigenkapitalrendite, irr=r.irr,
            vermoegenszuwachs=r.vermoegenszuwachs,
            warnungen_kritisch=sum(1 for w in r.warnungen if w.stufe == 'urgent'),
        ))
    return zeilen


@router.post('/szenarien', response_model=ImmobilienSzenarioResponse, status_code=201)
def create_szenario(data: ImmobilienSzenarioCreate, db: Session = Depends(get_db)):
    szenario = ImmobilienSzenario(name=data.name.strip(), eingaben=data.eingaben.model_dump())
    db.add(szenario)
    db.commit()
    db.refresh(szenario)
    return szenario


@router.put('/szenarien/{szenario_id}', response_model=ImmobilienSzenarioResponse)
def update_szenario(szenario_id: int, data: ImmobilienSzenarioCreate, db: Session = Depends(get_db)):
    szenario = db.query(ImmobilienSzenario).filter(ImmobilienSzenario.id == szenario_id).first()
    if not szenario:
        raise HTTPException(status_code=404, detail='Szenario nicht gefunden')
    szenario.name = data.name.strip()
    szenario.eingaben = data.eingaben.model_dump()
    db.commit()
    db.refresh(szenario)
    return szenario


@router.delete('/szenarien/{szenario_id}', status_code=204)
def delete_szenario(szenario_id: int, db: Session = Depends(get_db)):
    szenario = db.query(ImmobilienSzenario).filter(ImmobilienSzenario.id == szenario_id).first()
    if not szenario:
        raise HTTPException(status_code=404, detail='Szenario nicht gefunden')
    db.delete(szenario)
    db.commit()
