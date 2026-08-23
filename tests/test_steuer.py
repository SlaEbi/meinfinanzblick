"""Tests für die Steuerprognose — Tarif, Zerlegung, Anrechnung, Günstigerprüfung."""
from datetime import date
from decimal import Decimal as D

from backend.services.steuer import (
    est_tarif_grund, est_tarif_splitting, kind_anspruchsberechtigt,
    kindergeld_monate_im_jahr, kindergeld_jahresbetrag, guenstigerpruefung, Kind,
    solidaritaetszuschlag, gewerbeertrag, gewerbesteuermessbetrag,
    zerlegung_arbeitsloehne, zerlegung_prozent, anrechnung_35a,
    Betriebsstaette, monatliche_ruecklage,
)

JAHR = 2026


# ── Einkommensteuertarif ─────────────────────────────────────────────────────

def test_unter_grundfreibetrag_keine_steuer():
    assert est_tarif_grund(D("12348"), JAHR) == 0
    assert est_tarif_grund(D("5000"), JAHR) == 0


def test_zonengrenze_2_3_stetig():
    # An der Zonengrenze müssen Zone 2 (bei 17.799) und Zone 3 (bei 17.800)
    # nahezu denselben Grenzsteuersatz und einen nahtlosen Steuerbetrag ergeben.
    est_17799 = est_tarif_grund(D("17799"), JAHR)
    est_17800 = est_tarif_grund(D("17800"), JAHR)
    # Differenz für einen einzigen Euro darf nicht mehr als ~1 € betragen
    assert abs(est_17800 - est_17799) <= D("1")


def test_zonengrenze_3_4_stetig():
    est_69878 = est_tarif_grund(D("69878"), JAHR)
    est_69879 = est_tarif_grund(D("69879"), JAHR)
    assert abs(est_69879 - est_69878) <= D("1")


def test_zonengrenze_4_5_stetig():
    est_277825 = est_tarif_grund(D("277825"), JAHR)
    est_277826 = est_tarif_grund(D("277826"), JAHR)
    assert abs(est_277826 - est_277825) <= D("1")


def test_spitzensteuersatz_zone5():
    # Weit oberhalb 277.826 € muss der Grenzsteuersatz 45 % betragen.
    diff_1000 = est_tarif_grund(D("401000"), JAHR) - est_tarif_grund(D("400000"), JAHR)
    assert D("440") <= diff_1000 <= D("460")  # ~0,45 * 1000 = 450


def test_splitting_verdoppelt_grundfreibetrag_wirkung():
    # zvE 24.696 (= 2x Grundfreibetrag) darf bei Splitting keine Steuer auslösen.
    assert est_tarif_splitting(D("24696"), JAHR) == 0
    # Aber einzeln veranlagt bei 24.696 fällt bereits Steuer an, da > 12.348.
    assert est_tarif_grund(D("24696"), JAHR) > 0


def test_splitting_guenstiger_als_einzeln_bei_einseitigem_einkommen():
    # Ein Verdiener mit 80.000 €, Partner 0 € -> Splitting muss günstiger sein
    # als Grundtabelle auf die vollen 80.000 €.
    est_splitting = est_tarif_splitting(D("80000"), JAHR)
    est_grund = est_tarif_grund(D("80000"), JAHR)
    assert est_splitting < est_grund


# ── Kinder ────────────────────────────────────────────────────────────────────

def test_kind_unter_18_anspruchsberechtigt():
    kind = Kind(geburtsdatum=date(2015, 6, 1))
    assert kind_anspruchsberechtigt(kind, JAHR) is True


def test_kind_ueber_18_ohne_ausbildung_kein_anspruch():
    kind = Kind(geburtsdatum=date(2005, 6, 1), in_ausbildung_18_25=False)
    assert kind_anspruchsberechtigt(kind, JAHR) is False


def test_kind_geboren_im_laufe_des_jahres_monatsgenau():
    kind = Kind(geburtsdatum=date(2026, 7, 15))
    assert kindergeld_monate_im_jahr(kind, JAHR) == 6  # Juli–Dezember


def test_kindergeld_jahresbetrag_zwei_kinder():
    kinder = [Kind(geburtsdatum=date(2015, 1, 1)), Kind(geburtsdatum=date(2018, 1, 1))]
    betrag = kindergeld_jahresbetrag(kinder, JAHR)
    assert betrag == D("259") * 12 * 2


