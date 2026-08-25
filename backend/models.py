from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from .db import Base


class Konto(Base):
    __tablename__ = 'konten'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    bank = Column(String)
    typ = Column(String, nullable=False)  # giro, tagesgeld, festgeld, sparkonto
    iban = Column(String)
    bic = Column(String)
    saldo = Column(Numeric(14, 2), nullable=False, default=0)
    waehrung = Column(String, default='EUR')
    kontoinhaber = Column(String)
    notiz = Column(String)
    bitwarden_name = Column(String)
    aktualisiert_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Depot(Base):
    __tablename__ = 'depots'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    bank = Column(String, default='')   # Alt-Spalte (NOT NULL in bestehender DB), aus UI entfernt
    broker = Column(String)
    depotinhaber = Column(String)
    wertpapierdepot_nr = Column(String)
    depot_bic = Column(String)
    verrechnungskonto = Column(String)          # IBAN Verrechnungskonto
    verrechnungskonto_bic = Column(String)
    auszahlungskonto = Column(String)           # IBAN Auszahlungskonto
    auszahlungskonto_name = Column(String)
    auszahlungskonto_bank = Column(String)
    auszahlungskonto_bic = Column(String)
    wert_aktuell = Column(Numeric(14, 2), nullable=False, default=0)
    bitwarden_name = Column(String)
    notiz = Column(String)
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
    anteil_pct = Column(Numeric(5, 2), default=100)   # Eigentumsanteil in % (z. B. 50 bei GbR-Hälfte)
    darlehen_typ = Column(String, default='annuitaet')  # annuitaet | tilgungsdarlehen
    rate_monatlich = Column(Numeric(14, 2), nullable=False)
    tilgungsrate_monatlich = Column(Numeric(14, 2))     # feste monatl. Tilgung (Tilgungsdarlehen)
    zinsbindung_bis = Column(Date)
    restlaufzeit = Column(Integer)                      # Monate (berechnet)
    sondertilgung_moeglich = Column(Boolean, default=False)
    sondertilgung_betrag = Column(Numeric(14, 2))       # max. jährliche Sondertilgung in €
    hat_ust_auf_zinsen = Column(Boolean, default=False) # 19 % USt auf Zinsen (gewerbliche Darlehen)
    notiz = Column(String)


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
    kategorie = Column(String, nullable=False)  # einnahmen | fixkosten | investments | sparziele
    bezeichnung = Column(String, nullable=False)
    betrag = Column(Numeric(14, 2), nullable=False, default=0)
    empfaenger = Column(String, default='ich')  # ich | ehefrau | beide (nur Einnahmen)
    sort_order = Column(Integer, default=0)
    plan = relationship('SpendingPlan', back_populates='positionen')


class Sachvermoegen(Base):
    __tablename__ = 'sachvermoegen'

    id = Column(Integer, primary_key=True, index=True)
    bezeichnung = Column(String, nullable=False)
    kategorie = Column(String, nullable=False)  # immobilie, fahrzeug, kunst, schmuck, elektronik, sonstiges
    beschreibung = Column(String)
    aktueller_wert = Column(Numeric(14, 2), nullable=False, default=0)
    anteil_pct = Column(Numeric(5, 2), default=100)  # Eigentumsanteil in % (z. B. 50 bei GbR-Hälfte)
    anschaffungswert = Column(Numeric(14, 2))
    anschaffungsjahr = Column(Integer)
    naechster_tuev = Column(Date)   # nur für kategorie='fahrzeug'
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
    frist_erinnerung = Column(Boolean, default=False)  # Kündigungsfrist im Dashboard-Banner zeigen
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
    frist_erinnerung = Column(Boolean, default=False)  # Kündigungsfrist im Dashboard-Banner zeigen
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
    gueltig_bis = Column(Date)        # Ablaufdatum, z. B. bei Vollmachten/Verfügungen (optional)
    prioritaet = Column(Integer, default=2)  # 1=sofort, 2=bald, 3=irgendwann
    erledigt = Column(Boolean, default=False)  # für Checkliste
    sort_order = Column(Integer, default=0)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Todo(Base):
    __tablename__ = 'todos'

    id = Column(Integer, primary_key=True, index=True)
    titel = Column(String, nullable=False)
    notiz = Column(String)
    faelligkeit = Column(Date)
    prioritaet = Column(String, default='mittel')   # hoch | mittel | niedrig
    zustaendigkeit = Column(String, default='ich')  # ich | ehefrau | beide
    erledigt = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))



