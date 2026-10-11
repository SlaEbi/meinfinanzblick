"""Immobilienrechner (Kapitalanlage) — kanonische, getestete Berechnungslogik.

Wertet den Kauf einer vermieteten Immobilie mit Finanzierung aus, wie es
gängige Kalkulationstools tun:

1. Schnellfilter: Bruttomietrendite, Kaufpreisfaktor
2. Cashflow vor Steuern: Miete − Mietausfall − nicht umlagefähige Kosten −
   Instandhaltung − Zins − Tilgung
3. Cashflow nach Steuern: das steuerliche Ergebnis aus Vermietung und
   Verpachtung (Miete − Kosten − Zins − AfA) verändert die Einkommensteuer
   zum persönlichen Tarif; die Differenz ist Erstattung bzw. Nachzahlung.
4. Prognose über N Jahre mit Miet-, Kosten- und Wertsteigerung, Exit am Ende
   (Verkauf, ggf. Spekulationssteuer < 10 Jahre) und IRR auf das Eigenkapital.

Vereinfachungen (bewusst, für eine Planungsrechnung):
- Kauf zu Jahresbeginn, AfA ab Jahr 1 in voller Höhe (keine Monatsanteile).
- Instandhaltung wird steuerlich als Erhaltungsaufwand im selben Jahr
  angesetzt (die WEG-Rücklage ist streng genommen erst bei Verwendung
  absetzbar — über die Jahre gleicht sich das weitgehend aus).
- Steuertarif der Folgejahre = jüngster hinterlegter Tarif (keine
  Fortschreibung), Kirchensteuer als einfacher Aufschlag auf die ESt.
- Finanzierungsnebenkosten (Grundschuldbestellung) und Verkaufskosten
  werden nicht separat erfasst.

Geldwerte intern als float wie in tilgung.py (dessen Tilgungsplan hier
wiederverwendet wird), die Einkommensteuer läuft über services/steuer.py mit
Decimal; alle Ausgabewerte werden explizit auf Cent gerundet.

WICHTIG: Planungsrechnung, keine Steuer- oder Anlageberatung.
"""
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal as D
from typing import Optional

from .steuer import est_tarif, solidaritaetszuschlag
from .tilgung import tilgungsplan

# Grenze für anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG):
# Instandsetzungen in den ersten 3 Jahren über 15 % der Gebäude-
# Anschaffungskosten (netto, ohne USt) sind nicht sofort absetzbar, sondern
# erhöhen die AfA-Bemessungsgrundlage.
ANSCHAFFUNGSNAH_GRENZE = 0.15
UST_SATZ = 0.19

# Spekulationsfrist für private Veräußerungsgeschäfte (§ 23 Abs. 1 Nr. 1 EStG)
SPEKULATIONSFRIST_JAHRE = 10

# Degressive AfA (§ 7 Abs. 5a EStG): 5 % vom Restbuchwert. Der Wechsel zur
# linearen AfA (Restwert verteilt auf die Restnutzungsdauer von 33⅓ Jahren,
# entsprechend 3 %) ist einmalig erlaubt.
DEGRESSIV_SATZ = 0.05
NUTZUNGSDAUER_NEUBAU_JAHRE = 100 / 3

KAUFPREISFAKTOR_WARNUNG = 25


