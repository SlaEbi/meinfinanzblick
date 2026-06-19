from pydantic import BaseModel, ConfigDict
from datetime import date, datetime
from typing import Optional


# ── Konto ──────────────────────────────────────────────────────────────────────

class KontoBase(BaseModel):
    name: str
    bank: str
    typ: str
    iban: Optional[str] = None
    saldo: float
    waehrung: str = 'EUR'
    kontoinhaber: Optional[str] = None
    notiz: Optional[str] = None


class KontoCreate(KontoBase):
    pass


class KontoUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    typ: Optional[str] = None
    iban: Optional[str] = None
    saldo: Optional[float] = None
    waehrung: Optional[str] = None
    kontoinhaber: Optional[str] = None
    notiz: Optional[str] = None


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
    bank: str
    depotnummer: Optional[str] = None
    wert_aktuell: float
    kontoinhaber: Optional[str] = None
    notiz: Optional[str] = None


class DepotCreate(DepotBase):
    pass


class DepotUpdate(BaseModel):
    name: Optional[str] = None
    bank: Optional[str] = None
    depotnummer: Optional[str] = None
    wert_aktuell: Optional[float] = None
    kontoinhaber: Optional[str] = None
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
    rate_monatlich: float
    zinsbindung_bis: Optional[date] = None
    restlaufzeit: Optional[int] = None
    sondertilgung_moeglich: bool = False


class DarlehenCreate(DarlehenBase):
    pass


class DarlehenUpdate(BaseModel):
    bezeichnung: Optional[str] = None
    glaeubiger: Optional[str] = None
    urspr_betrag: Optional[float] = None
    restschuld: Optional[float] = None
    zinssatz: Optional[float] = None
    rate_monatlich: Optional[float] = None
    zinsbindung_bis: Optional[date] = None
    restlaufzeit: Optional[int] = None
    sondertilgung_moeglich: Optional[bool] = None


class DarlehenResponse(DarlehenBase):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ── Spending Plan ──────────────────────────────────────────────────────────────

class SpendingPositionBase(BaseModel):
    kategorie: str
    bezeichnung: str
    betrag: float
    sort_order: int = 0


class SpendingPositionCreate(SpendingPositionBase):
    pass


class SpendingPositionUpdate(BaseModel):
    bezeichnung: Optional[str] = None
    betrag: Optional[float] = None
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
    anschaffungswert: Optional[float] = None
    anschaffungsjahr: Optional[int] = None


class SachvermoegenCreate(SachvermoegenBase):
    pass


class SachvermoegenUpdate(BaseModel):
    bezeichnung: Optional[str] = None
    kategorie: Optional[str] = None
    beschreibung: Optional[str] = None
    aktueller_wert: Optional[float] = None
    anschaffungswert: Optional[float] = None
    anschaffungsjahr: Optional[int] = None


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
    prioritaet: Optional[int] = None
    erledigt: Optional[bool] = None
    sort_order: Optional[int] = None


class NotfallEintragResponse(NotfallEintragBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    erstellt_am: datetime


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
