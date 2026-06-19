from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .db import Base


class Konto(Base):
    __tablename__ = 'konten'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    bank = Column(String, nullable=False)
    typ = Column(String, nullable=False)  # giro, tagesgeld, festgeld, sparkonto
    iban = Column(String)
    saldo = Column(Numeric(14, 2), nullable=False, default=0)
    waehrung = Column(String, default='EUR')
    aktualisiert_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Depot(Base):
    __tablename__ = 'depots'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    bank = Column(String, nullable=False)
    depotnummer = Column(String)
    wert_aktuell = Column(Numeric(14, 2), nullable=False, default=0)
    aktualisiert_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    positionen = relationship(
        'DepotPosition', back_populates='depot', cascade='all, delete-orphan'
    )


class DepotPosition(Base):
    __tablename__ = 'depot_positionen'

    id = Column(Integer, primary_key=True, index=True)
    depot_id = Column(Integer, ForeignKey('depots.id'), nullable=False)
    isin = Column(String)
    name = Column(String, nullable=False)
    anzahl = Column(Numeric(14, 4))
    kurs = Column(Numeric(14, 4))
    wert = Column(Numeric(14, 2))
    depot = relationship('Depot', back_populates='positionen')


class Darlehen(Base):
    __tablename__ = 'darlehen'

    id = Column(Integer, primary_key=True, index=True)
    bezeichnung = Column(String, nullable=False)
    glaeubiger = Column(String, nullable=False)
    urspr_betrag = Column(Numeric(14, 2), nullable=False)
    restschuld = Column(Numeric(14, 2), nullable=False)
    zinssatz = Column(Numeric(6, 4), nullable=False)   # 0.0350 = 3.50 %
    rate_monatlich = Column(Numeric(14, 2), nullable=False)
    zinsbindung_bis = Column(Date)
    restlaufzeit = Column(Integer)                      # Monate
    sondertilgung_moeglich = Column(Boolean, default=False)


class SpendingPlan(Base):
    __tablename__ = 'spending_plans'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default='Conscious Spending Plan')
    stand = Column(Date)
    brutto_monatlich = Column(Numeric(14, 2), nullable=False, default=0)
    netto_monatlich = Column(Numeric(14, 2), nullable=False, default=0)
    sonstiges_puffer_pct = Column(Numeric(5, 3), default=0.05)  # auto-buffer for fixkosten
    ist_aktiv = Column(Boolean, default=True)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    positionen = relationship('SpendingPosition', back_populates='plan', cascade='all, delete-orphan',
                              order_by='SpendingPosition.sort_order')


class SpendingPosition(Base):
    __tablename__ = 'spending_positionen'

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey('spending_plans.id'), nullable=False)
    kategorie = Column(String, nullable=False)  # fixkosten | investments | sparziele
    bezeichnung = Column(String, nullable=False)
    betrag = Column(Numeric(14, 2), nullable=False, default=0)
    sort_order = Column(Integer, default=0)
    plan = relationship('SpendingPlan', back_populates='positionen')


class Sachvermoegen(Base):
    __tablename__ = 'sachvermoegen'

    id = Column(Integer, primary_key=True, index=True)
    bezeichnung = Column(String, nullable=False)
    kategorie = Column(String, nullable=False)  # immobilie, fahrzeug, kunst, schmuck, elektronik, sonstiges
    beschreibung = Column(String)
    aktueller_wert = Column(Numeric(14, 2), nullable=False, default=0)
    anschaffungswert = Column(Numeric(14, 2))
    anschaffungsjahr = Column(Integer)
    aktualisiert_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Versicherung(Base):
    __tablename__ = 'versicherungen'

    id = Column(Integer, primary_key=True, index=True)
    art = Column(String, nullable=False)          # haftpflicht, kfz, kranken, leben, haus, unfall, rechtsschutz, sonstiges
    bezeichnung = Column(String, nullable=False)  # eigener Name/Bezeichnung
    anbieter = Column(String, nullable=False)
    vertragsnummer = Column(String)
    beitrag = Column(Numeric(14, 2), nullable=False, default=0)
    zahlweise = Column(String, default='monatlich')  # monatlich, quartalsweise, halbjährlich, jährlich
    laufzeit_bis = Column(Date)
    kuendigungsfrist_tage = Column(Integer, default=0)
    kontakt_telefon = Column(String)
    kontakt_email = Column(String)
    notiz = Column(String)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Vertrag(Base):
    __tablename__ = 'vertraege'

    id = Column(Integer, primary_key=True, index=True)
    art = Column(String, nullable=False)          # strom, gas, internet, handy, streaming, gym, sonstiges
    bezeichnung = Column(String, nullable=False)
    anbieter = Column(String, nullable=False)
    vertragsnummer = Column(String)
    kosten = Column(Numeric(14, 2), nullable=False, default=0)
    zahlweise = Column(String, default='monatlich')
    laufzeit_bis = Column(Date)
    kuendigungsfrist_tage = Column(Integer, default=0)
    notiz = Column(String)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Kontakt(Base):
    __tablename__ = 'kontakte'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    rolle = Column(String, nullable=False)  # bank, versicherung, steuerberater, anwalt, notar, arzt, sonstiges
    firma = Column(String)
    telefon = Column(String)
    email = Column(String)
    adresse = Column(String)
    notiz = Column(String)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NotfallEintrag(Base):
    __tablename__ = 'notfall_eintraege'

    id = Column(Integer, primary_key=True, index=True)
    titel = Column(String, nullable=False)
    kategorie = Column(String, nullable=False)  # zugaenge, dokumente, finanzen, digital, sofortmassnahme, sonstiges
    verweis = Column(String)          # wo liegt es (Passwort-Manager, Safe, Notar, etc.)
    hinweis = Column(String)          # zusätzliche Infos — KEINE Klartext-Passwörter
    prioritaet = Column(Integer, default=2)  # 1=sofort, 2=bald, 3=irgendwann
    erledigt = Column(Boolean, default=False)  # für Checkliste
    sort_order = Column(Integer, default=0)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NetWorthSnapshot(Base):
    __tablename__ = 'networth_snapshots'

    id = Column(Integer, primary_key=True, index=True)
    datum = Column(Date, nullable=False)
    summe_vermoegen = Column(Numeric(14, 2), nullable=False)
    summe_schulden = Column(Numeric(14, 2), nullable=False)
    netto = Column(Numeric(14, 2), nullable=False)