@dataclass
class ImmobilieEingaben:
    # Kauf
    kaufpreis: float
    grunderwerbsteuer_pct: float = 6.5
    notar_grundbuch_pct: float = 2.0
    makler_pct: float = 3.57
    grundstuecksanteil_pct: float = 25.0   # nicht abschreibbarer Bodenanteil
    renovierung: float = 0.0               # sofortige Instandsetzung (brutto), aus Eigenkapital
    wohnflaeche: float = 0.0
    # Finanzierung
    eigenkapital: float = 0.0
    zinssatz_pct: float = 3.5
    tilgung_pct: float = 2.0               # anfängliche Tilgung p. a.
    zinsbindung_jahre: int = 10
    anschlusszins_pct: float = 4.0         # nach Zinsbindung; Rate bleibt gleich
    sondertilgung_jahr: float = 0.0
    # Vermietung
    kaltmiete_monat: float = 0.0
    mietsteigerung_pct: float = 1.5
    mietausfall_pct: float = 2.0
    # Laufende Kosten (nicht umlagefähig, monatlich)
    verwaltung_monat: float = 0.0          # WEG- und Mietverwaltung, sonstige nicht umlagefähige Kosten
    instandhaltung_monat: float = 0.0      # Rücklage WEG + eigene Instandhaltung
    kostensteigerung_pct: float = 2.0
    # Steuer
    afa_modus: str = 'linear'              # linear | degressiv
    afa_satz_pct: float = 2.0              # nur linear
    zve: float = 0.0                       # zu versteuerndes Einkommen ohne die Immobilie
    splitting: bool = False
    kirchensteuer_pct: float = 0.0         # 0, 8 oder 9
    # Prognose
    wertsteigerung_pct: float = 1.5
    betrachtung_jahre: int = 10           # Haltedauer, danach Verkauf
    steuerjahr: Optional[int] = None       # Default: aktuelles Jahr


@dataclass
class ImmobilieJahr:
    jahr: int
    miete: float              # Kaltmiete nach Mietausfall
    kosten: float             # Verwaltung + Instandhaltung
    zins: float
    tilgung: float            # inkl. Sondertilgung
    restschuld: float
    afa: float
    erhaltungsaufwand: float  # sofort absetzbare Renovierung (nur Jahr 1)
    steuerliches_ergebnis: float
    steuereffekt: float       # + = Erstattung, − = Mehrsteuer
    cashflow_vor_steuern: float
    cashflow_nach_steuern: float
    marktwert: float
    nettovermoegen: float     # Marktwert − Restschuld


@dataclass
class Warnung:
    code: str
    stufe: str                # 'urgent' | 'warn' | 'info'
    text: str


@dataclass
class ImmobilieErgebnis:
    # Investition
    kaufnebenkosten: float
    gesamtinvestition: float
    darlehen: float
    rate_monatlich: float
    afa_basis: float
    grenzsteuersatz: float
    # Kennzahlen Jahr 1
    bruttomietrendite: float
    nettomietrendite: float
    kaufpreisfaktor: Optional[float]
    preis_pro_qm: Optional[float]
    cashflow_vor_steuern_monat: float
    cashflow_nach_steuern_monat: float
    eigenkapitalrendite: Optional[float]
    # Prognose / Exit
    jahre: list[ImmobilieJahr]
    restschuld_zinsbindung: float
    verkaufspreis: float
    spekulationssteuer: float
    verkaufserloes_netto: float      # Verkaufspreis − Restschuld − Spekulationssteuer
    vermoegenszuwachs: float         # Erlös + Σ Cashflows n. St. − Eigenkapital
    irr: Optional[float]
    warnungen: list[Warnung] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Bausteine
# ─────────────────────────────────────────────────────────────────────────────

def _r(x: float) -> float:
    return round(x, 2)


def einkommensteuer_gesamt(zve: float, jahr: int, splitting: bool, kirchensteuer_pct: float = 0.0) -> float:
    """ESt + Soli + Kirchensteuer auf ein zu versteuerndes Einkommen."""
    zve_d = D(str(max(zve, 0.0)))
    est = est_tarif(zve_d, jahr, splitting)
    soli = solidaritaetszuschlag(est, jahr, splitting)
    kist = est * D(str(kirchensteuer_pct)) / D(100)
    return float(est + soli + kist)


def steuereffekt(zve: float, ergebnis_vv: float, jahr: int, splitting: bool, kirchensteuer_pct: float = 0.0) -> float:
    """Steueränderung durch Einkünfte aus V+V. Positiv = Erstattung (Verlust
    senkt die Steuer), negativ = Mehrsteuer."""
    ohne = einkommensteuer_gesamt(zve, jahr, splitting, kirchensteuer_pct)
    mit = einkommensteuer_gesamt(zve + ergebnis_vv, jahr, splitting, kirchensteuer_pct)
    return ohne - mit