class Anhang(Base):
    __tablename__ = 'anhaenge'

    id = Column(Integer, primary_key=True, index=True)
    entity_typ = Column(String, nullable=False)   # konto, darlehen, depot, sachwert, versicherung, vertrag, notfall
    entity_id = Column(Integer, nullable=False)
    dateiname = Column(String, nullable=False)    # gespeicherter Dateiname (UUID-basiert)
    original_name = Column(String, nullable=False)
    mime_type = Column(String)
    hochgeladen_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class NetWorthSnapshot(Base):
    __tablename__ = 'networth_snapshots'

    id = Column(Integer, primary_key=True, index=True)
    datum = Column(Date, nullable=False)
    summe_vermoegen = Column(Numeric(14, 2), nullable=False)
    summe_schulden = Column(Numeric(14, 2), nullable=False)
    netto = Column(Numeric(14, 2), nullable=False)


# ── Steuerprognose ───────────────────────────────────────────────────────────

class SteuerPrognose(Base):
    __tablename__ = 'steuer_prognosen'

    id = Column(Integer, primary_key=True, index=True)
    jahr = Column(Integer, nullable=False, unique=True, index=True)
    veranlagung = Column(String, default='zusammen')       # zusammen | einzeln
    kirchensteuerpflicht = Column(String, default='niemand')  # niemand | beide | ich | ehefrau
    zerlegungsmodus = Column(String, default='arbeitsloehne')  # arbeitsloehne | prozent

    # Einkünfte
    gewinn_gewerbebetrieb = Column(Numeric(14, 2), default=0)
    # eigenes Gewerbe der Ehefrau: fließt nur in die Summe der Einkünfte (ESt) ein,
    # NICHT in die Gewerbesteuer-Berechnung unten — die hat eigene Betriebsstätten
    # und würde eine eigene Zerlegung brauchen, die hier (noch) nicht abgebildet ist.
    gewinn_gewerbebetrieb_ehefrau = Column(Numeric(14, 2), default=0)
    sonstige_einkuenfte = Column(Numeric(14, 2), default=0)
    bruttolohn_ehefrau = Column(Numeric(14, 2), default=0)
    werbungskosten_ehefrau = Column(Numeric(14, 2), default=0)
    vermietung_einnahmen = Column(Numeric(14, 2), default=0)
    vermietung_werbungskosten = Column(Numeric(14, 2), default=0)
    vermietung_afa = Column(Numeric(14, 2), default=0)

    # Abzüge / Sonderausgaben
    kv_pv_beitraege_gesamt = Column(Numeric(14, 2), default=0)      # Basisabsicherung, unbegrenzt abzugsfähig
    basisrente_beitrag = Column(Numeric(14, 2), default=0)          # Rürup, gedeckelt
    uebrige_vorsorge_ich = Column(Numeric(14, 2), default=0)        # gedeckelt (selbstständig)
    uebrige_vorsorge_ehefrau = Column(Numeric(14, 2), default=0)    # gedeckelt (angestellt)
    spenden = Column(Numeric(14, 2), default=0)
    kinderbetreuungskosten = Column(Numeric(14, 2), default=0)
    handwerkerleistungen = Column(Numeric(14, 2), default=0)        # § 35a EStG, Abzug von der Steuer

    # Gewerbesteuer — Hinzurechnung/Kürzung
    gewst_hinzurechnung_zinsen_mieten = Column(Numeric(14, 2), default=0)
    gewst_kuerzung_grundbesitz = Column(Numeric(14, 2), default=0)

    # Vorauszahlungen — Einkommensteuer (4 Quartale, inkl. Soli/KiSt-Anteil)
    est_vz_q1 = Column(Numeric(14, 2), default=0)
    est_vz_q2 = Column(Numeric(14, 2), default=0)
    est_vz_q3 = Column(Numeric(14, 2), default=0)
    est_vz_q4 = Column(Numeric(14, 2), default=0)

    # Bereits einbehalten — Lohnsteuer der Ehefrau
    lohnsteuer_ehefrau = Column(Numeric(14, 2), default=0)
    soli_ehefrau = Column(Numeric(14, 2), default=0)
    kirchensteuer_ehefrau = Column(Numeric(14, 2), default=0)

    # GewSt-Vorauszahlungen hängen an SteuerBetriebsstaette.vorauszahlung — die
    # Zahl der Gemeinden ergibt sich aus der Zerlegung und ist nicht auf zwei
    # begrenzt. (Bestandsdatenbanken tragen noch die alten, ungenutzten Spalten
    # gewst_vz_standort1/2; SQLite kann Spalten nicht ohne Tabellenneubau löschen.)

    notiz = Column(String)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    aktualisiert_am = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    kinder = relationship('SteuerKind', back_populates='prognose', cascade='all, delete-orphan')
    betriebsstaetten = relationship('SteuerBetriebsstaette', back_populates='prognose', cascade='all, delete-orphan')


