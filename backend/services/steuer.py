"""Steuerprognose — kanonische, getestete Berechnungslogik.

Deckt ab: Einkommensteuer (Grund-/Splittingtarif, Kinderfreibetrag-
Günstigerprüfung, Soli), Gewerbesteuer mit Zerlegung auf mehrere Gemeinden,
Anrechnung nach § 35 EStG, sowie den Abgleich mit geleisteten
Vorauszahlungen.

Alle Geldwerte als Decimal. Diese Datei ist reine Rechenlogik ohne DB-Zugriff
— die Tabellen-Modelle liegen in models.py, die Orchestrierung inkl.
DB-Laden im Router (routers/steuer.py).

WICHTIG: Dies ist eine Planungsrechnung für die eigene Vorsorge, keine
Steuerberatung und kein Ersatz für die Steuererklärung.
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal as D, ROUND_HALF_UP, ROUND_DOWN
import math

from .steuer_konstanten import parameter

CENT = D("0.01")


def _round_cent(x: D) -> D:
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


# ─────────────────────────────────────────────────────────────────────────────
# Einkommensteuertarif — § 32a EStG
# ─────────────────────────────────────────────────────────────────────────────

def est_tarif_grund(zve: D, jahr: int) -> D:
    """Tarifliche Einkommensteuer nach Grundtabelle (§ 32a Abs. 1 EStG).

    zve = zu versteuerndes Einkommen (auf volle Euro abgerundet), Einzelveranlagung.
    """
    p = parameter(jahr)
    x = D(int(zve))  # auf vollen Euro abrunden, wie im Gesetz vorgeschrieben
    if x <= 0:
        return D(0)

    gfb = p["grundfreibetrag"]
    if x <= gfb:
        return D(0)

    if x <= p["zone2_bis"]:
        y = (x - gfb) / D(10000)
        est = (p["zone2_a"] * y + p["zone2_b"]) * y
    elif x <= p["zone3_bis"]:
        z = (x - p["zone2_bis"]) / D(10000)
        est = (p["zone3_a"] * z + p["zone3_b"]) * z + p["zone3_c"]
    elif x <= p["zone4_bis"]:
        est = p["zone4_satz"] * x - p["zone4_abzug"]
    else:
        est = p["zone5_satz"] * x - p["zone5_abzug"]

    # § 32a Abs. 1 Satz 6: auf den nächsten vollen Euro abrunden
    return D(int(est))


def est_tarif_splitting(zve_gesamt: D, jahr: int) -> D:
    """Splittingverfahren (§ 32a Abs. 5 EStG): doppelte Steuer auf die Hälfte."""
    halbe = D(int(zve_gesamt)) / D(2)
    return D(2) * est_tarif_grund(halbe, jahr)


def est_tarif(zve: D, jahr: int, splitting: bool) -> D:
    return est_tarif_splitting(zve, jahr) if splitting else est_tarif_grund(zve, jahr)


# ─────────────────────────────────────────────────────────────────────────────
# Kinder — Kindergeld & Günstigerprüfung
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Kind:
    geburtsdatum: date
    in_ausbildung_18_25: bool = False
    name: str = ""


def kind_anspruchsberechtigt(kind: Kind, jahr: int) -> bool:
    """Grobe Anspruchsprüfung fürs Jahresende: unter 18, oder 18–25 in Ausbildung."""
    stichtag = date(jahr, 12, 31)
    alter = stichtag.year - kind.geburtsdatum.year - (
        (stichtag.month, stichtag.day) < (kind.geburtsdatum.month, kind.geburtsdatum.day)
    )
    if kind.geburtsdatum > stichtag:
        return False
    if alter < 18:
        return True
    return alter < 25 and kind.in_ausbildung_18_25


def kindergeld_monate_im_jahr(kind: Kind, jahr: int) -> int:
    """Anzahl Monate mit Kindergeldanspruch in diesem Jahr (monatsgenau ab Geburt)."""
    if not kind_anspruchsberechtigt(kind, jahr):
        return 0
    start_monat = kind.geburtsdatum.month if kind.geburtsdatum.year == jahr else 1
    return 12 - start_monat + 1


def kindergeld_jahresbetrag(kinder: list[Kind], jahr: int) -> D:
    p = parameter(jahr)
    monate = sum(kindergeld_monate_im_jahr(k, jahr) for k in kinder)
    return p["kindergeld_monatlich"] * D(monate)


@dataclass
class GuenstigerpruefungErgebnis:
    kinderfreibetrag_gesamt: D
    est_ohne_kfb: D
    est_mit_kfb: D
    steuerersparnis_kfb: D
    kindergeld_gesamt: D
    kinderfreibetrag_guenstiger: bool
    hinzurechnung_kindergeld: D  # § 31 S. 4 EStG: das volle erhaltene Kindergeld wird der Steuer wieder hinzugerechnet, wenn der Freibetrag günstiger ist
    est_festzusetzen: D          # die tatsächlich anzusetzende tarifliche ESt nach Günstigerprüfung


def guenstigerpruefung(zve_vor_kfb: D, kinder: list[Kind], jahr: int, splitting: bool) -> GuenstigerpruefungErgebnis:
    p = parameter(jahr)
    anzahl = sum(1 for k in kinder if kind_anspruchsberechtigt(k, jahr))
    je_kind = p["kinderfreibetrag_je_elternteil"] + p["bea_freibetrag_je_elternteil"]
    faktor = D(2) if splitting else D(1)  # beide Elternteile bei Zusammenveranlagung
    kfb_gesamt = je_kind * faktor * D(anzahl)

    est_ohne = est_tarif(zve_vor_kfb, jahr, splitting)
    est_mit = est_tarif(zve_vor_kfb - kfb_gesamt, jahr, splitting)
    ersparnis = est_ohne - est_mit
    kg_gesamt = kindergeld_jahresbetrag(kinder, jahr)

    # § 31 EStG: Freibetrag ist günstiger, wenn die Steuerersparnis das erhaltene
    # Kindergeld übersteigt. In diesem Fall wird das VOLLE Kindergeld der
    # Steuer wieder hinzugerechnet (Satz 4) — man behält also effektiv nur die
    # Differenz (ersparnis - kindergeld) als zusätzlichen Vorteil.
    guenstiger = ersparnis > kg_gesamt
    hinzurechnung = kg_gesamt if guenstiger else D(0)
    est_festzusetzen = est_mit + hinzurechnung if guenstiger else est_ohne

    return GuenstigerpruefungErgebnis(
        kinderfreibetrag_gesamt=kfb_gesamt,
        est_ohne_kfb=est_ohne,
        est_mit_kfb=est_mit,
        steuerersparnis_kfb=ersparnis,
        kindergeld_gesamt=kg_gesamt,
        kinderfreibetrag_guenstiger=guenstiger,
        hinzurechnung_kindergeld=hinzurechnung,
        est_festzusetzen=est_festzusetzen,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Solidaritätszuschlag
# ─────────────────────────────────────────────────────────────────────────────

def solidaritaetszuschlag(est_bemessung: D, jahr: int, splitting: bool) -> D:
    """§ 4 SolZG: Freigrenze mit Milderungszone (11,9 % des übersteigenden Betrags),
    danach 5,5 % der Bemessungsgrundlage."""
    p = parameter(jahr)
    freigrenze = p["soli_freigrenze_splitting"] if splitting else p["soli_freigrenze_single"]
    if est_bemessung <= freigrenze:
        return D(0)

    milderung = p["soli_milderungszone_faktor"] * (est_bemessung - freigrenze)
    regulaer = p["soli_satz"] * est_bemessung
    return _round_cent(min(milderung, regulaer))


# ─────────────────────────────────────────────────────────────────────────────
# Gewerbesteuer
# ─────────────────────────────────────────────────────────────────────────────

def gewerbeertrag(gewinn: D, hinzurechnung_zinsen_mieten: D, kuerzung_grundbesitz: D, jahr: int) -> D:
    """§ 7–9 GewStG, vereinfacht: Hinzurechnung § 8 Nr. 1 (25 % oberhalb 200.000 €
    Freibetrag der Summe aus Zinsen/Finanzierungsanteilen), Kürzung § 9 als
    direkter Betrag (z. B. aus dem letzten Bescheid, 1,2 % des Einheitswerts)."""
    p = parameter(jahr)
    ueberschuss = max(D(0), hinzurechnung_zinsen_mieten - p["gewst_hinzurechnung_freibetrag"])
    hinzurechnung = p["gewst_hinzurechnung_satz"] * ueberschuss
    ertrag = gewinn + hinzurechnung - kuerzung_grundbesitz
    return max(D(0), ertrag)


def gewerbesteuermessbetrag(gewerbeertrag_: D, jahr: int) -> D:
    """§ 11 GewStG: Ertrag auf volle 100 € abrunden, Freibetrag 24.500 €, ×3,5 %,
    Ergebnis auf volle € abrunden.

    Die letzte Abrundung ist keine Kosmetik: der Messbetrag ist die Grundlage
    für die Zerlegung UND für den 4-fach-Deckel der § 35-Anrechnung. Der echte
    Bescheid weist ihn deshalb als glatten Euro-Betrag aus ("abgerundet auf
    volle €") — 107.500 × 3,5 % = 3.762,50 wird zu 3.762.
    """
    p = parameter(jahr)
    abgerundet = (D(int(gewerbeertrag_)) // 100) * 100
    nach_freibetrag = max(D(0), abgerundet - p["gewst_freibetrag"])
    return D(int(nach_freibetrag * p["gewst_messzahl"]))


@dataclass
class Betriebsstaette:
    gemeinde: str
    hebesatz: D
    arbeitsloehne: D = D(0)          # bereits je AN auf 50.000 € gedeckelt einzutragen
    taetigkeitsanteil_pct: D = D(0)  # Anteil des Inhabers an dieser Betriebsstätte, für den fiktiven Unternehmerlohn
    prozent_manuell: D | None = None  # nur im Modus "prozent" genutzt
    vorauszahlung: D = D(0)          # GewSt-Vorauszahlung an DIESE Gemeinde



@dataclass
class ZerlegungsAnteil:
    gemeinde: str
    hebesatz: D
    anteil_pct: D
    messbetrag_anteil: D
    gewerbesteuer: D


def zerlegung_arbeitsloehne(betriebsstaetten: list[Betriebsstaette], messbetrag: D, jahr: int) -> list[ZerlegungsAnteil]:
    """§§ 28–31 GewStG: Zerlegung nach dem Verhältnis der Arbeitslöhne, inkl.
    fiktivem Unternehmerlohn (§ 31 Abs. 5, 25.000 €, verteilt nach Tätigkeitsanteil)."""
    p = parameter(jahr)
    unternehmerlohn = p["gewst_unternehmerlohn_fiktiv"]
    summe_taetigkeit = sum((b.taetigkeitsanteil_pct for b in betriebsstaetten), D(0)) or D(100)

    lohnsummen = []
    for b in betriebsstaetten:
        anteil_unternehmerlohn = unternehmerlohn * b.taetigkeitsanteil_pct / summe_taetigkeit
        lohnsummen.append(b.arbeitsloehne + anteil_unternehmerlohn)

    gesamt = sum(lohnsummen, D(0))
    if gesamt <= 0:
        # Ohne jede Lohnsumme (z. B. reiner Ein-Mann-Betrieb ohne Unternehmerlohn-Zuordnung)
        # gleichmäßig verteilen, damit die Funktion nicht durch Null teilt.
        n = len(betriebsstaetten) or 1
        anteile_pct = [D(100) / D(n) for _ in betriebsstaetten]
    else:
        anteile_pct = [(l / gesamt) * D(100) for l in lohnsummen]

    return _anteile_zu_ergebnis(betriebsstaetten, anteile_pct, messbetrag)


def zerlegung_prozent(betriebsstaetten: list[Betriebsstaette], messbetrag: D) -> list[ZerlegungsAnteil]:
    """Freier, manuell festgelegter Verteilungsschlüssel (z. B. grobe Schätzung
    nach Umsatzanteil) — bequem, aber nicht der gesetzliche Zerlegungsmaßstab."""
    anteile_pct = [b.prozent_manuell or D(0) for b in betriebsstaetten]
    summe = sum(anteile_pct, D(0)) or D(100)
    anteile_pct = [a / summe * D(100) for a in anteile_pct]
    return _anteile_zu_ergebnis(betriebsstaetten, anteile_pct, messbetrag)


def _anteile_zu_ergebnis(betriebsstaetten: list[Betriebsstaette], anteile_pct: list[D], messbetrag: D) -> list[ZerlegungsAnteil]:
    ergebnisse = []
    rest_messbetrag = messbetrag
    for i, (b, pct) in enumerate(zip(betriebsstaetten, anteile_pct)):
        if i == len(betriebsstaetten) - 1:
            anteil_messbetrag = rest_messbetrag  # letzten Anteil als Rest, damit die Summe exakt aufgeht
        else:
            anteil_messbetrag = _round_cent(messbetrag * pct / D(100))
            rest_messbetrag -= anteil_messbetrag
        gewst = _round_cent(anteil_messbetrag * b.hebesatz / D(100))
        ergebnisse.append(ZerlegungsAnteil(
            gemeinde=b.gemeinde, hebesatz=b.hebesatz, anteil_pct=pct,
            messbetrag_anteil=anteil_messbetrag, gewerbesteuer=gewst,
        ))
    return ergebnisse


def anrechnung_35a(messbetrag: D, gewerbesteuer_gezahlt_gesamt: D, tarifliche_est_gewerblicher_anteil: D, jahr: int) -> D:
    """§ 35 Abs. 1 EStG: das 4-fache des Messbetrags, gedeckelt auf die
    tatsächlich gezahlte Gewerbesteuer und auf die anteilige tarifliche ESt."""
    p = parameter(jahr)
    moeglich = p["gewst_anrechnung_faktor"] * messbetrag
    return _round_cent(min(moeglich, gewerbesteuer_gezahlt_gesamt, tarifliche_est_gewerblicher_anteil))


# ─────────────────────────────────────────────────────────────────────────────
# Rücklagen-Empfehlung
# ─────────────────────────────────────────────────────────────────────────────

def monatliche_ruecklage(nachzahlung_gesamt: D, heute: date, naechste_faelligkeit: date) -> D:
    """Wie viel ab heute monatlich zurückgelegt werden sollte, um die erwartete
    Nachzahlung bis zur nächsten Fälligkeit gedeckt zu haben."""
    if nachzahlung_gesamt <= 0:
        return D(0)
    monate = max(1, (naechste_faelligkeit.year - heute.year) * 12 + (naechste_faelligkeit.month - heute.month))
    return _round_cent(nachzahlung_gesamt / D(monate))


# ─────────────────────────────────────────────────────────────────────────────
# Orchestrierung — vollständige Prognose aus allen Bausteinen
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class PrognoseInput:
    jahr: int
    veranlagung: str = "zusammen"           # zusammen | einzeln
    kirchensteuerpflicht: str = "niemand"   # niemand | beide | ich | ehefrau
    zerlegungsmodus: str = "arbeitsloehne"  # arbeitsloehne | prozent

    gewinn_gewerbebetrieb: D = D(0)
    gewinn_gewerbebetrieb_ehefrau: D = D(0)
    sonstige_einkuenfte: D = D(0)
    bruttolohn_ehefrau: D = D(0)
    werbungskosten_ehefrau: D = D(0)
    vermietung_einnahmen: D = D(0)
    vermietung_werbungskosten: D = D(0)
    vermietung_afa: D = D(0)

    kv_pv_beitraege_gesamt: D = D(0)
    basisrente_beitrag: D = D(0)
    uebrige_vorsorge_ich: D = D(0)
    uebrige_vorsorge_ehefrau: D = D(0)
    spenden: D = D(0)
    kinderbetreuungskosten: D = D(0)
    handwerkerleistungen: D = D(0)

    gewst_hinzurechnung_zinsen_mieten: D = D(0)
    gewst_kuerzung_grundbesitz: D = D(0)

    est_vz_q1: D = D(0)
    est_vz_q2: D = D(0)
    est_vz_q3: D = D(0)
    est_vz_q4: D = D(0)
    lohnsteuer_ehefrau: D = D(0)
    soli_ehefrau: D = D(0)
    kirchensteuer_ehefrau: D = D(0)

    kinder: list[Kind] = field(default_factory=list)
    betriebsstaetten: list[Betriebsstaette] = field(default_factory=list)
    heute: date = field(default_factory=date.today)


def _ziel_datum_ruecklage(heute: date, jahr: int) -> date:
    """Näherungsweises Zieldatum für die Rücklagenbildung.

    Wichtig: Die eigentliche Nachzahlung aus dem Steuerbescheid ist NICHT mit
    den ESt-Vorauszahlungsterminen (10.03./10.06./10.09./10.12., bereits über
    die VZ-Felder abgedeckt) zu verwechseln — sie wird erst fällig, nachdem
    die Steuererklärung fürs Prognosejahr abgegeben und beschieden wurde, was
    üblicherweise erst im Folgejahr geschieht. Als vorsichtige Planungsannahme
    wird das Jahresende des Folgejahres angesetzt, damit die Empfehlung die
    Rücklage über einen realistischen Zeitraum verteilt statt sie auf wenige
    Wochen zusammenzudrängen. Der tatsächliche Termin steht erst mit dem
    Bescheid fest und kann früher liegen."""
    ziel = date(jahr + 1, 12, 31)
    return ziel if ziel > heute else date(jahr + 2, 12, 31)


def berechne_prognose(inp: PrognoseInput) -> dict:
    p = parameter(inp.jahr)
    splitting = inp.veranlagung == "zusammen"

    # ── Einkünfte ────────────────────────────────────────────────────────────
    werbungskosten_ehefrau = inp.werbungskosten_ehefrau
    if inp.bruttolohn_ehefrau > 0:
        werbungskosten_ehefrau = max(werbungskosten_ehefrau, p["arbeitnehmer_pauschbetrag"])
    einkuenfte_ehefrau = max(D(0), inp.bruttolohn_ehefrau - werbungskosten_ehefrau)
    einkuenfte_vermietung = inp.vermietung_einnahmen - inp.vermietung_werbungskosten - inp.vermietung_afa
    summe_einkuenfte = (
        inp.gewinn_gewerbebetrieb + inp.gewinn_gewerbebetrieb_ehefrau
        + inp.sonstige_einkuenfte + einkuenfte_ehefrau + einkuenfte_vermietung
    )

    # ── Sonderausgaben ───────────────────────────────────────────────────────
    basisrente_hoechst = p["basisrente_hoechstbetrag_single"] * (D(2) if splitting else D(1))
    basisrente_abzug = min(inp.basisrente_beitrag, basisrente_hoechst)

    uebrige_vorsorge_abzug = (
        min(inp.uebrige_vorsorge_ich, p["uebrige_vorsorge_hoechstbetrag_selbststaendig"]) +
        min(inp.uebrige_vorsorge_ehefrau, p["uebrige_vorsorge_hoechstbetrag_angestellt"])
    )

    spenden_abzug = min(inp.spenden, summe_einkuenfte * D("0.20")) if summe_einkuenfte > 0 else D(0)

    anzahl_kinder_berechtigt = sum(1 for k in inp.kinder if kind_anspruchsberechtigt(k, inp.jahr))
    kinderbetreuung_abzug = min(
        inp.kinderbetreuungskosten * D(2) / D(3),
        D(4000) * D(anzahl_kinder_berechtigt),
    )

    pauschbetrag = p["sonderausgaben_pauschbetrag_splitting"] if splitting else p["sonderausgaben_pauschbetrag_single"]
    sonstige_sonderausgaben = max(spenden_abzug + kinderbetreuung_abzug, pauschbetrag)

    sonderausgaben_gesamt = inp.kv_pv_beitraege_gesamt + basisrente_abzug + uebrige_vorsorge_abzug + sonstige_sonderausgaben
    zve_vor_kfb = max(D(0), summe_einkuenfte - sonderausgaben_gesamt)

    # ── Kinder / Günstigerprüfung ────────────────────────────────────────────
    kfb_res = guenstigerpruefung(zve_vor_kfb, inp.kinder, inp.jahr, splitting)
    est_tariflich = kfb_res.est_festzusetzen

    # Soli/KiSt-Bemessung erfolgt stets auf Basis der um den Kinderfreibetrag
    # geminderten ESt (§ 3 Abs. 2a SolzG, § 51a Abs. 2 EStG) — unabhängig davon,
    # ob die Kindergeld-Variante für die eigentliche ESt-Festsetzung günstiger war.
    est_bemessung_soli_kist = kfb_res.est_mit_kfb
    soli = solidaritaetszuschlag(est_bemessung_soli_kist, inp.jahr, splitting)

    if inp.kirchensteuerpflicht == "beide":
        kist_anteil = D(1)
    elif inp.kirchensteuerpflicht in ("ich", "ehefrau"):
        kist_anteil = D("0.5")  # Halbteilungsgrundsatz bei glaubensverschiedener Ehe
    else:
        kist_anteil = D(0)
    kirchensteuer = _round_cent(est_bemessung_soli_kist * p["kirchensteuer_satz"] * kist_anteil)

    # ── Gewerbesteuer ────────────────────────────────────────────────────────
    ertrag = gewerbeertrag(inp.gewinn_gewerbebetrieb, inp.gewst_hinzurechnung_zinsen_mieten,
                            inp.gewst_kuerzung_grundbesitz, inp.jahr)
    messbetrag = gewerbesteuermessbetrag(ertrag, inp.jahr)

    if inp.zerlegungsmodus == "prozent":
        zerlegung = zerlegung_prozent(inp.betriebsstaetten, messbetrag)
    else:
        zerlegung = zerlegung_arbeitsloehne(inp.betriebsstaetten, messbetrag, inp.jahr)
    gewerbesteuer_gesamt = sum((z.gewerbesteuer for z in zerlegung), D(0))

    tarifliche_est_gewerblich_anteil = (
        est_tariflich * inp.gewinn_gewerbebetrieb / summe_einkuenfte if summe_einkuenfte > 0 else D(0)
    )
    anrechnung = anrechnung_35a(messbetrag, gewerbesteuer_gesamt, tarifliche_est_gewerblich_anteil, inp.jahr)

    # § 35a EStG: Handwerkerleistungen, 20 % der Arbeitskosten, max. 1.200 €/Jahr
    handwerker_abzug = min(inp.handwerkerleistungen * D("0.20"), D(1200))

    est_nach_anrechnung = max(D(0), est_tariflich - anrechnung - handwerker_abzug)
    gesamtbelastung = est_nach_anrechnung + soli + kirchensteuer + gewerbesteuer_gesamt

    # ── Abgleich mit Vorauszahlungen ────────────────────────────────────────
    est_vz_gesamt = inp.est_vz_q1 + inp.est_vz_q2 + inp.est_vz_q3 + inp.est_vz_q4
    lohn_soli_kist_ehefrau = inp.lohnsteuer_ehefrau + inp.soli_ehefrau + inp.kirchensteuer_ehefrau
    # Vorauszahlungen hängen an der Betriebsstätte, nicht an festen Standort-Slots:
    # die Zahl der Gemeinden ergibt sich erst aus der Zerlegung (real: drei).
    gewst_vz_gesamt = sum((b.vorauszahlung for b in inp.betriebsstaetten), D(0))

    nachzahlung_est = (est_nach_anrechnung + soli + kirchensteuer) - est_vz_gesamt - lohn_soli_kist_ehefrau
    nachzahlung_gewst = gewerbesteuer_gesamt - gewst_vz_gesamt
    nachzahlung_gesamt = nachzahlung_est + nachzahlung_gewst

    ziel_datum = _ziel_datum_ruecklage(inp.heute, inp.jahr)
    ruecklage = monatliche_ruecklage(max(D(0), nachzahlung_gesamt), inp.heute, ziel_datum)

    return {
        "jahr": inp.jahr,
        "einkuenfte": {
            "gewerbebetrieb": float(inp.gewinn_gewerbebetrieb),
            "gewerbebetrieb_ehefrau": float(inp.gewinn_gewerbebetrieb_ehefrau),
            "sonstige": float(inp.sonstige_einkuenfte),
            "nichtselbststaendig_ehefrau": float(einkuenfte_ehefrau),
            "vermietung": float(einkuenfte_vermietung),
        },
        "summe_einkuenfte": float(summe_einkuenfte),
        "zve_vor_kinderfreibetrag": float(zve_vor_kfb),
        "kinder": {
            "anzahl_anspruchsberechtigt": anzahl_kinder_berechtigt,
            "kinderfreibetrag_gesamt": float(kfb_res.kinderfreibetrag_gesamt),
            "est_ohne_kfb": float(kfb_res.est_ohne_kfb),
            "est_mit_kfb": float(kfb_res.est_mit_kfb),
            "steuerersparnis_kfb": float(kfb_res.steuerersparnis_kfb),
            "kindergeld_gesamt": float(kfb_res.kindergeld_gesamt),
            "kinderfreibetrag_guenstiger": kfb_res.kinderfreibetrag_guenstiger,
            "hinzurechnung_kindergeld": float(kfb_res.hinzurechnung_kindergeld),
        },
        "est_tariflich": float(est_tariflich),
        "soli": float(soli),
        "kirchensteuer": float(kirchensteuer),
        "gewerbeertrag": float(ertrag),
        "gewerbesteuermessbetrag": float(messbetrag),
        "zerlegung": [
            {
                "gemeinde": z.gemeinde,
                "hebesatz": float(z.hebesatz),
                "anteil_pct": float(z.anteil_pct),
                "messbetrag_anteil": float(z.messbetrag_anteil),
                "gewerbesteuer": float(z.gewerbesteuer),
            }
            for z in zerlegung
        ],
        "gewerbesteuer_gesamt": float(gewerbesteuer_gesamt),
        "anrechnung_35a": float(anrechnung),
        "est_nach_anrechnung": float(est_nach_anrechnung),
        "gesamtbelastung": float(gesamtbelastung),
        "est_vorauszahlungen_gesamt": float(est_vz_gesamt),
        "lohn_soli_kist_ehefrau_gesamt": float(lohn_soli_kist_ehefrau),
        "gewst_vorauszahlungen_gesamt": float(gewst_vz_gesamt),
        "nachzahlung_est": float(nachzahlung_est),
        "nachzahlung_gewst": float(nachzahlung_gewst),
        "nachzahlung_gesamt": float(nachzahlung_gesamt),
        "monatliche_ruecklage_empfehlung": float(ruecklage),
    }
