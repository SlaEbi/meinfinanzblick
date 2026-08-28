import os
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db import Base, get_db
from backend.main import app


@pytest.fixture()
def client():
    fd, path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    engine = create_engine(f'sqlite:///{path}', connect_args={'check_same_thread': False})
    TestingSession = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    os.remove(path)


def test_create_and_get(client):
    payload = {
        'jahr': 2024,
        'zu_versteuerndes_einkommen': 80000,
        'einkommensteuer': 21000,
        'soli': 500,
        'kirchensteuer': 1200,
        'vorauszahlungen_gesamt': 20000,
        'nachzahlung_erstattung': 2700,
    }
    res = client.post('/api/v1/steuerbescheide/', json=payload)
    assert res.status_code == 201
    body = res.json()
    assert body['jahr'] == 2024
    assert body['einkommensteuer'] == 21000

    res = client.get('/api/v1/steuerbescheide/2024')
    assert res.status_code == 200
    assert res.json()['zu_versteuerndes_einkommen'] == 80000


def test_duplicate_jahr_conflicts(client):
    payload = {'jahr': 2023, 'zu_versteuerndes_einkommen': 1}
    client.post('/api/v1/steuerbescheide/', json=payload)
    res = client.post('/api/v1/steuerbescheide/', json=payload)
    assert res.status_code == 409


def test_update(client):
    client.post('/api/v1/steuerbescheide/', json={'jahr': 2022, 'einkommensteuer': 1000})
    res = client.put('/api/v1/steuerbescheide/2022', json={'jahr': 2022, 'einkommensteuer': 1500})
    assert res.status_code == 200
    assert res.json()['einkommensteuer'] == 1500


def test_list_sorted_desc(client):
    client.post('/api/v1/steuerbescheide/', json={'jahr': 2021})
    client.post('/api/v1/steuerbescheide/', json={'jahr': 2023})
    client.post('/api/v1/steuerbescheide/', json={'jahr': 2022})
    res = client.get('/api/v1/steuerbescheide/')
    jahre = [b['jahr'] for b in res.json()]
    assert jahre == [2023, 2022, 2021]


def test_bescheid_mit_zerlegung_auf_drei_gemeinden(client):
    """Beispielbescheid 2023: Messbetrag 2.860 € auf drei Gemeinden zerlegt."""
    payload = {
        'jahr': 2023,
        'gesamtbetrag_einkuenfte': 98500,
        'zu_versteuerndes_einkommen': 79300,
        'est_tariflich': 15680,
        'anrechnung_35': 2470,
        'kindergeld_hinzurechnung': 0,
        'einkommensteuer': 13140,
        'gewerbesteuermessbetrag': 2860,
        'gewerbesteuer': 2860,
        'steuerabzugsbetraege': 1,
        'vorauszahlungen_gesamt': 3200,
        'nachzahlungszinsen': 35,
        'nachzahlung_erstattung': 1200,
        'gemeinden': [
            {'gemeinde': 'Lindenau', 'arbeitsloehne': 47000, 'zerlegungsanteil': 1344.20, 'hebesatz': 400},
            {'gemeinde': 'Rosenfeld', 'arbeitsloehne': 38000, 'zerlegungsanteil': 1086.80, 'hebesatz': 400},
            {'gemeinde': 'Kaltenbach', 'arbeitsloehne': 15000, 'zerlegungsanteil': 429.00, 'hebesatz': 400},
        ],
    }
    res = client.post('/api/v1/steuerbescheide/', json=payload)
    assert res.status_code == 201
    body = res.json()
    assert len(body['gemeinden']) == 3
    assert round(sum(g['zerlegungsanteil'] for g in body['gemeinden']), 2) == 2860.00
    assert body['nachzahlungszinsen'] == 35

    # Beim Aktualisieren wird die Gemeindeliste ersetzt, nicht angehängt
    payload['gemeinden'] = payload['gemeinden'][:2]
    res = client.put('/api/v1/steuerbescheide/2023', json=payload)
    assert res.status_code == 200
    assert len(res.json()['gemeinden']) == 2


def test_delete_removes_record_and_attachments(client):
    client.post('/api/v1/steuerbescheide/', json={'jahr': 2020})
    res = client.delete('/api/v1/steuerbescheide/2020')
    assert res.status_code == 204
    res = client.get('/api/v1/steuerbescheide/2020')
    assert res.status_code == 404