class SteuerKind(Base):
    __tablename__ = 'steuer_kinder'

    id = Column(Integer, primary_key=True, index=True)
    prognose_id = Column(Integer, ForeignKey('steuer_prognosen.id'), nullable=False)
    name = Column(String)
    geburtsdatum = Column(Date, nullable=False)
    in_ausbildung_18_25 = Column(Boolean, default=False)
    prognose = relationship('SteuerPrognose', back_populates='kinder')


class SteuerBetriebsstaette(Base):
    __tablename__ = 'steuer_betriebsstaetten'

    id = Column(Integer, primary_key=True, index=True)
    prognose_id = Column(Integer, ForeignKey('steuer_prognosen.id'), nullable=False)
    gemeinde = Column(String, nullable=False)
    hebesatz = Column(Numeric(6, 2), nullable=False)
    arbeitsloehne = Column(Numeric(14, 2), default=0)          # je AN bereits auf 50.000 € gedeckelt
    taetigkeitsanteil_pct = Column(Numeric(5, 2), default=0)   # Anteil des Inhabers hier tätig, für Unternehmerlohn-Verteilung
    prozent_manuell = Column(Numeric(5, 2))                     # nur Modus "prozent"
    vorauszahlung = Column(Numeric(14, 2), default=0)           # GewSt-Vorauszahlung an diese Gemeinde
    prognose = relationship('SteuerPrognose', back_populates='betriebsstaetten')


# ── Steuerbescheide (Historie der tatsächlichen Steuerlast) ─────────────────

class SteuerBescheid(Base):
    """Ein Steuerjahr, wie es der Bescheid ausweist.

    Die Feldreihenfolge folgt bewusst der Rechenkette des echten Bescheids
    (Gesamtbetrag der Einkünfte -> zvE -> tarifliche ESt -> Anrechnungen ->
    festgesetzte ESt -> Abrechnung), damit beim Abtippen nichts gesucht werden
    muss und der Jahresvergleich die Ursachen einer Veränderung zeigt und nicht
    nur ihr Ergebnis.
    """
    __tablename__ = 'steuer_bescheide'

    id = Column(Integer, primary_key=True, index=True)
    jahr = Column(Integer, nullable=False, unique=True, index=True)
    bescheiddatum = Column(Date)
    veranlagung = Column(String, default='zusammen')            # zusammen | einzeln
    vorlaeufig = Column(Boolean, default=False)                 # § 165 AO — Bescheid kann sich noch ändern

    # Einkommensteuer — Rechenkette
    # Einzelne Einkunftsquellen, wie im Bescheid vor der Summenzeile aufgeführt
    # — sonst verschwindet im Jahresvergleich die Ursache einer Veränderung
    # (z. B. Gewerbebetrieb gestiegen vs. Vermietung geschrumpft) hinter der
    # einen Zahl gesamtbetrag_einkuenfte.
    einkuenfte_gewerbebetrieb = Column(Numeric(14, 2), default=0)          # Ehemann
    einkuenfte_gewerbebetrieb_ehefrau = Column(Numeric(14, 2), default=0)  # eigenes Einzelunternehmen
    einkuenfte_nichtselbststaendig_ehefrau = Column(Numeric(14, 2), default=0)
    einkuenfte_vermietung = Column(Numeric(14, 2), default=0)
    einkuenfte_sonstige = Column(Numeric(14, 2), default=0)
    gesamtbetrag_einkuenfte = Column(Numeric(14, 2), default=0)
    zu_versteuerndes_einkommen = Column(Numeric(14, 2), default=0)
    kinderfreibetraege = Column(Numeric(14, 2), default=0)      # im zvE bereits abgezogen
    est_tariflich = Column(Numeric(14, 2), default=0)           # vor Anrechnungen
    anrechnung_35 = Column(Numeric(14, 2), default=0)           # § 35 EStG, GewSt-Anrechnung
    kindergeld_hinzurechnung = Column(Numeric(14, 2), default=0)  # § 31 S. 4 EStG
    einkommensteuer = Column(Numeric(14, 2), default=0)         # festgesetzt laut Bescheid
    soli = Column(Numeric(14, 2), default=0)
    kirchensteuer = Column(Numeric(14, 2), default=0)

    # Gewerbesteuer (Aufteilung je Gemeinde in SteuerBescheidGemeinde)
    gewerbesteuermessbetrag = Column(Numeric(14, 2))
    gewerbesteuer = Column(Numeric(14, 2))

    # Abrechnung
    steuerabzugsbetraege = Column(Numeric(14, 2), default=0)    # z. B. angerechnete Kapitalertragsteuer
    vorauszahlungen_gesamt = Column(Numeric(14, 2), default=0)  # bereits getilgt
    nachzahlungszinsen = Column(Numeric(14, 2), default=0)      # § 233a AO
    nachzahlung_erstattung = Column(Numeric(14, 2), default=0)  # positiv=Nachzahlung, negativ=Erstattung

    # Blick nach vorn: im Bescheid neu festgesetzte Vorauszahlung je Quartal
    vz_folgejahr_quartal = Column(Numeric(14, 2), default=0)

    notiz = Column(String)
    aktualisiert_am = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # order_by hält die Reihenfolge des Zerlegungsbescheids (Geschäftsleitung zuerst)
    gemeinden = relationship(
        'SteuerBescheidGemeinde', back_populates='bescheid',
        cascade='all, delete-orphan', order_by='SteuerBescheidGemeinde.id',
    )


