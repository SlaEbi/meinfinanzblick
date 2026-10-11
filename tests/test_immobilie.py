"""Tests für den Immobilienrechner (Kapitalanlage) — Kennzahlen gegen die
Beispielwerte gängiger Online-Rechner, AfA- und Steuerlogik gegen
Handrechnung bzw. die (separat getestete) Einkommensteuer aus steuer.py."""
import pytest

from backend.services.immobilie import (
    ImmobilieEingaben, afa_verlauf, berechne, einkommensteuer_gesamt,
    grenzsteuersatz, irr, steuereffekt,
)


def _basis(**kw) -> ImmobilieEingaben:
    werte = dict(
        kaufpreis=300_000, wohnflaeche=75, eigenkapital=50_000,
        grunderwerbsteuer_pct=6.5, notar_grundbuch_pct=2.0, makler_pct=3.57,
        grundstuecksanteil_pct=25, kaltmiete_monat=1_000,
        verwaltung_monat=60, instandhaltung_monat=80,
        zinssatz_pct=3.5, tilgung_pct=2.0, zinsbindung_jahre=10, anschlusszins_pct=4.0,
        zve=70_000, betrachtung_jahre=15, steuerjahr=2026,
    )
    werte.update(kw)
    return ImmobilieEingaben(**werte)


# ── Kennzahlen ────────────────────────────────────────────────────────────────

def test_bruttomietrendite_und_kaufpreisfaktor_referenz():
    # Referenz (gängiges Ratgeber-Beispiel): 10.000 € Jahreskaltmiete,
    # 250.000 € Kaufpreis -> 4,0 % Bruttomietrendite, Faktor 25
    r = berechne(_basis(kaufpreis=250_000, kaltmiete_monat=10_000 / 12))
    assert r.bruttomietrendite == pytest.approx(0.04)
    assert r.kaufpreisfaktor == 25.0


def test_kaufnebenkosten_und_darlehen():
    # NRW 6,5 % + Notar/Grundbuch 2 % + Makler 3,57 % = 12,07 % von 300.000 €
    r = berechne(_basis())
    assert r.kaufnebenkosten == 36_210.0
    assert r.gesamtinvestition == 336_210.0
    assert r.darlehen == 286_210.0
    assert r.preis_pro_qm == 4_000.0


def test_nettomietrendite_auf_gesamtinvestition():
    # Reinertrag = 12.000 × 98 % − 140 × 12 = 10.080 € auf 336.210 €
    r = berechne(_basis())
    assert r.nettomietrendite == pytest.approx(10_080 / 336_210, abs=1e-6)


def test_rate_aus_zins_und_anfangstilgung():
    # 240.000 € × (4 % + 2 %) / 12 = 1.200 €/Monat
    r = berechne(_basis(kaufpreis=240_000, grunderwerbsteuer_pct=0, notar_grundbuch_pct=0,
                        makler_pct=0, eigenkapital=0, zinssatz_pct=4, tilgung_pct=2))
    assert r.rate_monatlich == 1_200.0


def test_restschuld_nach_zinsbindung_referenz():
    # Referenz (Annuitätenformel / Online-Tilgungsrechner): 100.000 € zu 4 %
    # mit 2 % Anfangstilgung (500 €/Monat) -> nach 10 Jahren ca. 75.459 €
    r = berechne(_basis(kaufpreis=100_000, grunderwerbsteuer_pct=0, notar_grundbuch_pct=0,
                        makler_pct=0, eigenkapital=0, zinssatz_pct=4, tilgung_pct=2))
    assert r.restschuld_zinsbindung == pytest.approx(75_459, abs=1)
    assert r.jahre[9].restschuld == r.restschuld_zinsbindung


def test_zinsbindung_laenger_als_betrachtung_liefert_trotzdem_restschuld_am_bindungsende():
    kurz = berechne(_basis(betrachtung_jahre=5, zinsbindung_jahre=10))
    lang = berechne(_basis(betrachtung_jahre=15, zinsbindung_jahre=10))
    assert kurz.restschuld_zinsbindung == lang.restschuld_zinsbindung
    assert len(kurz.jahre) == 5