def grenzsteuersatz(zve: float, jahr: int, splitting: bool, kirchensteuer_pct: float = 0.0) -> float:
    """Steuer auf die nächsten 1.000 € — als Dezimalwert (0.42 = 42 %)."""
    schritt = 1000.0
    return (einkommensteuer_gesamt(zve + schritt, jahr, splitting, kirchensteuer_pct)
            - einkommensteuer_gesamt(zve, jahr, splitting, kirchensteuer_pct)) / schritt


def afa_verlauf(basis: float, jahre: int, modus: str, satz_linear: float) -> list[float]:
    """AfA je Jahr. Linear: fester Satz auf die Basis bis zur Vollabschreibung.
    Degressiv: 5 % vom Restbuchwert mit automatischem Wechsel zur linearen
    AfA, sobald die (Restwert / Restnutzungsdauer) höher ist."""
    verlauf: list[float] = []
    rest = basis
    linear_ab_wechsel: Optional[float] = None
    for j in range(jahre):
        if rest <= 0.005:
            verlauf.append(0.0)
            continue
        if modus == 'degressiv':
            if linear_ab_wechsel is None:
                deg = rest * DEGRESSIV_SATZ
                restnutzung = NUTZUNGSDAUER_NEUBAU_JAHRE - j
                lin = rest / restnutzung if restnutzung > 1 else rest
                if lin > deg:
                    linear_ab_wechsel = lin
                    afa = lin
                else:
                    afa = deg
            else:
                afa = linear_ab_wechsel
        else:
            afa = basis * satz_linear
        afa = min(afa, rest)
        rest -= afa
        verlauf.append(afa)
    return verlauf


def irr(zahlungen: list[float]) -> Optional[float]:
    """Interner Zinsfuß (jährlich) per Bisektion. zahlungen[0] = Anfangs-
    investition (negativ). None, wenn kein Vorzeichenwechsel vorliegt."""
    if not zahlungen or not any(z < 0 for z in zahlungen) or not any(z > 0 for z in zahlungen):
        return None

    def npv(rate: float) -> float:
        return sum(z / (1 + rate) ** t for t, z in enumerate(zahlungen))

    lo, hi = -0.99, 10.0
    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo * f_hi > 0:
        return None
    for _ in range(200):
        mid = (lo + hi) / 2
        f_mid = npv(mid)
        if abs(f_mid) < 1e-7:
            return mid
        if f_lo * f_mid < 0:
            hi, f_hi = mid, f_mid
        else:
            lo, f_lo = mid, f_mid
    return (lo + hi) / 2


def _finanzierungsplan(darlehen: float, e: ImmobilieEingaben, rate_monatlich: float, jahre: int):
    """Zins/Tilgung/Restschuld je Jahr über den Betrachtungszeitraum —
    Zinsbindung und Anschlussfinanzierung (gleiche Rate, neuer Zins) als zwei
    aneinandergehängte Tilgungspläne aus tilgung.py."""
    zeilen: list[tuple[float, float, float]] = []   # (zins, tilgung inkl. Sonder, restschuld_ende)
    if darlehen <= 0:
        return [(0.0, 0.0, 0.0)] * jahre, 0.0

    # Die Zinsbindung wird immer vollständig gerechnet (auch wenn sie über den
    # Betrachtungszeitraum hinausreicht), damit die Restschuld an ihrem Ende
    # als Kennzahl stimmt; in die Jahresprognose gehen nur die ersten Jahre.
    bindung = max(0, int(e.zinsbindung_jahre))
    rest = darlehen
    if bindung > 0:
        plan1 = tilgungsplan(rest, e.zinssatz_pct / 100, rate_monatlich,
                             sondertilgung_jahr=e.sondertilgung_jahr, max_jahre=bindung)
        for z in plan1.jahre:
            zeilen.append((z.zins, z.tilgung + z.sondertilgung, z.restschuld_ende))
        rest = plan1.jahre[-1].restschuld_ende if plan1.jahre else rest
        # Darlehen innerhalb der Zinsbindung getilgt → Restjahre schuldenfrei
        while len(zeilen) < bindung:
            zeilen.append((0.0, 0.0, 0.0))
    restschuld_zinsbindung = rest

    if len(zeilen) < jahre and rest > 0.005:
        plan2 = tilgungsplan(rest, e.anschlusszins_pct / 100, rate_monatlich,
                             sondertilgung_jahr=e.sondertilgung_jahr, max_jahre=jahre - len(zeilen))
        for z in plan2.jahre:
            zeilen.append((z.zins, z.tilgung + z.sondertilgung, z.restschuld_ende))
    while len(zeilen) < jahre:
        letzte_rest = zeilen[-1][2] if zeilen else rest
        zeilen.append((0.0, 0.0, letzte_rest))
    return zeilen[:jahre], restschuld_zinsbindung


