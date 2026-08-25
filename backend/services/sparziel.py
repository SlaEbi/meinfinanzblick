"""Sparziel-Mathematik — kanonische, getestete Implementierung.

Berechnet, welche monatliche Sparrate von heute an nötig ist, um ein Sparziel
(Zielbetrag zu einem Zieldatum) zu erreichen — die Umkehrung der
Zinseszinsformel (dort ist die Sparrate gegeben und das Endkapital gesucht,
hier ist das Endkapital das Ziel und die Sparrate gesucht).
"""
from datetime import date


def monate_bis(zieldatum: date, heute: date) -> int:
    """Anzahl volle Kalendermonate von heute bis zum Zieldatum, nie negativ."""
    monate = (zieldatum.year - heute.year) * 12 + (zieldatum.month - heute.month)
    if zieldatum.day < heute.day:
        monate -= 1
    return max(monate, 0)


def benoetigte_monatsrate(
    zielbetrag: float,
    aktueller_stand: float,
    zinssatz: float,
    monate_bis_ziel: int,
) -> float:
    """Monatliche Sparrate, die aktueller_stand bis zum Zieldatum exakt auf
    zielbetrag anwachsen lässt. zinssatz als Dezimalwert (0.02 = 2 % p. a.).

    Ist das Ziel bereits erreicht oder überschritten, ist keine weitere Rate
    nötig (0.0). Ist die Zielzeit schon verstrichen (monate_bis_ziel == 0),
    fehlt der volle Restbetrag sofort.
    """
    restbetrag = zielbetrag - aktueller_stand
    if restbetrag <= 0:
        return 0.0
    if monate_bis_ziel <= 0:
        return round(restbetrag, 2)

    r = zinssatz / 12.0
    if r <= 0:
        return round(restbetrag / monate_bis_ziel, 2)

    endwert_bestand = aktueller_stand * (1 + r) ** monate_bis_ziel
    faktor = ((1 + r) ** monate_bis_ziel - 1) / r
    rate = (zielbetrag - endwert_bestand) / faktor
    return round(max(rate, 0.0), 2)
