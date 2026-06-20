"""Tilgungsmathematik — kanonische, getestete Implementierung.

Diese Funktionen sind die Referenz für die Restlaufzeit-Berechnung.
Das Frontend (app.js → restlaufzeitMonate) bildet dieselbe Formel ab;
hier liegt die testbare Quelle der Wahrheit.
"""
import math
from dataclasses import dataclass
from typing import Optional


@dataclass
class Restlaufzeit:
    monate: Optional[int] = None
    fehler: Optional[str] = None  # 'unvollstaendig' | 'rate_zu_niedrig'


def restlaufzeit_monate(restschuld: float, zinssatz: float, rate: float) -> Restlaufzeit:
    """Anzahl Monate bis zur vollständigen Tilgung (Annuitätendarlehen).

    zinssatz als Dezimalwert (0.035 = 3,5 % p. a.), Rate und Restschuld in €.
    Aufgerundet auf volle Monate (die letzte Rate ist meist kleiner).
    """
    if restschuld <= 0 or rate <= 0:
        return Restlaufzeit(fehler='unvollstaendig')

    r = zinssatz / 12.0
    if r <= 0:
        # zinsfrei: lineare Tilgung
        return Restlaufzeit(monate=math.ceil(restschuld / rate))

    zins_anteil = restschuld * r
    if rate <= zins_anteil:
        # Rate deckt nicht einmal die Monatszinsen → läuft ewig
        return Restlaufzeit(fehler='rate_zu_niedrig')

    monate = math.ceil(math.log(rate / (rate - zins_anteil)) / math.log(1 + r))
    return Restlaufzeit(monate=monate)
