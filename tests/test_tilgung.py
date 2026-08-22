"""Tests für die Tilgungsmathematik — gegen bekannte Werte verifiziert."""
from backend.services.tilgung import restlaufzeit_monate, tilgungsplan


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


# ── Tilgungsplan ──────────────────────────────────────────────────────────

def test_tilgungsplan_stimmt_mit_restlaufzeit_monate_ueberein():
    # Ohne Sondertilgung muss der Jahresplan exakt dieselbe Gesamtlaufzeit
    # liefern wie die unabhängige restlaufzeit_monate()-Formel — beide
    # rechnen dasselbe Annuitätendarlehen, nur auf unterschiedliche Weise.
    ref = restlaufzeit_monate(280_000, 0.035, 1_200)
    plan = tilgungsplan(280_000, 0.035, 1_200)
    assert plan.monate_gesamt == ref.monate == 392


def test_tilgungsplan_zinsfrei_lineare_tilgung():
    # 0 % → 12.000 € / 1.000 €/Monat = exakt 12 Monate, 1 Jahreszeile, 0 Zins
    plan = tilgungsplan(12_000, 0.0, 1_000)
    assert plan.monate_gesamt == 12
    assert plan.zinsen_gesamt == 0
    assert len(plan.jahre) == 1
    assert plan.jahre[0].restschuld_ende == 0
    assert plan.jahre[0].tilgung == 12_000


def test_tilgungsplan_jahressumme_ergibt_restschuld():
    # Summe aller Jahres-Tilgungen (inkl. Sondertilgung) muss die
    # ursprüngliche Restschuld ergeben — sonst verschwindet oder entsteht
    # Geld in der Simulation.
    plan = tilgungsplan(100_000, 0.03, 600)
    gesamt_getilgt = sum(j.tilgung + j.sondertilgung for j in plan.jahre)
    # Toleranz statt exaktem Vergleich: über ~250 Monate akkumuliert reines
    # Float-Runden im Cent-Bereich Abweichungen — kein Fehler im Modell.
    assert abs(gesamt_getilgt - 100_000.0) < 0.05


def test_tilgungsplan_sondertilgung_verkuerzt_laufzeit_und_spart_zinsen():
    # Dieselbe Rate, einmal ohne und einmal mit 5.000 €/Jahr Sondertilgung —
    # die Sondertilgung muss die Laufzeit verkürzen UND die Gesamtzinsen senken.
    ohne = tilgungsplan(200_000, 0.035, 1_000)
    mit = tilgungsplan(200_000, 0.035, 1_000, sondertilgung_jahr=5_000)
    assert mit.monate_gesamt < ohne.monate_gesamt
    assert mit.zinsen_gesamt < ohne.zinsen_gesamt


def test_tilgungsplan_tilgungsdarlehen_feste_tilgungsrate():
    # Tilgungsdarlehen: feste Tilgungsrate 500 €/Monat, Zins kommt oben drauf
    # und sinkt mit fallender Restschuld → Gesamtlaufzeit exakt 24 Monate.
    plan = tilgungsplan(12_000, 0.03, rate_monatlich=0, darlehen_typ='tilgungsdarlehen', tilgungsrate_monatlich=500)
    assert plan.monate_gesamt == 24
    assert plan.jahre[-1].restschuld_ende == 0


def test_tilgungsplan_leere_restschuld():
    assert tilgungsplan(0, 0.03, 1_000).jahre == []
    assert tilgungsplan(0, 0.03, 1_000).monate_gesamt is None