# ─────────────────────────────────────────────────────────────────────────────
# Hauptrechnung
# ─────────────────────────────────────────────────────────────────────────────

def berechne(e: ImmobilieEingaben) -> ImmobilieErgebnis:
    jahre_n = max(1, min(int(e.betrachtung_jahre), 40))
    steuerjahr = e.steuerjahr or date.today().year

    # ── Investition ──────────────────────────────────────────────────────────
    nk_pct = e.grunderwerbsteuer_pct + e.notar_grundbuch_pct + e.makler_pct
    kaufnebenkosten = e.kaufpreis * nk_pct / 100
    anschaffungskosten = e.kaufpreis + kaufnebenkosten
    gesamtinvestition = anschaffungskosten + e.renovierung
    darlehen = max(gesamtinvestition - e.eigenkapital, 0.0)
    eigenkapital = min(e.eigenkapital, gesamtinvestition)
    rate_monatlich = darlehen * (e.zinssatz_pct + e.tilgung_pct) / 100 / 12

    # AfA-Basis: Gebäudeanteil der Anschaffungskosten (inkl. Nebenkosten).
    # Renovierung über der 15-%-Grenze wird zu anschaffungsnahen
    # Herstellungskosten und erhöht die Basis, sonst sofort absetzbar.
    gebaeude_ak = anschaffungskosten * (1 - e.grundstuecksanteil_pct / 100)
    renovierung_netto = e.renovierung / (1 + UST_SATZ)
    ueber_15_prozent = e.renovierung > 0 and renovierung_netto > ANSCHAFFUNGSNAH_GRENZE * gebaeude_ak
    afa_basis = gebaeude_ak + (e.renovierung if ueber_15_prozent else 0.0)
    erhaltung_sofort = 0.0 if ueber_15_prozent else e.renovierung

    afa_liste = afa_verlauf(afa_basis, jahre_n, e.afa_modus, e.afa_satz_pct / 100)
    finanzierung, restschuld_zinsbindung = _finanzierungsplan(darlehen, e, rate_monatlich, jahre_n)

    # ── Jahresprognose ───────────────────────────────────────────────────────
    jahre: list[ImmobilieJahr] = []
    for j in range(jahre_n):
        miete_soll = e.kaltmiete_monat * 12 * (1 + e.mietsteigerung_pct / 100) ** j
        miete = miete_soll * (1 - e.mietausfall_pct / 100)
        kosten = (e.verwaltung_monat + e.instandhaltung_monat) * 12 * (1 + e.kostensteigerung_pct / 100) ** j
        zins, tilgung, restschuld = finanzierung[j]
        afa = afa_liste[j]
        erhaltung = erhaltung_sofort if j == 0 else 0.0
        ergebnis = miete - kosten - zins - afa - erhaltung
        effekt = steuereffekt(e.zve, ergebnis, steuerjahr, e.splitting, e.kirchensteuer_pct)
        cf_vor = miete - kosten - zins - tilgung
        marktwert = e.kaufpreis * (1 + e.wertsteigerung_pct / 100) ** (j + 1)
        jahre.append(ImmobilieJahr(
            jahr=j + 1,
            miete=_r(miete), kosten=_r(kosten), zins=_r(zins), tilgung=_r(tilgung),
            restschuld=_r(restschuld), afa=_r(afa), erhaltungsaufwand=_r(erhaltung),
            steuerliches_ergebnis=_r(ergebnis), steuereffekt=_r(effekt),
            cashflow_vor_steuern=_r(cf_vor), cashflow_nach_steuern=_r(cf_vor + effekt),
            marktwert=_r(marktwert), nettovermoegen=_r(marktwert - restschuld),
        ))

    # ── Exit ─────────────────────────────────────────────────────────────────
    letztes = jahre[-1]
    verkaufspreis = letztes.marktwert
    spekulationssteuer = 0.0
    # Haltedauer = volle Jahre ab Kauf zu Jahresbeginn; bei genau 10 Jahren
    # wird der Verkauf direkt nach Ablauf der Frist angenommen (steuerfrei) —
    # real muss der notarielle Verkauf mehr als 10 Jahre nach dem Kauf liegen.
    if jahre_n < SPEKULATIONSFRIST_JAHRE:
        # Veräußerungsgewinn = Verkaufspreis − (Anschaffungskosten inkl.
        # aktivierter Renovierung − bisherige AfA), versteuert zum Tarif
        # zusätzlich zum laufenden V+V-Ergebnis des letzten Jahres.
        buchwert = anschaffungskosten + (e.renovierung if ueber_15_prozent else 0.0) - sum(afa_liste)
        gewinn = verkaufspreis - buchwert
        if gewinn > 0:
            basis = e.zve + letztes.steuerliches_ergebnis
            spekulationssteuer = -steuereffekt(basis, gewinn, steuerjahr, e.splitting, e.kirchensteuer_pct)
    verkaufserloes_netto = verkaufspreis - letztes.restschuld - spekulationssteuer

    summe_cf = sum(j.cashflow_nach_steuern for j in jahre)
    vermoegenszuwachs = verkaufserloes_netto + summe_cf - eigenkapital

    zahlungen = [-eigenkapital] + [j.cashflow_nach_steuern for j in jahre]
    zahlungen[-1] += verkaufserloes_netto
    irr_wert = irr(zahlungen) if eigenkapital > 0 else None

    # ── Kennzahlen Jahr 1 ────────────────────────────────────────────────────
    jahreskaltmiete = e.kaltmiete_monat * 12
    j1 = jahre[0]
    reinertrag = jahreskaltmiete * (1 - e.mietausfall_pct / 100) - (e.verwaltung_monat + e.instandhaltung_monat) * 12
    bruttomietrendite = jahreskaltmiete / e.kaufpreis if e.kaufpreis > 0 else 0.0
    nettomietrendite = reinertrag / gesamtinvestition if gesamtinvestition > 0 else 0.0
    kaufpreisfaktor = e.kaufpreis / jahreskaltmiete if jahreskaltmiete > 0 else None
    # EK-Rendite Jahr 1: Cashflow nach Steuern + Tilgung (Vermögensaufbau),
    # ohne Wertsteigerung — so rechnen die gängigen Kalkulationstools.
    ek_rendite = (j1.cashflow_nach_steuern + j1.tilgung) / eigenkapital if eigenkapital > 0 else None
    gst = grenzsteuersatz(e.zve, steuerjahr, e.splitting, e.kirchensteuer_pct)

    ergebnis = ImmobilieErgebnis(
        kaufnebenkosten=_r(kaufnebenkosten),
        gesamtinvestition=_r(gesamtinvestition),
        darlehen=_r(darlehen),
        rate_monatlich=_r(rate_monatlich),
        afa_basis=_r(afa_basis),
        grenzsteuersatz=round(gst, 4),
        bruttomietrendite=round(bruttomietrendite, 6),
        nettomietrendite=round(nettomietrendite, 6),
        kaufpreisfaktor=round(kaufpreisfaktor, 2) if kaufpreisfaktor is not None else None,
        preis_pro_qm=_r(e.kaufpreis / e.wohnflaeche) if e.wohnflaeche > 0 else None,
        cashflow_vor_steuern_monat=_r(j1.cashflow_vor_steuern / 12),
        cashflow_nach_steuern_monat=_r(j1.cashflow_nach_steuern / 12),
        eigenkapitalrendite=round(ek_rendite, 6) if ek_rendite is not None else None,
        jahre=jahre,
        restschuld_zinsbindung=_r(restschuld_zinsbindung),
        verkaufspreis=_r(verkaufspreis),
        spekulationssteuer=_r(spekulationssteuer),
        verkaufserloes_netto=_r(verkaufserloes_netto),
        vermoegenszuwachs=_r(vermoegenszuwachs),
        irr=round(irr_wert, 6) if irr_wert is not None else None,
    )
    ergebnis.warnungen = _warnungen(e, ergebnis, darlehen, ueber_15_prozent, gebaeude_ak)
    return ergebnis


