import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from sqlalchemy import text
from .db import Base, engine
from .routers import konten, darlehen, depots, sachvermoegen, spending, versicherungen, notfall, networth, system, anhaenge, todos, export, backup, steuer, steuerbescheide, zinseszins, kapitalentnahme, sparziele

Base.metadata.create_all(bind=engine)

# Fehlende Spalten in bestehenden Datenbanken ergänzen
def _migrate():
    migrations = [
        ("konten",   "kontoinhaber",         "TEXT"),
        ("konten",   "bic",                  "TEXT"),
        ("konten",   "notiz",                "TEXT"),
        ("konten",   "bitwarden_name",       "TEXT"),
        ("depots",   "broker",               "TEXT"),
        ("depots",   "depotinhaber",         "TEXT"),
        ("depots",   "wertpapierdepot_nr",   "TEXT"),
        ("depots",   "verrechnungskonto",    "TEXT"),
        ("depots",   "auszahlungskonto",     "TEXT"),
        ("depots",   "bitwarden_name",       "TEXT"),
        ("depots",   "notiz",                "TEXT"),
        ("darlehen", "sondertilgung_betrag",    "NUMERIC"),
        ("darlehen", "notiz",                   "TEXT"),
        ("darlehen", "darlehen_typ",             "TEXT DEFAULT 'annuitaet'"),
        ("darlehen", "tilgungsrate_monatlich",   "NUMERIC"),
        ("darlehen", "anteil_pct",              "NUMERIC DEFAULT 100"),
        ("sachvermoegen", "anteil_pct",         "NUMERIC DEFAULT 100"),
        ("versicherungen", "frist_erinnerung",  "BOOLEAN DEFAULT 0"),
        ("vertraege",      "frist_erinnerung",  "BOOLEAN DEFAULT 0"),
        ("spending_positionen", "empfaenger",   "TEXT DEFAULT 'ich'"),
        ("depots",   "depot_bic",               "TEXT"),
        ("depots",   "verrechnungskonto_bic",   "TEXT"),
        ("depots",   "auszahlungskonto_name",   "TEXT"),
        ("depots",   "auszahlungskonto_bank",   "TEXT"),
        ("depots",   "auszahlungskonto_bic",    "TEXT"),
        ("notfall_eintraege", "gueltig_bis",    "TEXT"),
        ("steuer_betriebsstaetten", "vorauszahlung", "NUMERIC DEFAULT 0"),
        # Steuerbescheid: Felder aus der realen Bescheidstruktur nachgezogen
        ("steuer_bescheide", "veranlagung",              "TEXT DEFAULT 'zusammen'"),
        ("steuer_bescheide", "einkuenfte_gewerbebetrieb",              "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "einkuenfte_gewerbebetrieb_ehefrau",      "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "einkuenfte_nichtselbststaendig_ehefrau", "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "einkuenfte_vermietung",                  "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "einkuenfte_sonstige",                    "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "gesamtbetrag_einkuenfte",  "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "est_tariflich",            "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "anrechnung_35",            "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "kinderfreibetraege",       "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "kindergeld_hinzurechnung", "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "steuerabzugsbetraege",     "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "nachzahlungszinsen",       "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "vz_folgejahr_quartal",     "NUMERIC DEFAULT 0"),
        ("steuer_bescheide", "vorlaeufig",               "BOOLEAN DEFAULT 0"),
        ("sparziele", "aufbewahrungsort", "TEXT"),
        ("steuer_prognosen", "gewinn_gewerbebetrieb_ehefrau", "NUMERIC DEFAULT 0"),
    ]
    with engine.connect() as conn:
        for table, col, typ in migrations:
            existing = [r[1] for r in conn.execute(text(f"PRAGMA table_info({table})"))]
            if col not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {typ}"))
        conn.commit()

_migrate()

app = FastAPI(
    title='MeinFinanzblick API',
    description='Privates lokales Finanz-Dashboard',
    version='1.0.0',
)

app.include_router(konten.router, prefix='/api/v1')
app.include_router(darlehen.router, prefix='/api/v1')
app.include_router(depots.router, prefix='/api/v1')
app.include_router(sachvermoegen.router, prefix='/api/v1')
app.include_router(spending.router, prefix='/api/v1')
app.include_router(versicherungen.router, prefix='/api/v1')
app.include_router(notfall.router, prefix='/api/v1')
app.include_router(networth.router, prefix='/api/v1')
app.include_router(system.router, prefix='/api/v1')
app.include_router(anhaenge.router, prefix='/api/v1')
app.include_router(todos.router, prefix='/api/v1')
app.include_router(export.router, prefix='/api/v1')
app.include_router(backup.router, prefix='/api/v1')
app.include_router(steuer.router, prefix='/api/v1')
app.include_router(steuerbescheide.router, prefix='/api/v1')
app.include_router(zinseszins.router, prefix='/api/v1')
app.include_router(kapitalentnahme.router, prefix='/api/v1')
app.include_router(sparziele.router, prefix='/api/v1')

FRONTEND = os.path.join(os.path.dirname(__file__), '..', 'frontend')
DOCS = os.path.join(os.path.dirname(__file__), '..', 'docs')

app.mount('/css', StaticFiles(directory=os.path.join(FRONTEND, 'css')), name='css')
app.mount('/js', StaticFiles(directory=os.path.join(FRONTEND, 'js')), name='js')
app.mount('/landing', StaticFiles(directory=DOCS, html=True), name='landing')


@app.get('/')
def root():
    return FileResponse(os.path.join(FRONTEND, 'index.html'))
