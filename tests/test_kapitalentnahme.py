"""Tests für die Kapitalentnahme-Mathematik — u. a. gegen die Referenzwerte
eines externen Entnahmerechners verifiziert (Kapital 15.000 €, 3 % p. a.)."""
from backend.services.kapitalentnahme import (
    entnahme_aus_laufzeit, entnahmeplan, max_entnahme_bei_kapitalerhalt,
)


def test_entnahme_aus_laufzeit_referenzwert():
    # Referenz: 15.000 € bei 3 % über 10 Jahre -> ~145 €/Monat
    entnahme = entnahme_aus_laufzeit(15_000, 0.03, 10 * 12)
    assert round(entnahme) == 145


def test_laufzeit_aus_entnahme_referenzwert():
    # Referenz: 15.000 € bei 3 %, 100 €/Monat Entnahme -> ~16 Jahre (189 Monate)
    plan = entnahmeplan(15_000, 0.03, 100)
    assert plan.monate_gesamt == 189
    assert round(plan.monate_gesamt / 12) == 16


def test_max_entnahme_bei_kapitalerhalt_referenzwert():
    # Referenz: 15.000 € bei 3 % -> exakter Zinsertrag 37,50 €/Monat, auf
    # volle Cent abgerundet (nie aufgerundet — sonst zehrt die "sichere"
    # Entnahme das Kapital doch langsam auf)
    assert max_entnahme_bei_kapitalerhalt(15_000, 0.03) == 37.5


def test_entnahme_unter_zinsertrag_wird_nie_verzehrt():
    # Entnahme kleiner als der Zinsertrag -> Kapital wächst, "monate_gesamt"
    # bleibt None auch über den vollen Simulationszeitraum hinweg
    plan = entnahmeplan(15_000, 0.03, 30, max_jahre=60)
    assert plan.monate_gesamt is None
    assert plan.jahre[-1].kapital_ende > 15_000


def test_ohne_zins_linearer_verzehr():
    # 0 % Zins -> Kapital sinkt rein linear, keine Zinserträge
    plan = entnahmeplan(12_000, 0.0, 1_000)
    assert plan.monate_gesamt == 12
    assert plan.zinsertrag_gesamt == 0
    assert plan.entnahme_gesamt == 12_000


def test_jahresreihe_endet_bei_kapital_null():
    plan = entnahmeplan(15_000, 0.03, 100)
    assert plan.jahre[-1].kapital_ende == 0.0
    # Summe der jährlichen Entnahmen entspricht der Gesamtentnahme
    assert round(sum(j.entnahme for j in plan.jahre), 2) == plan.entnahme_gesamt


def test_kapital_null_liefert_leeres_ergebnis():
    plan = entnahmeplan(0, 0.03, 100)
    assert plan.jahre == []
    assert plan.monate_gesamt is None


def test_entnahme_aus_laufzeit_ohne_zins():
    # 0 % Zins -> einfache Division
    assert entnahme_aus_laufzeit(12_000, 0.0, 24) == 500.0