def _eur(x: float) -> str:
    return f"{x:,.0f} €".replace(',', '.')


def _warnungen(e: ImmobilieEingaben, r: ImmobilieErgebnis, darlehen: float,
               ueber_15_prozent: bool, gebaeude_ak: float) -> list[Warnung]:
    w: list[Warnung] = []

    if darlehen > 0 and r.rate_monatlich <= darlehen * e.zinssatz_pct / 100 / 12:
        w.append(Warnung('rate_zu_niedrig', 'urgent',
                         'Die Rate deckt nicht einmal die Zinsen — Tilgung erhöhen.'))

    if r.cashflow_nach_steuern_monat < 0:
        w.append(Warnung('cashflow_negativ', 'urgent',
                         f'Negativer Cashflow: Du zahlst im ersten Jahr rund {_eur(-r.cashflow_nach_steuern_monat)} '
                         'pro Monat zu (nach Steuern).'))
    elif r.cashflow_vor_steuern_monat < 0:
        w.append(Warnung('cashflow_vor_steuern_negativ', 'warn',
                         f'Vor Steuern zahlst du {_eur(-r.cashflow_vor_steuern_monat)} pro Monat zu — '
                         'erst die Steuererstattung macht den Cashflow positiv.'))

    if r.kaufpreisfaktor is not None and r.kaufpreisfaktor > KAUFPREISFAKTOR_WARNUNG:
        w.append(Warnung('kaufpreisfaktor_hoch', 'warn',
                         f'Kaufpreisfaktor {r.kaufpreisfaktor:.1f}'.replace('.', ',')
                         + f' liegt über {KAUFPREISFAKTOR_WARNUNG} — der Preis ist im Verhältnis zur Miete hoch.'))

    if darlehen > 0 and e.zinssatz_pct / 100 > r.nettomietrendite:
        w.append(Warnung('leverage_negativ', 'warn',
                         'Der Darlehenszins liegt über der Nettomietrendite — das Fremdkapital drückt '
                         'die laufende Rendite (negativer Leverage), getragen wird sie nur von Tilgung, '
                         'Steuereffekt und Wertsteigerung.'))

    if (darlehen > 0 and r.restschuld_zinsbindung > 0.005
            and e.zinsbindung_jahre < e.betrachtung_jahre):
        zins_anschluss = r.restschuld_zinsbindung * e.anschlusszins_pct / 100 / 12
        if r.rate_monatlich <= zins_anschluss:
            w.append(Warnung('anschluss_rate_zu_niedrig', 'urgent',
                             f'Nach {e.zinsbindung_jahre} Jahren deckt die Rate beim Anschlusszins die '
                             'Zinsen nicht mehr — die Rate müsste steigen.'))
        else:
            w.append(Warnung('zinsbindung_restschuld', 'info',
                             f'Restschuld nach {e.zinsbindung_jahre} Jahren Zinsbindung: '
                             f'{_eur(r.restschuld_zinsbindung)} — Anschlussfinanzierung nötig.'))

    if ueber_15_prozent:
        w.append(Warnung('anschaffungsnah', 'warn',
                         f'Die Renovierung liegt netto über 15 % der Gebäudekosten ({_eur(gebaeude_ak * ANSCHAFFUNGSNAH_GRENZE)}). '
                         'Sie ist nicht sofort absetzbar, sondern wird als anschaffungsnahe Herstellungskosten '
                         'über die AfA verteilt.'))

    if e.betrachtung_jahre < SPEKULATIONSFRIST_JAHRE:
        w.append(Warnung('spekulationsfrist', 'warn',
                         f'Verkauf vor Ablauf von {SPEKULATIONSFRIST_JAHRE} Jahren: Der Veräußerungsgewinn ist '
                         f'steuerpflichtig ({_eur(r.spekulationssteuer)} eingerechnet).'))
    return w
