from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from ..db import get_db
from ..models import Konto, Depot, Darlehen, Sachvermoegen, NetWorthSnapshot
from ..schemas import NetWorthData, NetWorthSummary, NetWorthSnapshotResponse

router = APIRouter(prefix='/networth', tags=['Net Worth'])


def _berechne_aktuell(db: Session) -> NetWorthSummary:
    summe_konten        = float(db.query(func.sum(Konto.saldo)).scalar() or 0)
    summe_depots        = float(db.query(func.sum(Depot.wert_aktuell)).scalar() or 0)
    summe_sachvermoegen = float(db.query(func.sum(Sachvermoegen.aktueller_wert)).scalar() or 0)
    summe_schulden      = float(db.query(func.sum(Darlehen.restschuld)).scalar() or 0)
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
    verlauf = (
        db.query(NetWorthSnapshot)
        .order_by(NetWorthSnapshot.datum)
        .limit(24)
        .all()
    )
    return NetWorthData(aktuell=aktuell, verlauf=verlauf)


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
