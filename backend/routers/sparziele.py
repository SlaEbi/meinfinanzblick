from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Sparziel, SparzielFuetterung
from ..schemas import SparzielCreate, SparzielUpdate, SparzielResponse, SparzielFuetterungCreate
from ..services.sparziel import benoetigte_monatsrate, monate_bis

router = APIRouter(prefix='/sparziele', tags=['Sparziele'])


def _to_response(sparziel: Sparziel) -> SparzielResponse:
    """Ergänzt die gespeicherten Felder um die abgeleiteten Kennzahlen — der
    aktuelle Stand ist immer die Summe der Fütterungen, nie ein eigenes,
    potenziell aus dem Tritt geratenes Feld."""
    heute = date.today()
    stand = sum(float(f.betrag) for f in sparziel.fuetterungen)
    ziel = float(sparziel.zielbetrag)
    restbetrag = max(ziel - stand, 0.0)
    fortschritt = min(stand / ziel, 1.0) if ziel > 0 else 0.0
    monate = monate_bis(sparziel.zieldatum, heute)
    rate = benoetigte_monatsrate(ziel, stand, float(sparziel.zinssatz or 0), monate)

    return SparzielResponse(
        id=sparziel.id,
        name=sparziel.name,
        zielbetrag=ziel,
        zieldatum=sparziel.zieldatum,
        zinssatz=float(sparziel.zinssatz or 0),
        aufbewahrungsort=sparziel.aufbewahrungsort,
        notiz=sparziel.notiz,
        archiviert=sparziel.archiviert,
        fuetterungen=sparziel.fuetterungen,
        aktueller_stand=round(stand, 2),
        restbetrag=round(restbetrag, 2),
        fortschritt_pct=round(fortschritt * 100, 1),
        monate_bis_ziel=monate,
        benoetigte_monatsrate=rate,
        aktualisiert_am=sparziel.aktualisiert_am,
    )


def _get_or_404(db: Session, sparziel_id: int) -> Sparziel:
    sparziel = (
        db.query(Sparziel)
        .options(joinedload(Sparziel.fuetterungen))
        .filter(Sparziel.id == sparziel_id)
        .first()
    )
    if not sparziel:
        raise HTTPException(status_code=404, detail='Sparziel nicht gefunden')
    return sparziel


@router.get('/', response_model=list[SparzielResponse])
def list_sparziele(db: Session = Depends(get_db)):
    sparziele = (
        db.query(Sparziel)
        .options(joinedload(Sparziel.fuetterungen))
        .order_by(Sparziel.archiviert, Sparziel.zieldatum)
        .all()
    )
    return [_to_response(s) for s in sparziele]


@router.post('/', response_model=SparzielResponse, status_code=201)
def create_sparziel(data: SparzielCreate, db: Session = Depends(get_db)):
    sparziel = Sparziel(**data.model_dump())
    db.add(sparziel)
    db.commit()
    db.refresh(sparziel)
    return _to_response(sparziel)


@router.get('/{sparziel_id}', response_model=SparzielResponse)
def get_sparziel(sparziel_id: int, db: Session = Depends(get_db)):
    return _to_response(_get_or_404(db, sparziel_id))


@router.put('/{sparziel_id}', response_model=SparzielResponse)
def update_sparziel(sparziel_id: int, data: SparzielUpdate, db: Session = Depends(get_db)):
    sparziel = _get_or_404(db, sparziel_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(sparziel, field, value)
    sparziel.aktualisiert_am = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sparziel)
    return _to_response(sparziel)


@router.delete('/{sparziel_id}', status_code=204)
def delete_sparziel(sparziel_id: int, db: Session = Depends(get_db)):
    sparziel = _get_or_404(db, sparziel_id)
    db.delete(sparziel)
    db.commit()


# ── Fütterungen ───────────────────────────────────────────────────────────────

@router.post('/{sparziel_id}/fuetterungen', response_model=SparzielResponse, status_code=201)
def create_fuetterung(sparziel_id: int, data: SparzielFuetterungCreate, db: Session = Depends(get_db)):
    sparziel = _get_or_404(db, sparziel_id)
    fuetterung = SparzielFuetterung(**data.model_dump(), sparziel_id=sparziel_id)
    db.add(fuetterung)
    sparziel.aktualisiert_am = datetime.now(timezone.utc)
    db.commit()
    db.refresh(sparziel)
    # Gibt das ganze Sparziel zurück statt nur der neuen Fütterung — das
    # Frontend braucht sofort den neuen Stand für die Fütter-Animation, ohne
    # zweiten Request.
    return _to_response(sparziel)


@router.delete('/{sparziel_id}/fuetterungen/{fuetterung_id}', response_model=SparzielResponse)
def delete_fuetterung(sparziel_id: int, fuetterung_id: int, db: Session = Depends(get_db)):
    fuetterung = db.query(SparzielFuetterung).filter(
        SparzielFuetterung.id == fuetterung_id,
        SparzielFuetterung.sparziel_id == sparziel_id,
    ).first()
    if not fuetterung:
        raise HTTPException(status_code=404, detail='Fütterung nicht gefunden')
    db.delete(fuetterung)
    db.commit()
    return _to_response(_get_or_404(db, sparziel_id))
