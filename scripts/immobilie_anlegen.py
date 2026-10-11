"""Legt ein Objekt im Immobilienrechner an (oder rechnet es nur durch).

Wird vom Befehl /immobilie genutzt, funktioniert aber auch von Hand:

    .venv/bin/python scripts/immobilie_anlegen.py objekt.json
    .venv/bin/python scripts/immobilie_anlegen.py objekt.json --nur-rechnen

objekt.json: {"name": "...", "eingaben": {...}} — Felder wie
ImmobilieEingabenSchema in backend/schemas.py. Fehlende Felder bekommen die
Standardwerte des Schemas.

Läuft über die echte API der App (FastAPI TestClient gegen backend.main),
also mit derselben Validierung und Rechnung wie im Browser — auch dann, wenn
die laufende App noch nicht neu gestartet wurde. Schreibt in dieselbe
SQLite-Datei (data/finanzblick.db).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient  # noqa: E402

from backend.main import app  # noqa: E402


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    nur_rechnen = '--nur-rechnen' in sys.argv
    if len(args) != 1:
        print(__doc__)
        return 2

    objekt = json.loads(Path(args[0]).read_text(encoding='utf-8'))
    client = TestClient(app)

    berechnung = client.post('/api/v1/immobilie/berechnung', json=objekt['eingaben'])
    if berechnung.status_code != 200:
        print(json.dumps({'fehler': berechnung.json()}, ensure_ascii=False, indent=1))
        return 1
    r = berechnung.json()

    ausgabe = {}
    if not nur_rechnen:
        gespeichert = client.post('/api/v1/immobilie/szenarien', json=objekt)
        if gespeichert.status_code != 201:
            print(json.dumps({'fehler': gespeichert.json()}, ensure_ascii=False, indent=1))
            return 1
        ausgabe['gespeichert_id'] = gespeichert.json()['id']

    ausgabe['kennzahlen'] = {k: r[k] for k in (
        'kaufnebenkosten', 'gesamtinvestition', 'darlehen', 'rate_monatlich', 'afa_basis',
        'grenzsteuersatz', 'bruttomietrendite', 'nettomietrendite', 'kaufpreisfaktor',
        'preis_pro_qm', 'cashflow_vor_steuern_monat', 'cashflow_nach_steuern_monat',
        'eigenkapitalrendite', 'irr', 'restschuld_zinsbindung', 'verkaufspreis',
        'spekulationssteuer', 'verkaufserloes_netto', 'vermoegenszuwachs',
    )}
    ausgabe['jahr_1'] = r['jahre'][0]
    ausgabe['warnungen'] = r['warnungen']
    print(json.dumps(ausgabe, ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
