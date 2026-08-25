"""Kapitalentnahme-Mathematik — kanonische, getestete Implementierung.

Ein Kapitalstock wird monatlich verzinst und um eine feste Entnahme reduziert —
die Umkehrung eines Annuitätendarlehens (dort wächst die Restschuld durch
Zinsen und schrumpft durch die Rate; hier wächst das Kapital durch Zinsen und
schrumpft durch die Entnahme, exakt dieselbe Rekursion).
"""
import math
from dataclasses import dataclass, field
from typing import Optional


def entnahme_aus_laufzeit(kapital: float, zinssatz: float, laufzeit_monate: int) -> float:
    """Monatliche Entnahme, die das Kapital exakt über die gegebene Laufzeit
    verzehrt (Umkehrung der Annuitätenformel — analog zu drRateAusLaufzeit
    beim Darlehen).

    zinssatz als Dezimalwert (0.03 = 3 % p. a.).
    """
    if kapital <= 0 or laufzeit_monate <= 0:
        return 0.0
    r = zinssatz / 12.0
    if r <= 0:
        return round(kapital / laufzeit_monate, 2)
    faktor = 1 - (1 + r) ** -laufzeit_monate
    return round(kapital * r / faktor, 2)


def max_entnahme_bei_kapitalerhalt(kapital: float, zinssatz: float) -> float:
    """Monatliche Entnahme, bei der der Kapitalstock nominal erhalten bleibt
    (ewige Rente = Zinsertrag eines Monats). Auf volle Cent ABgerundet, nicht
    gerundet — jeder gerundete Wert über dem exakten Zinsertrag würde das
    Kapital entgegen der Zusage im Feldnamen langsam aufzehren."""
    if kapital <= 0:
        return 0.0
    return math.floor(kapital * zinssatz / 12.0 * 100) / 100


@dataclass
class JahresZeile:
    jahr: int
    zinsertrag: float
    entnahme: float
    kapital_ende: float


@dataclass
class EntnahmeplanErgebnis:
    jahre: list[JahresZeile] = field(default_factory=list)
    monate_gesamt: Optional[int] = None  # None = Kapital hält länger als max_jahre
    zinsertrag_gesamt: float = 0.0
    entnahme_gesamt: float = 0.0


def entnahmeplan(
    kapital: float,
    zinssatz: float,
    entnahme_monatlich: float,
    *,
    max_jahre: int = 60,
) -> EntnahmeplanErgebnis:
    """Simuliert die Entnahme Monat für Monat, aggregiert auf Jahresebene."""
    if kapital <= 0 or entnahme_monatlich <= 0:
        return EntnahmeplanErgebnis()

    r_monat = zinssatz / 12.0
    rest = kapital
    jahre: list[JahresZeile] = []
    zinsertrag_gesamt = 0.0
    entnahme_gesamt = 0.0
    jahr_zins = jahr_entnahme = 0.0
    monat_in_jahr = 0
    monate_gesamt: Optional[int] = None

    for monat_idx in range(max_jahre * 12):
        if rest <= 0.005:
            break

        zins_monat = rest * r_monat
        entnahme_monat = min(entnahme_monatlich, rest + zins_monat)

        rest = max(rest + zins_monat - entnahme_monat, 0.0)
        jahr_zins += zins_monat
        jahr_entnahme += entnahme_monat
        zinsertrag_gesamt += zins_monat
        entnahme_gesamt += entnahme_monat
        monat_in_jahr += 1

        if rest <= 0.005 and monate_gesamt is None:
            monate_gesamt = monat_idx + 1

        if monat_in_jahr == 12 or rest <= 0.005:
            jahre.append(JahresZeile(
                jahr=len(jahre) + 1,
                zinsertrag=round(jahr_zins, 2),
                entnahme=round(jahr_entnahme, 2),
                kapital_ende=round(rest, 2),
            ))
            jahr_zins = jahr_entnahme = 0.0
            monat_in_jahr = 0

    return EntnahmeplanErgebnis(
        jahre=jahre, monate_gesamt=monate_gesamt,
        zinsertrag_gesamt=round(zinsertrag_gesamt, 2),
        entnahme_gesamt=round(entnahme_gesamt, 2),
    )
