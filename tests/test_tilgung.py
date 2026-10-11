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


def test_tilgungsplan_tilgungsfreie_monate_nur_zinsen():
    # 24 tilgungsfreie Monate: Restschuld bleibt stehen, gezahlt werden nur
    # die Zinsen (200.000 € × 3 % = 6.000 €/Jahr), Tilgung 0.
    plan = tilgungsplan(200_000, 0.03, 1_000, tilgungsfreie_monate=24)
    for j in plan.jahre[:2]:
        assert j.tilgung == 0
        assert j.restschuld_ende == 200_000
        assert abs(j.zins - 6_000) < 0.01
    assert plan.jahre[2].tilgung > 0


def test_tilgungsplan_tilgungsfreie_monate_verlaengern_laufzeit_exakt():
    # Nach der Anlaufphase läuft die Annuität exakt wie ein frisches Darlehen
    # über die volle Summe — Gesamtlaufzeit = tilgungsfreie Monate + Annuität,
    # Gesamtzinsen = Anlaufzinsen + Zinsen des normalen Plans.
    normal = tilgungsplan(200_000, 0.03, 1_000)
    mit = tilgungsplan(200_000, 0.03, 1_000, tilgungsfreie_monate=36)
    assert mit.monate_gesamt == normal.monate_gesamt + 36
    assert abs(mit.zinsen_gesamt - (normal.zinsen_gesamt + 3 * 6_000)) < 0.05


def test_tilgungsplan_tilgungsfreie_monate_ohne_sondertilgung():
    # In der Anlaufphase wird auch keine Sondertilgung verbucht — die setzt
    # erst mit Tilgungsbeginn ein.
    plan = tilgungsplan(200_000, 0.03, 1_000, sondertilgung_jahr=5_000, tilgungsfreie_monate=24)
    assert plan.jahre[0].sondertilgung == 0
    assert plan.jahre[1].sondertilgung == 0
    assert plan.jahre[2].sondertilgung == 5_000


def test_tilgungsplan_tilgungsfreie_monate_tilgungsdarlehen():
    # Tilgungsdarlehen 12.000 € / 500 € Tilgung, 12 Monate tilgungsfrei → 12 + 24 Monate.
    plan = tilgungsplan(
        12_000, 0.03, rate_monatlich=0, darlehen_typ='tilgungsdarlehen',
        tilgungsrate_monatlich=500, tilgungsfreie_monate=12,
    )
    assert plan.monate_gesamt == 36
    assert plan.jahre[0].tilgung == 0
    assert abs(plan.jahre[0].zins - 360) < 0.01


def test_tilgungsplan_tilgungsfreie_monate_unterjaehrig():
    # 18 Monate tilgungsfrei: Jahr 1 komplett ohne Tilgung, in Jahr 2 nur die
    # zweite Hälfte — Laufzeit verlängert sich exakt um 18 Monate.
    normal = tilgungsplan(200_000, 0.03, 1_000)
    plan = tilgungsplan(200_000, 0.03, 1_000, tilgungsfreie_monate=18)
    assert plan.jahre[0].tilgung == 0
    assert 0 < plan.jahre[1].tilgung < plan.jahre[2].tilgung
    assert plan.monate_gesamt == normal.monate_gesamt + 18


def test_tilgungsplan_zinstage_erste_rate_anteilig():
    # Beginn 1.3., erste Rate 30.3. → 29 Zinstage (30/360) statt 30: der erste
    # Monatszins (300 €) ist um 10 € kleiner, die Annuität tilgt diese 10 €
    # mehr — was in den Folgemonaten noch ein paar Cent Zinsen spart.
    normal = tilgungsplan(120_000, 0.03, 1_000, max_jahre=1)
    kurz = tilgungsplan(120_000, 0.03, 1_000, zinstage_erste_rate=29, max_jahre=1)
    diff = normal.jahre[0].zins - kurz.jahre[0].zins
    assert 10 <= diff < 10.5
    assert kurz.jahre[0].restschuld_ende < normal.jahre[0].restschuld_ende


def test_tilgungsplan_zinstage_standard_unveraendert():
    # 30 Zinstage = genau ein Monat → identisch zum bisherigen Verhalten.
    assert tilgungsplan(200_000, 0.035, 1_000, zinstage_erste_rate=30) == tilgungsplan(200_000, 0.035, 1_000)


def test_tilgungsplan_monate_summieren_sich_zum_jahr():
    # Die Monatszeilen eines Jahres ergeben in Summe die Jahreszeile, und die
    # Restschuld des letzten Monats ist die Restschuld zum Jahresende.
    plan = tilgungsplan(200_000, 0.035, 1_000, sondertilgung_jahr=5_000, tilgungsfreie_monate=6)
    assert len(plan.jahre[0].monate) == 12
    assert [m.monat for m in plan.jahre[1].monate] == list(range(13, 25))
    for j in plan.jahre:
        assert abs(sum(m.zins for m in j.monate) - j.zins) < 0.06
        assert abs(sum(m.tilgung for m in j.monate) - j.tilgung) < 0.06
        assert abs(sum(m.sondertilgung for m in j.monate) - j.sondertilgung) < 0.01
        assert j.monate[-1].restschuld_ende == j.restschuld_ende
    # Erste 6 Monate tilgungsfrei, Sondertilgung nur in der 12. Rate des Jahres
    assert all(m.tilgung == 0 for m in plan.jahre[0].monate[:6])
    assert plan.jahre[0].monate[6].tilgung > 0
    assert [m.sondertilgung > 0 for m in plan.jahre[0].monate] == [False] * 11 + [True]