def test_anschlusszins_hoeher_bremst_tilgung():
    gleich = berechne(_basis(anschlusszins_pct=3.5))
    hoeher = berechne(_basis(anschlusszins_pct=6.0))
    assert hoeher.jahre[10].zins > gleich.jahre[10].zins
    assert hoeher.jahre[-1].restschuld > gleich.jahre[-1].restschuld


# ── AfA ───────────────────────────────────────────────────────────────────────

def test_afa_linear_auf_gebaeudeanteil_inkl_nebenkosten():
    # (300.000 + 36.210) × 75 % = 252.157,50 € Basis, 2 % = 5.043,15 €
    r = berechne(_basis(afa_satz_pct=2.0))
    assert r.afa_basis == 252_157.5
    assert r.jahre[0].afa == 5_043.15


def test_afa_degressiv_fuenf_prozent_vom_restbuchwert():
    verlauf = afa_verlauf(400_000, 3, 'degressiv', 0.03)
    assert verlauf == pytest.approx([20_000, 19_000, 18_050])


def test_afa_degressiv_wechselt_zur_linearen_wenn_guenstiger():
    # Wechsel, sobald Restwert / Restnutzungsdauer (33⅓ − j) > 5 % vom
    # Restwert, also bei Restnutzung < 20 Jahre -> ab Jahr 15
    verlauf = afa_verlauf(100_000, 40, 'degressiv', 0.03)
    assert verlauf[13] == pytest.approx(verlauf[12] * 0.95)      # Jahr 14 noch degressiv
    assert verlauf[14] > verlauf[13] * 0.95                       # Jahr 15 linear
    assert verlauf[15] == pytest.approx(verlauf[14])              # danach konstant
    assert sum(verlauf) == pytest.approx(100_000)                 # voll abgeschrieben


def test_afa_linear_endet_bei_vollabschreibung():
    verlauf = afa_verlauf(10_000, 40, 'linear', 0.03)
    assert sum(verlauf) == pytest.approx(10_000)
    assert verlauf[-1] == 0


# ── 15-%-Grenze (anschaffungsnahe Herstellungskosten) ────────────────────────

def test_renovierung_unter_15_prozent_sofort_absetzbar():
    r = berechne(_basis(renovierung=20_000))
    assert r.jahre[0].erhaltungsaufwand == 20_000
    assert r.jahre[1].erhaltungsaufwand == 0
    assert r.afa_basis == 252_157.5
    assert not any(w.code == 'anschaffungsnah' for w in r.warnungen)


def test_renovierung_ueber_15_prozent_wird_aktiviert():
    # 15 % von 252.157,50 € = 37.823,63 € netto; 50.000 € brutto = 42.016,81 € netto
    r = berechne(_basis(renovierung=50_000))
    assert r.jahre[0].erhaltungsaufwand == 0
    assert r.afa_basis == 302_157.5
    assert any(w.code == 'anschaffungsnah' for w in r.warnungen)


def test_renovierung_wird_aus_eigenkapital_mitfinanziert():
    ohne = berechne(_basis())
    mit = berechne(_basis(renovierung=20_000))
    assert mit.darlehen == ohne.darlehen + 20_000


# ── Steuer ────────────────────────────────────────────────────────────────────

def test_steuereffekt_entspricht_tarifdifferenz():
    effekt = steuereffekt(70_000, -5_000, 2026, False)
    erwartet = einkommensteuer_gesamt(70_000, 2026, False) - einkommensteuer_gesamt(65_000, 2026, False)
    assert effekt == pytest.approx(erwartet)
    assert effekt > 0                       # Verlust -> Erstattung
    assert steuereffekt(70_000, 5_000, 2026, False) < 0   # Überschuss -> Mehrsteuer


