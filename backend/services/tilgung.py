"""Tilgungsmathematik — kanonische, getestete Implementierung.

Diese Funktionen sind die Referenz für Restlaufzeit und Tilgungsplan.
Das Frontend (app.js → restlaufzeitMonate) bildet die Restlaufzeit-Formel
zusätzlich nach für die Sofort-Anzeige in der Darlehen-Tabelle; der
Tilgungsplan mit Sondertilgungs-Szenario läuft dagegen ausschließlich hier
und wird per API abgerufen — hier liegt die testbare Quelle der Wahrheit.
"""
import math
from dataclasses import dataclass, field
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


@dataclass
class MonatsZeile:
    monat: int            # laufende Rate (1 = erste Abbuchung)
    zins: float
    tilgung: float
    sondertilgung: float
    restschuld_ende: float


@dataclass
class JahresZeile:
    jahr: int
    zins: float
    tilgung: float
    sondertilgung: float
    restschuld_ende: float
    # Einzelne Raten des Planjahres — für die aufklappbare Monatsansicht
    monate: list[MonatsZeile] = field(default_factory=list)


@dataclass
class TilgungsplanErgebnis:
    jahre: list[JahresZeile] = field(default_factory=list)
    monate_gesamt: Optional[int] = None   # None = nicht binnen max_jahre getilgt
    zinsen_gesamt: float = 0.0


def tilgungsplan(
    restschuld: float,
    zinssatz: float,
    rate_monatlich: float,
    *,
    darlehen_typ: str = 'annuitaet',
    tilgungsrate_monatlich: float = 0.0,
    sondertilgung_jahr: float = 0.0,
    tilgungsfreie_monate: int = 0,
    zinstage_erste_rate: int = 30,
    max_jahre: int = 60,
) -> TilgungsplanErgebnis:
    """Simuliert die Tilgung Monat für Monat, aggregiert auf Jahresebene.

    Annuitätendarlehen: rate_monatlich ist die feste Netto-Rate (Zins+Tilgung,
    ohne USt — die trägt nicht zum Schuldenabbau bei). Tilgungsdarlehen: feste
    Tilgungsrate, die Monatszinsen kommen obendrauf.

    Eine optionale jährliche Sondertilgung wird einmal pro Kalenderjahr
    angesetzt (typischer Vertragsstichtag: nach der Dezember-Rate) und
    zusätzlich zur laufenden Tilgung von der Restschuld abgezogen.

    Tilgungsfreie Monate am Anfang: In dieser Anlaufphase werden nur die
    Zinsen gezahlt, die Restschuld bleibt stehen — auch keine Sondertilgung.
    Danach startet die normale Tilgung mit der vollen Darlehenssumme; die
    Gesamtlaufzeit (monate_gesamt) enthält die tilgungsfreie Zeit.

    Zinstage bis zur ersten Rate (30/360): Liegt die erste Abbuchung nicht
    genau einen Monat nach Darlehensbeginn, fallen in der ersten Periode
    anteilig mehr oder weniger Zinsen an (z. B. Beginn 1.3., erste Rate
    30.3. → 29 Tage). Bei der Annuität ändert das nur den Tilgungsanteil
    der ersten Rate, ab der zweiten Rate läuft alles im Monatsraster.
    """
    if restschuld <= 0:
        return TilgungsplanErgebnis()

    r_monat = zinssatz / 12.0
    rest = restschuld
    jahre: list[JahresZeile] = []
    zinsen_gesamt = 0.0
    jahr_zins = jahr_tilgung = jahr_sonder = 0.0
    monat_in_jahr = 0
    monate_gesamt: Optional[int] = None
    tilgungsfreie_monate = max(0, int(tilgungsfreie_monate))
    jahr_monate: list[MonatsZeile] = []

    for monat_idx in range(max_jahre * 12):
        if rest <= 0.005:
            break

        zins_monat = rest * r_monat
        if monat_idx == 0:
            zins_monat *= max(0, zinstage_erste_rate) / 30.0
        tilgungsfrei = monat_idx < tilgungsfreie_monate
        if tilgungsfrei:
            tilgung_monat = 0.0
        elif darlehen_typ == 'tilgungsdarlehen':
            tilgung_monat = min(tilgungsrate_monatlich, rest)
        else:
            tilgung_monat = min(max(rate_monatlich - zins_monat, 0.0), rest)

        rest = max(rest - tilgung_monat, 0.0)
        jahr_zins += zins_monat
        jahr_tilgung += tilgung_monat
        zinsen_gesamt += zins_monat
        monat_in_jahr += 1

        # Sondertilgung nur, wenn das Jahr voll ist UND noch etwas offen ist —
        # sonst würde ein im Dezember bereits getilgtes Darlehen eine
        # Sondertilgung "ins Leere" verbuchen.
        sonder = 0.0
        if monat_in_jahr == 12 and not tilgungsfrei and sondertilgung_jahr > 0 and rest > 0.005:
            sonder = min(sondertilgung_jahr, rest)
            rest = max(rest - sonder, 0.0)
            jahr_sonder += sonder

        jahr_monate.append(MonatsZeile(
            monat=monat_idx + 1,
            zins=round(zins_monat, 2),
            tilgung=round(tilgung_monat, 2),
            sondertilgung=round(sonder, 2),
            restschuld_ende=round(rest, 2),
        ))

        if rest <= 0.005 and monate_gesamt is None:
            monate_gesamt = monat_idx + 1

        if monat_in_jahr == 12 or rest <= 0.005:
            jahre.append(JahresZeile(
                jahr=len(jahre) + 1,
                zins=round(jahr_zins, 2),
                tilgung=round(jahr_tilgung, 2),
                sondertilgung=round(jahr_sonder, 2),
                restschuld_ende=round(rest, 2),
                monate=jahr_monate,
            ))
            jahr_zins = jahr_tilgung = jahr_sonder = 0.0
            monat_in_jahr = 0
            jahr_monate = []

    return TilgungsplanErgebnis(jahre=jahre, monate_gesamt=monate_gesamt, zinsen_gesamt=round(zinsen_gesamt, 2))