def test_guenstigerpruefung_kindergeld_bei_niedrigem_einkommen():
    # Bei kleinem zvE ist die Steuerersparnis durch den Freibetrag kleiner als
    # das Kindergeld -> Kindergeld bleibt (keine Hinzurechnung).
    res = guenstigerpruefung(D("30000"), [Kind(geburtsdatum=date(2015, 1, 1))], JAHR, splitting=True)
    assert res.kinderfreibetrag_guenstiger is False
    assert res.hinzurechnung_kindergeld == 0


def test_guenstigerpruefung_freibetrag_bei_hohem_einkommen():
    # Bei hohem zvE (Spitzensteuersatz) übersteigt die Ersparnis durch den
    # Freibetrag das Kindergeld deutlich -> Freibetrag ist günstiger.
    res = guenstigerpruefung(D("250000"), [Kind(geburtsdatum=date(2015, 1, 1))], JAHR, splitting=True)
    assert res.kinderfreibetrag_guenstiger is True
    # § 31 S. 4 EStG: das VOLLE Kindergeld wird hinzugerechnet, nicht nur die Differenz.
    assert res.hinzurechnung_kindergeld == res.kindergeld_gesamt
    # Trotz Hinzurechnung muss die festzusetzende Steuer unter der Variante ohne
    # Freibetrag liegen — sonst wäre der Freibetrag ja nicht "günstiger".
    assert res.est_festzusetzen < res.est_ohne_kfb
    assert res.est_festzusetzen == res.est_mit_kfb + res.kindergeld_gesamt


def test_guenstigerpruefung_est_festzusetzen_ohne_kfb_wenn_nicht_guenstiger():
    res = guenstigerpruefung(D("30000"), [Kind(geburtsdatum=date(2015, 1, 1))], JAHR, splitting=True)
    assert res.est_festzusetzen == res.est_ohne_kfb


# ── Solidaritätszuschlag ──────────────────────────────────────────────────────

def test_soli_unter_freigrenze_null():
    assert solidaritaetszuschlag(D("40000"), JAHR, splitting=True) == 0


def test_soli_deutlich_ueber_freigrenze_regulaer():
    # Weit oberhalb der Milderungszone muss der volle Satz von 5,5 % greifen.
    est = D("200000")
    soli = solidaritaetszuschlag(est, JAHR, splitting=True)
    assert soli == D("200000") * D("0.055")


def test_soli_in_milderungszone_kleiner_als_regulaer():
    p_freigrenze = D("40700")
    est = p_freigrenze + D("1000")  # knapp in der Milderungszone
    soli = solidaritaetszuschlag(est, JAHR, splitting=True)
    assert 0 < soli < est * D("0.055")


# ── Gewerbesteuer ─────────────────────────────────────────────────────────────

def test_gewerbeertrag_ohne_hinzurechnung_kuerzung():
    assert gewerbeertrag(D("100000"), D("0"), D("0"), JAHR) == D("100000")


def test_gewerbeertrag_hinzurechnung_erst_ueber_freibetrag():
    # 150.000 € Zinsen liegen unter dem 200.000-€-Freibetrag -> keine Hinzurechnung
    assert gewerbeertrag(D("100000"), D("150000"), D("0"), JAHR) == D("100000")
    # 250.000 € -> 50.000 € überschießend, davon 25 % = 12.500 € Hinzurechnung
    assert gewerbeertrag(D("100000"), D("250000"), D("0"), JAHR) == D("112500")


def test_gewerbesteuermessbetrag_beispielrechnung():
    # 100.000 € Gewerbeertrag, Freibetrag 24.500 € -> 75.500 €, davon 3,5 % = 2.642,50 €
    mb = gewerbesteuermessbetrag(D("100000"), JAHR)
    assert mb == D("2642.50")


def test_gewerbesteuermessbetrag_unter_freibetrag_null():
    assert gewerbesteuermessbetrag(D("20000"), JAHR) == 0


