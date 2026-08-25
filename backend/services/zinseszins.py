"""Zinseszinsmathematik — kanonische, getestete Implementierung.

Simuliert Monat für Monat (Zins auf den Kontostand, dann Sparrate dazu),
aggregiert auf Jahresebene, analog zum Stil von services/tilgung.py.
"""
from dataclasses import dataclass, field


@dataclass
class ZinseszinsJahr:
    jahr: int
    einzahlungen_kumuliert: float
    zinsertrag_kumuliert: float
    gesamtkapital: float
    gesamtkapital_real: float  # inflationsbereinigt, in heutiger Kaufkraft


@dataclass
class ZinseszinsErgebnis:
    jahre: list[ZinseszinsJahr] = field(default_factory=list)
    gesamtkapital_end: float = 0.0
    einzahlungen_gesamt: float = 0.0
    zinsertrag_gesamt: float = 0.0


def zinseszins_verlauf(
    startkapital: float,
    sparrate_monatlich: float,
    zinssatz: float,
    laufzeit_jahre: int,
    inflationsrate: float = 0.0,
) -> ZinseszinsErgebnis:
    """zinssatz und inflationsrate als Dezimalwert (0.06 = 6 % p. a.).

    Sparrate wird jeweils am Monatsende nach der Verzinsung angelegt.
    `gesamtkapital_real` rechnet das nominale Kapital eines Jahres auf die
    Kaufkraft von heute um (Diskontierung mit der Inflationsrate).
    """
    if laufzeit_jahre <= 0:
        return ZinseszinsErgebnis()

    r_monat = zinssatz / 12.0
    kapital = max(startkapital, 0.0)
    eingezahlt = max(startkapital, 0.0)
    jahre: list[ZinseszinsJahr] = []

    for jahr in range(1, laufzeit_jahre + 1):
        for _ in range(12):
            kapital += kapital * r_monat + sparrate_monatlich
            eingezahlt += sparrate_monatlich

        kapital_real = kapital / ((1 + inflationsrate) ** jahr)
        jahre.append(ZinseszinsJahr(
            jahr=jahr,
            einzahlungen_kumuliert=round(eingezahlt, 2),
            zinsertrag_kumuliert=round(kapital - eingezahlt, 2),
            gesamtkapital=round(kapital, 2),
            gesamtkapital_real=round(kapital_real, 2),
        ))

    return ZinseszinsErgebnis(
        jahre=jahre,
        gesamtkapital_end=round(kapital, 2),
        einzahlungen_gesamt=round(eingezahlt, 2),
        zinsertrag_gesamt=round(kapital - eingezahlt, 2),
    )