def test_grenzsteuersatz_spitzensteuer_bereich():
    # 70.000 € zvE (Grundtarif 2026) liegt in der 42-%-Zone, Soli greift dort
    # noch nicht (Freigrenze)
    assert grenzsteuersatz(70_000, 2026, False) == pytest.approx(0.42)
    # Splitting halbiert die Progression -> deutlich niedriger
    assert grenzsteuersatz(70_000, 2026, True) < 0.35


def test_kirchensteuer_erhoeht_steuereffekt():
    ohne = steuereffekt(70_000, -5_000, 2026, False, 0)
    mit = steuereffekt(70_000, -5_000, 2026, False, 9)
    assert mit > ohne


def test_cashflow_identitaeten():
    r = berechne(_basis())
    for j in r.jahre:
        assert j.cashflow_vor_steuern == pytest.approx(j.miete - j.kosten - j.zins - j.tilgung, abs=0.02)
        assert j.cashflow_nach_steuern == pytest.approx(j.cashflow_vor_steuern + j.steuereffekt, abs=0.02)
        assert j.steuerliches_ergebnis == pytest.approx(
            j.miete - j.kosten - j.zins - j.afa - j.erhaltungsaufwand, abs=0.02)
        assert j.nettovermoegen == pytest.approx(j.marktwert - j.restschuld, abs=0.02)


def test_ohne_einkommen_kein_steuereffekt_bei_verlust():
    # zvE 0 und Verlust aus V+V -> keine Steuer, die sinken könnte
    r = berechne(_basis(zve=0))
    assert r.jahre[0].steuereffekt == 0


# ── Exit / Spekulationsfrist / IRR ───────────────────────────────────────────

def test_spekulationssteuer_nur_vor_zehn_jahren():
    kurz = berechne(_basis(betrachtung_jahre=5, wertsteigerung_pct=4))
    lang = berechne(_basis(betrachtung_jahre=10, wertsteigerung_pct=4))
    assert kurz.spekulationssteuer > 0
    assert lang.spekulationssteuer == 0
    assert any(w.code == 'spekulationsfrist' for w in kurz.warnungen)


def test_verkaufserloes_und_vermoegenszuwachs():
    r = berechne(_basis())
    letzter = r.jahre[-1]
    assert r.verkaufspreis == letzter.marktwert
    assert r.verkaufserloes_netto == pytest.approx(letzter.marktwert - letzter.restschuld, abs=0.01)
    summe_cf = sum(j.cashflow_nach_steuern for j in r.jahre)
    assert r.vermoegenszuwachs == pytest.approx(r.verkaufserloes_netto + summe_cf - 50_000, abs=0.05)


def test_irr_referenzwerte():
    assert irr([-100, 110]) == pytest.approx(0.10, abs=1e-6)
    assert irr([-100, 0, 121]) == pytest.approx(0.10, abs=1e-6)
    assert irr([-100, -10]) is None


def test_irr_ohne_eigenkapital_nicht_definiert():
    r = berechne(_basis(eigenkapital=0))
    assert r.irr is None
    assert r.eigenkapitalrendite is None


# ── Warnungen ─────────────────────────────────────────────────────────────────

def test_warnung_negativer_cashflow_und_hoher_faktor():
    r = berechne(_basis(kaltmiete_monat=800))   # Faktor 31,25
    codes = {w.code for w in r.warnungen}
    assert 'cashflow_negativ' in codes
    assert 'kaufpreisfaktor_hoch' in codes


def test_keine_cashflow_warnung_bei_gutem_objekt():
    r = berechne(_basis(kaufpreis=150_000, kaltmiete_monat=1_100, eigenkapital=40_000))
    codes = {w.code for w in r.warnungen}
    assert 'cashflow_negativ' not in codes
    assert 'kaufpreisfaktor_hoch' not in codes
    assert r.cashflow_nach_steuern_monat > 0


def test_warnung_anschlussrate_deckt_zinsen_nicht():
    r = berechne(_basis(zinssatz_pct=1.0, tilgung_pct=1.0, anschlusszins_pct=8.0))
    assert any(w.code == 'anschluss_rate_zu_niedrig' and w.stufe == 'urgent' for w in r.warnungen)
