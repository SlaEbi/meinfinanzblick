import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from sqlalchemy import text
from .db import Base, engine
from .routers import konten, darlehen, depots, sachvermoegen, spending, versicherungen, notfall, networth, system

Base.metadata.create_all(bind=engine)

# Fehlende Spalten in bestehenden Datenbanken ergänzen
def _migrate():
    migrations = [
        ("konten", "kontoinhaber",       "TEXT"),
        ("konten", "notiz",              "TEXT"),
        ("konten", "bitwarden_name",     "TEXT"),
        ("depots", "broker",             "TEXT"),
        ("depots", "depotinhaber",       "TEXT"),
        ("depots", "wertpapierdepot_nr", "TEXT"),
        ("depots", "verrechnungskonto",  "TEXT"),
        ("depots", "auszahlungskonto",   "TEXT"),
        ("depots", "bitwarden_name",     "TEXT"),
        ("depots", "notiz",              "TEXT"),
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

FRONTEND = os.path.join(os.path.dirname(__file__), '..', 'frontend')
DOCS = os.path.join(os.path.dirname(__file__), '..', 'docs')

app.mount('/css', StaticFiles(directory=os.path.join(FRONTEND, 'css')), name='css')
app.mount('/js', StaticFiles(directory=os.path.join(FRONTEND, 'js')), name='js')
app.mount('/landing', StaticFiles(directory=DOCS, html=True), name='landing')


@app.get('/')
def root():
    return FileResponse(os.path.join(FRONTEND, 'index.html'))
