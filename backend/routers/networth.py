from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from ..db import get_db
from ..models import Konto, Depot, Darlehen, Sachvermoegen, NetWorthSnapshot
from ..schemas import NetWorthData, NetWorthSummary, NetWorthSnapshotResponse

router = APIRouter(prefix='/networth', tags=['Net Worth'])


def _berechne_aktuell(db: Session) -> NetWorthSummary:
    summe_konten  = float(db.query(func.sum(Konto.saldo)).scalar() or 0)
    summe_depots  = float(db.query(func.sum(Depot.wert_aktuell)).scalar() or 0)

    # Sachwerte und Darlehen mit Eigentumsanteil gewichten
    sachwerte           = db.query(Sachvermoegen).all()
    summe_sachvermoegen = sum(
        float(s.aktueller_wert) * float(s.anteil_pct or 100) / 100
        for s in sachwerte
    )
    darlehen       = db.query(Darlehen).all()
    summe_schulden = sum(
        float(d.restschuld) * float(d.anteil_pct or 100) / 100
        for d in darlehen
    )
    vermoegen_brutto    = summe_konten + summe_depots + summe_sachvermoegen
    netto               = vermoegen_brutto - summe_schulden
    return NetWorthSummary(
        summe_konten=round(summe_konten, 2),
        summe_depots=round(summe_depots, 2),
        summe_sachvermoegen=round(summe_sachvermoegen, 2),
        summe_schulden=round(summe_schulden, 2),
        vermoegen_brutto=round(vermoegen_brutto, 2),
        netto=round(netto, 2),
    )


@router.get('/', response_model=NetWorthData)
def get_networth(db: Session = Depends(get_db)):
    aktuell = _berechne_aktuell(db)
    # Neueste 24 Snapshots holen (absteigend), dann für die Chart-Anzeige
    # chronologisch umdrehen — sonst zeigt der Verlauf ab dem 25. Snapshot
    # dauerhaft die ältesten statt der aktuellen Stände.
    verlauf = (
        db.query(NetWorthSnapshot)
        .order_by(NetWorthSnapshot.datum.desc())
        .limit(24)
        .all()
    )
    verlauf.reverse()
    return NetWorthData(aktuell=aktuell, verlauf=verlauf)


@router.delete('/snapshot/{snapshot_id}', status_code=204)
def delete_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    s = db.query(NetWorthSnapshot).filter(NetWorthSnapshot.id == snapshot_id).first()
    if not s:
        raise HTTPException(404, 'Snapshot nicht gefunden')
    db.delete(s)
    db.commit()
    return None


@router.post('/snapshot', response_model=NetWorthSnapshotResponse, status_code=201)
def create_snapshot(db: Session = Depends(get_db)):
    aktuell = _berechne_aktuell(db)
    today = date.today()

    existing = db.query(NetWorthSnapshot).filter(NetWorthSnapshot.datum == today).first()
    if existing:
        existing.summe_vermoegen = aktuell.vermoegen_brutto
        existing.summe_schulden = aktuell.summe_schulden
        existing.netto = aktuell.netto
        db.commit()
        db.refresh(existing)
        return existing

    snapshot = NetWorthSnapshot(
        datum=today,
        summe_vermoegen=aktuell.vermoegen_brutto,
        summe_schulden=aktuell.summe_schulden,
        netto=aktuell.netto,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot
