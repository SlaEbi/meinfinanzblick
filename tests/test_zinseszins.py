"""Tests für die Zinseszinsmathematik — gegen bekannte Werte verifiziert."""
from backend.services.zinseszins import zinseszins_verlauf


def test_ohne_zins_linear():
    # 0 % Zins → Gesamtkapital = Startkapital + Sparraten, rein linear
    erg = zinseszins_verlauf(10_000, 200, 0.0, 5)
    assert erg.jahre[-1].gesamtkapital == 10_000 + 200 * 60
    assert erg.einzahlungen_gesamt == 10_000 + 200 * 60
    assert erg.zinsertrag_gesamt == 0


def test_reine_zinseszinsformel_ohne_sparrate():
    # Klassische Zinseszinsformel: K·(1+r/12)^(12n), Sparrate 0
    startkapital = 50_000
    zinssatz = 0.06
    erg = zinseszins_verlauf(startkapital, 0, zinssatz, 10)
    erwartet = startkapital * (1 + zinssatz / 12) ** (12 * 10)
    assert erg.gesamtkapital_end == round(erwartet, 2)


def test_inflation_null_gleicht_nominal_und_real():
    erg = zinseszins_verlauf(5_000, 100, 0.05, 8, inflationsrate=0.0)
    for jahr in erg.jahre:
        assert jahr.gesamtkapital == jahr.gesamtkapital_real


def test_inflation_senkt_realen_wert():
    erg = zinseszins_verlauf(5_000, 100, 0.05, 8, inflationsrate=0.02)
    letztes = erg.jahre[-1]
    assert letztes.gesamtkapital_real < letztes.gesamtkapital


def test_jahresreihe_hat_richtige_laenge():
    erg = zinseszins_verlauf(1_000, 50, 0.04, 15)
    assert len(erg.jahre) == 15
    assert [j.jahr for j in erg.jahre] == list(range(1, 16))


def test_laufzeit_null_liefert_leeres_ergebnis():
    erg = zinseszins_verlauf(1_000, 50, 0.04, 0)
    assert erg.jahre == []
    assert erg.gesamtkapital_end == 0.0
