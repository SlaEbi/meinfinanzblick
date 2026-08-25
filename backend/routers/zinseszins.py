from fastapi import APIRouter

from ..schemas import ZinseszinsResponse
from ..services.zinseszins import zinseszins_verlauf

router = APIRouter(prefix='/zinseszins', tags=['Zinseszins'])


@router.get('/simulation', response_model=ZinseszinsResponse)
def simulate_zinseszins(
    startkapital: float,
    sparrate_monatlich: float,
    zinssatz: float,
    laufzeit_jahre: int,
    inflationsrate: float = 0.0,
):
    """Freier Zinseszins-Simulator — zustandslos, kein DB-Zugriff."""
    ergebnis = zinseszins_verlauf(
        startkapital, sparrate_monatlich, zinssatz, laufzeit_jahre, inflationsrate,
    )
    return ZinseszinsResponse(
        jahre=ergebnis.jahre,
        gesamtkapital_end=ergebnis.gesamtkapital_end,
        einzahlungen_gesamt=ergebnis.einzahlungen_gesamt,
        zinsertrag_gesamt=ergebnis.zinsertrag_gesamt,
    )
