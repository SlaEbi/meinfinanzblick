from fastapi import APIRouter

from ..schemas import KapitalentnahmeResponse
from ..services.kapitalentnahme import (
    entnahme_aus_laufzeit, entnahmeplan, max_entnahme_bei_kapitalerhalt,
)

router = APIRouter(prefix='/kapitalentnahme', tags=['Kapitalentnahme'])


@router.get('/simulation', response_model=KapitalentnahmeResponse)
def simulate_kapitalentnahme(
    kapital: float,
    zinssatz: float,
    modus: str = 'betrag',       # 'betrag' = Entnahme aus Laufzeit ableiten, 'laufzeit' = Laufzeit aus Entnahme ableiten
    laufzeit_jahre: float = 0.0,
    entnahme_monatlich: float = 0.0,
):
    """Freier Kapitalentnahme-Rechner — zustandslos, kein DB-Zugriff.

    Beide Richtungen laufen über denselben Simulationskern: im Modus 'betrag'
    wird die Entnahme zunächst per Formel aus der Ziel-Laufzeit abgeleitet,
    danach in beiden Fällen Monat für Monat simuliert — so liefert
    monate_gesamt immer den tatsächlich simulierten Wert statt zweier
    potenziell leicht abweichender Rechenwege.
    """
    entnahme = (
        entnahme_aus_laufzeit(kapital, zinssatz, round(laufzeit_jahre * 12))
        if modus == 'betrag' else entnahme_monatlich
    )
    plan = entnahmeplan(kapital, zinssatz, entnahme)
    return KapitalentnahmeResponse(
        jahre=plan.jahre,
        monatliche_entnahme=entnahme,
        monate_gesamt=plan.monate_gesamt,
        zinsertrag_gesamt=plan.zinsertrag_gesamt,
        entnahme_gesamt=plan.entnahme_gesamt,
        max_entnahme_kapitalerhalt=max_entnahme_bei_kapitalerhalt(kapital, zinssatz),
    )
