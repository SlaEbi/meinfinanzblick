"""Tests für die Sparziel-Mathematik — gegen bekannte Werte verifiziert."""
from datetime import date

from backend.services.sparziel import benoetigte_monatsrate, monate_bis


def test_monate_bis_volle_jahre():
    assert monate_bis(date(2031, 8, 24), date(2026, 8, 24)) == 60


def test_monate_bis_rundet_auf_volle_monate_ab():
    # Zieltag liegt vor dem heutigen Tag im Monat -> ein Monat weniger
    assert monate_bis(date(2026, 9, 10), date(2026, 8, 24)) == 0
    assert monate_bis(date(2026, 9, 25), date(2026, 8, 24)) == 1


def test_monate_bis_vergangenheit_wird_auf_null_gekappt():
    assert monate_bis(date(2020, 1, 1), date(2026, 8, 24)) == 0


def test_rate_ohne_zins_lineare_teilung():
    # Weltreise: 6.000 € Ziel, nichts angespart, 60 Monate -> 100 €/Monat
    rate = benoetigte_monatsrate(6_000, 0, 0.0, 60)
    assert rate == 100.0


def test_rate_beruecksichtigt_bereits_angesparten_betrag():
    rate = benoetigte_monatsrate(6_000, 1_200, 0.0, 48)
    assert rate == round((6_000 - 1_200) / 48, 2)


def test_rate_mit_zins_liegt_unter_der_zinsfreien_rate():
    ohne_zins = benoetigte_monatsrate(10_000, 0, 0.0, 60)
    mit_zins = benoetigte_monatsrate(10_000, 0, 0.03, 60)
    assert mit_zins < ohne_zins


def test_ziel_bereits_erreicht_braucht_keine_rate_mehr():
    assert benoetigte_monatsrate(5_000, 5_000, 0.02, 12) == 0.0
    assert benoetigte_monatsrate(5_000, 6_000, 0.02, 12) == 0.0


def test_zieldatum_verstrichen_verlangt_restbetrag_sofort():
    assert benoetigte_monatsrate(5_000, 3_000, 0.02, 0) == 2_000.0


def test_rate_mit_zins_reproduziert_zielbetrag():
    # Gegenprobe: aktueller_stand + n Monatsraten, jeweils verzinst, muss
    # wieder nahe beim Zielbetrag ankommen — nicht exakt, weil die Rate für
    # die reale Nutzung auf den Cent gerundet wird und sich diese Rundung
    # über 36 Monate zu ein paar Cent aufsummiert.
    zielbetrag, bestand, zinssatz, monate = 20_000, 2_000, 0.025, 36
    rate = benoetigte_monatsrate(zielbetrag, bestand, zinssatz, monate)

    r = zinssatz / 12
    kapital = bestand
    for _ in range(monate):
        kapital = kapital * (1 + r) + rate
    assert abs(kapital - zielbetrag) < 0.50
