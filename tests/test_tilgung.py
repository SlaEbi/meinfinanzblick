"""Tests für die Tilgungsmathematik — gegen bekannte Werte verifiziert."""
from backend.services.tilgung import restlaufzeit_monate


def test_immobiliendarlehen_280k():
    # 280.000 € Restschuld, 3,5 % p. a., 1.200 €/Monat
    # Gegenprobe (Online-Annuitätenrechner): 392 Monate = 32 J 8 M
    res = restlaufzeit_monate(280_000, 0.035, 1_200)
    assert res.fehler is None
    assert res.monate == 392


def test_kleines_darlehen():
    # 22.000 € Restschuld, 1,3 % p. a., 250 €/Monat
    res = restlaufzeit_monate(22_000, 0.013, 250)
    assert res.fehler is None
    # Gegenprobe: 92,53 → aufgerundet 93 Monate (= 7 J 9 M)
    assert res.monate == 93


def test_zinsfrei_lineare_tilgung():
    # 0 % → 12.000 € / 1.000 €/Monat = 12 Monate
    res = restlaufzeit_monate(12_000, 0.0, 1_000)
    assert res.fehler is None
    assert res.monate == 12


def test_zinsfrei_aufrundung():
    # 0 % → 10.500 € / 1.000 € = 10,5 → aufgerundet 11 Monate
    res = restlaufzeit_monate(10_500, 0.0, 1_000)
    assert res.monate == 11


def test_rate_deckt_zinsen_nicht():
    # 300.000 € bei 4 % → Monatszins 1.000 €; Rate 800 € reicht nicht
    res = restlaufzeit_monate(300_000, 0.04, 800)
    assert res.monate is None
    assert res.fehler == 'rate_zu_niedrig'


def test_unvollstaendige_eingabe():
    assert restlaufzeit_monate(0, 0.03, 1_000).fehler == 'unvollstaendig'
    assert restlaufzeit_monate(50_000, 0.03, 0).fehler == 'unvollstaendig'


def test_rate_exakt_gleich_zins_laeuft_ewig():
    # Rate == Monatszins → tilgt nie
    res = restlaufzeit_monate(300_000, 0.04, 1_000)
    assert res.fehler == 'rate_zu_niedrig'