class SteuerBescheidGemeinde(Base):
    """Zerlegungsanteil einer Gemeinde am Gewerbesteuermessbetrag (§§ 28–31 GewStG).

    Ohne diese Aufteilung ließe sich im Jahresvergleich nicht unterscheiden, ob
    die Gewerbesteuer wegen eines höheren Gewinns, eines angehobenen Hebesatzes
    oder verschobener Arbeitslöhne gestiegen ist.
    """
    __tablename__ = 'steuer_bescheid_gemeinden'

    id = Column(Integer, primary_key=True, index=True)
    bescheid_id = Column(Integer, ForeignKey('steuer_bescheide.id'), nullable=False)
    gemeinde = Column(String, nullable=False)
    arbeitsloehne = Column(Numeric(14, 2), default=0)      # Zerlegungsmaßstab
    zerlegungsanteil = Column(Numeric(14, 2), default=0)   # Anteil am Messbetrag
    hebesatz = Column(Numeric(6, 2), default=0)            # in %
    gewerbesteuer = Column(Numeric(14, 2), default=0)      # von dieser Gemeinde festgesetzt
    bescheid = relationship('SteuerBescheid', back_populates='gemeinden')


# ── Sparziele (Sparschwein) ──────────────────────────────────────────────────

class Sparziel(Base):
    """Ein konkretes Sparziel mit Zielbetrag und -datum (z. B. "Weltreise in
    5 Jahren"), losgelöst von den normalen Konten — der Fortschritt kommt aus
    manuell erfassten Fütterungen, nicht aus einem Kontostand, damit sich ein
    Sparziel nicht mit anderem Geld auf demselben Konto vermischt."""
    __tablename__ = 'sparziele'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    zielbetrag = Column(Numeric(14, 2), nullable=False)
    zieldatum = Column(Date, nullable=False)
    zinssatz = Column(Numeric(6, 4), default=0)  # Dezimal — falls das Ersparte z. B. auf einem Tagesgeldkonto liegt
    aufbewahrungsort = Column(String)  # "Wo liegt das Geld?" — reiner Hinweistext, keine Kontoverknüpfung (s. §5 CLAUDE.md)
    notiz = Column(String)
    archiviert = Column(Boolean, default=False)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    aktualisiert_am = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    fuetterungen = relationship(
        'SparzielFuetterung', back_populates='sparziel',
        cascade='all, delete-orphan', order_by='SparzielFuetterung.datum.desc()',
    )


class SparzielFuetterung(Base):
    """Eine einzelne Einzahlung ("Fütterung") in ein Sparziel."""
    __tablename__ = 'sparziel_fuetterungen'

    id = Column(Integer, primary_key=True, index=True)
    sparziel_id = Column(Integer, ForeignKey('sparziele.id'), nullable=False)
    betrag = Column(Numeric(14, 2), nullable=False)
    datum = Column(Date, nullable=False)
    notiz = Column(String)
    erstellt_am = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    sparziel = relationship('Sparziel', back_populates='fuetterungen')