def test_zerlegung_arbeitsloehne_mit_unternehmerlohn():
    # Böblingen: 1 Vollzeit 45.000 €, kein Tätigkeitsanteil des Inhabers.
    # Nürtingen: 1 Vollzeit 45.000 € + Minijob 6.000 €, Inhaber zu 100 % dort tätig
    # (Unternehmerlohn 25.000 € fließt vollständig nach Nürtingen).
    betriebsstaetten = [
        Betriebsstaette(gemeinde="Böblingen", hebesatz=D("380"), arbeitsloehne=D("45000"), taetigkeitsanteil_pct=D("0")),
        Betriebsstaette(gemeinde="Nürtingen", hebesatz=D("390"), arbeitsloehne=D("51000"), taetigkeitsanteil_pct=D("100")),
    ]
    messbetrag = D("2642.50")
    ergebnisse = zerlegung_arbeitsloehne(betriebsstaetten, messbetrag, JAHR)

    # Lohnsummen: Böblingen 45.000, Nürtingen 51.000 + 25.000 = 76.000 -> Summe 121.000
    boeb = next(e for e in ergebnisse if e.gemeinde == "Böblingen")
    nuer = next(e for e in ergebnisse if e.gemeinde == "Nürtingen")
    assert boeb.anteil_pct == (D("45000") / D("121000") * D("100"))
    # Messbeträge müssen exakt den Gesamtmessbetrag ergeben (Rest-Zuweisung an letzten Eintrag)
    assert boeb.messbetrag_anteil + nuer.messbetrag_anteil == messbetrag
    # Nürtingen hat den größeren Anteil (Unternehmerlohn + höhere Lohnsumme)
    assert nuer.messbetrag_anteil > boeb.messbetrag_anteil


def test_zerlegung_prozent_manuell():
    betriebsstaetten = [
        Betriebsstaette(gemeinde="Böblingen", hebesatz=D("380"), prozent_manuell=D("33")),
        Betriebsstaette(gemeinde="Nürtingen", hebesatz=D("390"), prozent_manuell=D("67")),
    ]
    messbetrag = D("3000")
    ergebnisse = zerlegung_prozent(betriebsstaetten, messbetrag)
    boeb = next(e for e in ergebnisse if e.gemeinde == "Böblingen")
    nuer = next(e for e in ergebnisse if e.gemeinde == "Nürtingen")
    assert boeb.messbetrag_anteil + nuer.messbetrag_anteil == messbetrag
    assert boeb.gewerbesteuer == boeb.messbetrag_anteil * D("380") / D("100")


def test_anrechnung_35a_gedeckelt_auf_gezahlte_gewst():
    # 4x Messbetrag wäre höher als die tatsächlich gezahlte GewSt -> Deckelung greift.
    result = anrechnung_35a(D("2642.50"), gewerbesteuer_gezahlt_gesamt=D("9000"),
                             tarifliche_est_gewerblicher_anteil=D("50000"), jahr=JAHR)
    assert result == D("9000")


def test_anrechnung_35a_ohne_deckelung():
    result = anrechnung_35a(D("1000"), gewerbesteuer_gezahlt_gesamt=D("9000"),
                             tarifliche_est_gewerblicher_anteil=D("50000"), jahr=JAHR)
    assert result == D("4000")  # 4 * 1000, unter beiden Deckeln


# ── Rücklagen-Empfehlung ─────────────────────────────────────────────────────

def test_monatliche_ruecklage():
    heute = date(2026, 8, 23)
    faelligkeit = date(2027, 2, 23)  # 6 Monate entfernt
    rate = monatliche_ruecklage(D("6000"), heute, faelligkeit)
    assert rate == D("1000")


def test_monatliche_ruecklage_ohne_nachzahlung():
    assert monatliche_ruecklage(D("0"), date(2026, 1, 1), date(2026, 6, 1)) == 0


# ── Rücklagen-Zieldatum ──────────────────────────────────────────────────────

def test_ziel_datum_ruecklage_ist_folgejahresende():
    from backend.services.steuer import _ziel_datum_ruecklage
    ziel = _ziel_datum_ruecklage(date(2026, 8, 23), 2026)
    assert ziel == date(2027, 12, 31)


def test_ziel_datum_ruecklage_springt_weiter_wenn_bereits_ueberschritten():
    from backend.services.steuer import _ziel_datum_ruecklage
    ziel = _ziel_datum_ruecklage(date(2028, 1, 1), 2026)
    assert ziel == date(2028, 12, 31)
