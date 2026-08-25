from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional


# ── Konto ──────────────────────────────────────────────────────────────────────

class KontoBase(BaseModel):
    name: str
    bank: Optional[str] = None
    typ: str
    iban: Optional[str] = None
    bic: Optional[str] = None
    saldo: float
    waehrung: str = 'EUR'
    kontoinhaber: Optional[str] = None
    notiz: Optional[str] = None
    bitwarden_name: Optional[str] = None


class KontoCreate(KontoBase):
    pass


class KontoUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    typ: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    saldo: Optional[float] = None
    waehrung: Optional[str] = None
    kontoinhaber: Optional[str] = None
    notiz: Optional[str] = None
    bitwarden_name: Optional[str] = None


class KontoResponse(KontoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    aktualisiert_am: datetime


# ── Depot ──────────────────────────────────────────────────────────────────────

class DepotPositionBase(BaseModel):
    isin: Optional[str] = None
    name: str
    anzahl: Optional[float] = None
    kurs: Optional[float] = None
    wert: Optional[float] = None


class DepotPositionCreate(DepotPositionBase):
    pass


class DepotPositionResponse(DepotPositionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    depot_id: int


class DepotBase(BaseModel):
    name: str
    broker: Optional[str] = None
    depotinhaber: Optional[str] = None
    wertpapierdepot_nr: Optional[str] = None
    depot_bic: Optional[str] = None
    verrechnungskonto: Optional[str] = None
    verrechnungskonto_bic: Optional[str] = None
    auszahlungskonto: Optional[str] = None
    auszahlungskonto_name: Optional[str] = None
    auszahlungskonto_bank: Optional[str] = None
    auszahlungskonto_bic: Optional[str] = None
    wert_aktuell: float
    bitwarden_name: Optional[str] = None
    notiz: Optional[str] = None


class DepotCreate(DepotBase):
    pass


class DepotUpdate(BaseModel):
    name: Optional[str] = None
    broker: Optional[str] = None
    depotinhaber: Optional[str] = None
    wertpapierdepot_nr: Optional[str] = None
    depot_bic: Optional[str] = None
    verrechnungskonto: Optional[str] = None
    verrechnungskonto_bic: Optional[str] = None
    auszahlungskonto: Optional[str] = None
    auszahlungskonto_name: Optional[str] = None
    auszahlungskonto_bank: Optional[str] = None
    auszahlungskonto_bic: Optional[str] = None
    wert_aktuell: Optional[float] = None
    bitwarden_name: Optional[str] = None
    notiz: Optional[str] = None


class DepotResponse(DepotBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    aktualisiert_am: datetime
    positionen: list[DepotPositionResponse] = []


# ── Darlehen ───────────────────────────────────────────────────────────────────

class DarlehenBase(BaseModel):
    bezeichnung: str
    glaeubiger: str
    urspr_betrag: float
    restschuld: float
    zinssatz: float
    anteil_pct: float = 100.0
    darlehen_typ: str = 'annuitaet'
    rate_monatlich: float
    tilgungsrate_monatlich: Optional[float] = None
    zinsbindung_bis: Optional[date] = None
    restlaufzeit: Optional[int] = None
    sondertilgung_moeglich: bool = False
    sondertilgung_betrag: Optional[float] = None
    hat_ust_auf_zinsen: bool = False
    notiz: Optional[str] = None


class DarlehenCreate(DarlehenBase):
    pass


class DarlehenUpdate(BaseModel):
    bezeichnung: Optional[str] = None
    glaeubiger: Optional[str] = None
    urspr_betrag: Optional[float] = None
    restschuld: Optional[float] = None
    zinssatz: Optional[float] = None
    anteil_pct: Optional[float] = None
    darlehen_typ: Optional[str] = None
    rate_monatlich: Optional[float] = None
    tilgungsrate_monatlich: Optional[float] = None
    zinsbindung_bis: Optional[date] = None
    restlaufzeit: Optional[int] = None
    sondertilgung_moeglich: Optional[bool] = None
    sondertilgung_betrag: Optional[float] = None
    hat_ust_auf_zinsen: Optional[bool] = None
    notiz: Optional[str] = None


class DarlehenResponse(DarlehenBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class JahresZeileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    jahr: int
    zins: float
    tilgung: float
    sondertilgung: float
    restschuld_ende: float


class TilgungsplanResponse(BaseModel):
    jahre: list[JahresZeileResponse]
    monate_gesamt: Optional[int] = None
    zinsen_gesamt: float
    # Baseline ohne Sondertilgung, zum Vergleich immer mitgeliefert
    monate_ohne_sondertilgung: Optional[int] = None
    zinsen_ohne_sondertilgung: float


# ── Zinseszins-Simulator ─────────────────────────────────────────────────────

class ZinseszinsJahrResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    jahr: int
    einzahlungen_kumuliert: float
    zinsertrag_kumuliert: float
    gesamtkapital: float
    gesamtkapital_real: float


class ZinseszinsResponse(BaseModel):
    jahre: list[ZinseszinsJahrResponse]
    gesamtkapital_end: float
    einzahlungen_gesamt: float
    zinsertrag_gesamt: float


# ── Kapitalentnahme ──────────────────────────────────────────────────────────

class KapitalentnahmeJahrResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    jahr: int
    zinsertrag: float
    entnahme: float
    kapital_ende: float


class KapitalentnahmeResponse(BaseModel):
    jahre: list[KapitalentnahmeJahrResponse]
    monatliche_entnahme: float       # eingegeben oder aus der Laufzeit errechnet
    monate_gesamt: Optional[int] = None
    zinsertrag_gesamt: float
    entnahme_gesamt: float
    max_entnahme_kapitalerhalt: float


# ── Spending Plan ──────────────────────────────────────────────────────────────

class SpendingPositionBase(BaseModel):
    kategorie: str
    bezeichnung: str
    betrag: float
    empfaenger: str = 'ich'
    sort_order: int = 0


class SpendingPositionCreate(SpendingPositionBase):
    pass


class SpendingPositionUpdate(BaseModel):
    bezeichnung: Optional[str] = None
    betrag: Optional[float] = None
    empfaenger: Optional[str] = None
    sort_order: Optional[int] = None


class SpendingPositionResponse(SpendingPositionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    plan_id: int


class SpendingPlanBase(BaseModel):
    name: str = 'Conscious Spending Plan'
    stand: Optional[date] = None
    brutto_monatlich: float
    netto_monatlich: float
    sonstiges_puffer_pct: float = 0.05


class SpendingPlanCreate(SpendingPlanBase):
    pass


class SpendingPlanUpdate(BaseModel):
    name: Optional[str] = None
    stand: Optional[date] = None
    brutto_monatlich: Optional[float] = None
    netto_monatlich: Optional[float] = None
    sonstiges_puffer_pct: Optional[float] = None
    ist_aktiv: Optional[bool] = None


class SpendingPlanResponse(SpendingPlanBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    ist_aktiv: bool
    erstellt_am: datetime
    positionen: list[SpendingPositionResponse] = []


# ── Sachwerte ──────────────────────────────────────────────────────────────────

class SachvermoegenBase(BaseModel):
    bezeichnung: str
    kategorie: str
    beschreibung: Optional[str] = None
    aktueller_wert: float
    anteil_pct: float = 100.0
    anschaffungswert: Optional[float] = None
    anschaffungsjahr: Optional[int] = None
    naechster_tuev: Optional[date] = None


class SachvermoegenCreate(SachvermoegenBase):
    pass


class SachvermoegenUpdate(BaseModel):
    bezeichnung: Optional[str] = None
    kategorie: Optional[str] = None
    beschreibung: Optional[str] = None
    aktueller_wert: Optional[float] = None
    anteil_pct: Optional[float] = None
    anschaffungswert: Optional[float] = None
    anschaffungsjahr: Optional[int] = None
    naechster_tuev: Optional[date] = None


class SachvermoegenResponse(SachvermoegenBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    aktualisiert_am: datetime


# ── Versicherung ───────────────────────────────────────────────────────────────

class VersicherungBase(BaseModel):
    art: str
    bezeichnung: str
    anbieter: str
    vertragsnummer: Optional[str] = None
    beitrag: float
    zahlweise: str = 'monatlich'
    laufzeit_bis: Optional[date] = None
    kuendigungsfrist_tage: int = 0
    frist_erinnerung: bool = False
    kontakt_telefon: Optional[str] = None
    kontakt_email: Optional[str] = None
    notiz: Optional[str] = None


class VersicherungCreate(VersicherungBase):
    pass


class VersicherungUpdate(BaseModel):
    art: Optional[str] = None
    bezeichnung: Optional[str] = None
    anbieter: Optional[str] = None
    vertragsnummer: Optional[str] = None
    beitrag: Optional[float] = None
    zahlweise: Optional[str] = None
    laufzeit_bis: Optional[date] = None
    kuendigungsfrist_tage: Optional[int] = None
    frist_erinnerung: Optional[bool] = None
    kontakt_telefon: Optional[str] = None
    kontakt_email: Optional[str] = None
    notiz: Optional[str] = None


class VersicherungResponse(VersicherungBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    erstellt_am: datetime


# ── Vertrag ────────────────────────────────────────────────────────────────────

class VertragBase(BaseModel):
    art: str
    bezeichnung: str
    anbieter: str
    vertragsnummer: Optional[str] = None
    kosten: float
    zahlweise: str = 'monatlich'
    laufzeit_bis: Optional[date] = None
    kuendigungsfrist_tage: int = 0
    frist_erinnerung: bool = False
    notiz: Optional[str] = None


class VertragCreate(VertragBase):
    pass


class VertragUpdate(BaseModel):
    art: Optional[str] = None
    bezeichnung: Optional[str] = None
    anbieter: Optional[str] = None
    vertragsnummer: Optional[str] = None
    kosten: Optional[float] = None
    zahlweise: Optional[str] = None
    laufzeit_bis: Optional[date] = None
    kuendigungsfrist_tage: Optional[int] = None
    frist_erinnerung: Optional[bool] = None
    notiz: Optional[str] = None


class VertragResponse(VertragBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    erstellt_am: datetime


# ── Kontakt ────────────────────────────────────────────────────────────────────

class KontaktBase(BaseModel):
    name: str
    rolle: str
    firma: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    notiz: Optional[str] = None


class KontaktCreate(KontaktBase):
    pass


class KontaktUpdate(BaseModel):
    name: Optional[str] = None
    rolle: Optional[str] = None
    firma: Optional[str] = None
    telefon: Optional[str] = None
    email: Optional[str] = None
    adresse: Optional[str] = None
    notiz: Optional[str] = None


class KontaktResponse(KontaktBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    erstellt_am: datetime


# ── NotfallEintrag ─────────────────────────────────────────────────────────────

class NotfallEintragBase(BaseModel):
    titel: str
    kategorie: str
    verweis: Optional[str] = None
    hinweis: Optional[str] = None
    gueltig_bis: Optional[date] = None
    prioritaet: int = 2
    erledigt: bool = False
    sort_order: int = 0


class NotfallEintragCreate(NotfallEintragBase):
    pass


class NotfallEintragUpdate(BaseModel):
    titel: Optional[str] = None
    kategorie: Optional[str] = None
    verweis: Optional[str] = None
    hinweis: Optional[str] = None
    gueltig_bis: Optional[date] = None
    prioritaet: Optional[int] = None
    erledigt: Optional[bool] = None
    sort_order: Optional[int] = None


class NotfallEintragResponse(NotfallEintragBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    erstellt_am: datetime


# ── Todo ───────────────────────────────────────────────────────────────────────

class TodoBase(BaseModel):
    titel: str
    notiz: Optional[str] = None
    faelligkeit: Optional[date] = None
    prioritaet: str = 'mittel'
    zustaendigkeit: str = 'ich'
    erledigt: bool = False
    sort_order: int = 0


class TodoCreate(TodoBase):
    pass


class TodoUpdate(BaseModel):
    titel: Optional[str] = None
    notiz: Optional[str] = None
    faelligkeit: Optional[date] = None
    prioritaet: Optional[str] = None
    zustaendigkeit: Optional[str] = None
    erledigt: Optional[bool] = None
    sort_order: Optional[int] = None


class TodoResponse(TodoBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    erstellt_am: datetime



# ── Anhang ─────────────────────────────────────────────────────────────────────

class AnhangResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    entity_typ: str
    entity_id: int
    dateiname: str
    original_name: str
    mime_type: Optional[str] = None
    hochgeladen_am: datetime


# ── Net Worth ──────────────────────────────────────────────────────────────────

class NetWorthSummary(BaseModel):
    summe_konten: float
    summe_depots: float
    summe_sachvermoegen: float
    summe_schulden: float
    vermoegen_brutto: float
    netto: float


class NetWorthSnapshotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    datum: date
    summe_vermoegen: float
    summe_schulden: float
    netto: float


class NetWorthData(BaseModel):
    aktuell: NetWorthSummary
    verlauf: list[NetWorthSnapshotResponse]


# ── Steuerprognose ───────────────────────────────────────────────────────────

class SteuerKindBase(BaseModel):
    name: Optional[str] = None
    geburtsdatum: date
    in_ausbildung_18_25: bool = False


class SteuerKindCreate(SteuerKindBase):
    pass


class SteuerKindResponse(SteuerKindBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SteuerBetriebsstaetteBase(BaseModel):
    gemeinde: str
    hebesatz: float
    arbeitsloehne: float = 0
    taetigkeitsanteil_pct: float = 0
    prozent_manuell: Optional[float] = None
    vorauszahlung: float = 0


class SteuerBetriebsstaetteCreate(SteuerBetriebsstaetteBase):
    pass


class SteuerBetriebsstaetteResponse(SteuerBetriebsstaetteBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SteuerPrognoseBase(BaseModel):
    jahr: int
    veranlagung: str = 'zusammen'
    kirchensteuerpflicht: str = 'niemand'
    zerlegungsmodus: str = 'arbeitsloehne'

    gewinn_gewerbebetrieb: float = 0
    gewinn_gewerbebetrieb_ehefrau: float = 0
    sonstige_einkuenfte: float = 0
    bruttolohn_ehefrau: float = 0
    werbungskosten_ehefrau: float = 0
    vermietung_einnahmen: float = 0
    vermietung_werbungskosten: float = 0
    vermietung_afa: float = 0

    kv_pv_beitraege_gesamt: float = 0
    basisrente_beitrag: float = 0
    uebrige_vorsorge_ich: float = 0
    uebrige_vorsorge_ehefrau: float = 0
    spenden: float = 0
    kinderbetreuungskosten: float = 0
    handwerkerleistungen: float = 0

    gewst_hinzurechnung_zinsen_mieten: float = 0
    gewst_kuerzung_grundbesitz: float = 0

    est_vz_q1: float = 0
    est_vz_q2: float = 0
    est_vz_q3: float = 0
    est_vz_q4: float = 0

    lohnsteuer_ehefrau: float = 0
    soli_ehefrau: float = 0
    kirchensteuer_ehefrau: float = 0

    notiz: Optional[str] = None


class SteuerPrognoseCreate(SteuerPrognoseBase):
    kinder: list[SteuerKindCreate] = []
    betriebsstaetten: list[SteuerBetriebsstaetteCreate] = []


class SteuerPrognoseUpdate(SteuerPrognoseCreate):
    pass


class SteuerPrognoseResponse(SteuerPrognoseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kinder: list[SteuerKindResponse] = []
    betriebsstaetten: list[SteuerBetriebsstaetteResponse] = []
    erstellt_am: datetime
    aktualisiert_am: datetime


# ── Steuerbescheide (Historie der tatsächlichen Steuerlast) ─────────────────

class SteuerBescheidGemeindeBase(BaseModel):
    gemeinde: str
    arbeitsloehne: float = 0
    zerlegungsanteil: float = 0
    hebesatz: float = 0
    gewerbesteuer: float = 0


class SteuerBescheidGemeindeCreate(SteuerBescheidGemeindeBase):
    pass


class SteuerBescheidGemeindeResponse(SteuerBescheidGemeindeBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SteuerBescheidBase(BaseModel):
    jahr: int
    bescheiddatum: Optional[date] = None
    veranlagung: str = 'zusammen'
    vorlaeufig: bool = False

    einkuenfte_gewerbebetrieb: float = 0
    einkuenfte_gewerbebetrieb_ehefrau: float = 0
    einkuenfte_nichtselbststaendig_ehefrau: float = 0
    einkuenfte_vermietung: float = 0
    einkuenfte_sonstige: float = 0
    gesamtbetrag_einkuenfte: float = 0
    zu_versteuerndes_einkommen: float = 0
    kinderfreibetraege: float = 0
    est_tariflich: float = 0
    anrechnung_35: float = 0
    kindergeld_hinzurechnung: float = 0
    einkommensteuer: float = 0
    soli: float = 0
    kirchensteuer: float = 0

    gewerbesteuermessbetrag: Optional[float] = None
    gewerbesteuer: Optional[float] = None

    steuerabzugsbetraege: float = 0
    vorauszahlungen_gesamt: float = 0
    nachzahlungszinsen: float = 0
    nachzahlung_erstattung: float = 0

    vz_folgejahr_quartal: float = 0

    notiz: Optional[str] = None


class SteuerBescheidCreate(SteuerBescheidBase):
    gemeinden: list[SteuerBescheidGemeindeCreate] = []


class SteuerBescheidUpdate(SteuerBescheidCreate):
    pass


class SteuerBescheidResponse(SteuerBescheidBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    gemeinden: list[SteuerBescheidGemeindeResponse] = []
    aktualisiert_am: datetime


# ── Steuerberechnung (rein berechnet, nicht persistiert) ────────────────────

class SteuerZerlegungAnteil(BaseModel):
    gemeinde: str
    hebesatz: float
    anteil_pct: float
    messbetrag_anteil: float
    gewerbesteuer: float


class SteuerKinderErgebnis(BaseModel):
    anzahl_anspruchsberechtigt: int
    kinderfreibetrag_gesamt: float
    est_ohne_kfb: float
    est_mit_kfb: float
    steuerersparnis_kfb: float
    kindergeld_gesamt: float
    kinderfreibetrag_guenstiger: bool
    hinzurechnung_kindergeld: float


class SteuerEinkuenfteErgebnis(BaseModel):
    gewerbebetrieb: float
    gewerbebetrieb_ehefrau: float = 0
    sonstige: float
    nichtselbststaendig_ehefrau: float  # netto, nach Werbungskosten
    vermietung: float                   # netto, nach Werbungskosten + AfA


class SteuerErgebnis(BaseModel):
    jahr: int
    hinweis: str = 'Planungsrechnung zur eigenen Vorsorge — keine Steuerberatung und kein Ersatz für die Steuererklärung.'

    # Einkommensteuer
    einkuenfte: SteuerEinkuenfteErgebnis
    summe_einkuenfte: float
    zve_vor_kinderfreibetrag: float
    kinder: SteuerKinderErgebnis
    est_tariflich: float
    soli: float
    kirchensteuer: float

    # Gewerbesteuer
    gewerbeertrag: float
    gewerbesteuermessbetrag: float
    zerlegung: list[SteuerZerlegungAnteil]
    gewerbesteuer_gesamt: float
    anrechnung_35a: float

    est_nach_anrechnung: float
    gesamtbelastung: float  # ESt (nach § 35) + Soli + KiSt + GewSt

    # Abgleich Vorauszahlungen
    est_vorauszahlungen_gesamt: float
    lohn_soli_kist_ehefrau_gesamt: float
    gewst_vorauszahlungen_gesamt: float
    nachzahlung_est: float          # positiv = Nachzahlung, negativ = Erstattung
    nachzahlung_gewst: float
    nachzahlung_gesamt: float

    monatliche_ruecklage_empfehlung: float


# ── Sparziele (Sparschwein) ──────────────────────────────────────────────────

class SparzielFuetterungBase(BaseModel):
    betrag: float
    datum: date
    notiz: Optional[str] = None


class SparzielFuetterungCreate(SparzielFuetterungBase):
    pass


class SparzielFuetterungResponse(SparzielFuetterungBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SparzielBase(BaseModel):
    name: str
    zielbetrag: float
    zieldatum: date
    zinssatz: float = 0
    aufbewahrungsort: Optional[str] = None
    notiz: Optional[str] = None
    archiviert: bool = False


class SparzielCreate(SparzielBase):
    pass


class SparzielUpdate(SparzielCreate):
    pass


class SparzielResponse(SparzielBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fuetterungen: list[SparzielFuetterungResponse] = []

    # Berechnet, nicht gespeichert — s. services/sparziel.py
    aktueller_stand: float
    restbetrag: float
    fortschritt_pct: float
    monate_bis_ziel: int
    benoetigte_monatsrate: float

    aktualisiert_am: datetime
