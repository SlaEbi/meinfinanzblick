"""Steuerparameter je Veranlagungsjahr — zentrale, editierbare Quelle.

Werte für 2026 online recherchiert und gegen §32a EStG (gesetze-im-internet.de)
sowie §31 GewStG geprüft (Stetigkeit der Grenzsteuersätze an den Zonengrenzen
verifiziert). Vor der Steuererklärung gegen den aktuellen Bescheid/die
amtlichen Verlautbarungen prüfen — dies ist eine Planungsrechnung, keine
Steuerberatung.

Neues Jahr ergänzen: einfach einen neuen Eintrag in TARIFE anlegen.
"""
from decimal import Decimal as D

TARIFE = {
    2026: {
        # ── Einkommensteuertarif §32a EStG ──────────────────────────────────
        "grundfreibetrag": D("12348"),
        # Zone 2: 12.349–17.799 €  → (a·y + b)·y,  y = (zvE − grundfreibetrag) / 10000
        "zone2_bis": D("17799"),
        "zone2_a": D("914.51"),
        "zone2_b": D("1400"),
        # Zone 3: 17.800–69.878 €  → (a·z + b)·z + c,  z = (zvE − zone2_bis) / 10000
        "zone3_bis": D("69878"),
        "zone3_a": D("173.10"),
        "zone3_b": D("2397"),
        "zone3_c": D("1034.87"),
        # Zone 4: 69.879–277.825 €  → 0,42·x − d
        "zone4_bis": D("277825"),
        "zone4_satz": D("0.42"),
        "zone4_abzug": D("11135.63"),
        # Zone 5: ab 277.826 €  → 0,45·x − e
        "zone5_satz": D("0.45"),
        "zone5_abzug": D("19470.38"),

        # ── Kinder ───────────────────────────────────────────────────────────
        "kinderfreibetrag_je_elternteil": D("3414"),   # Existenzminimum, § 32 Abs. 6 EStG
        "bea_freibetrag_je_elternteil": D("1464"),     # Betreuung/Erziehung/Ausbildung
        "kindergeld_monatlich": D("259"),

        # ── Solidaritätszuschlag ────────────────────────────────────────────
        "soli_satz": D("0.055"),
        "soli_freigrenze_single": D("20350"),
        "soli_freigrenze_splitting": D("40700"),
        "soli_milderungszone_faktor": D("0.119"),  # 11,9 % des die Freigrenze übersteigenden Betrags

        # ── Kirchensteuer (Baden-Württemberg) ───────────────────────────────
        "kirchensteuer_satz": D("0.08"),

        # ── Gewerbesteuer ───────────────────────────────────────────────────
        "gewst_freibetrag": D("24500"),          # § 11 Abs. 1 GewStG (Einzelunternehmen/Personengesellschaft)
        "gewst_messzahl": D("0.035"),             # § 11 Abs. 2 GewStG
        "gewst_hinzurechnung_freibetrag": D("200000"),  # § 8 Nr. 1 GewStG
        "gewst_hinzurechnung_satz": D("0.25"),
        "gewst_anrechnung_faktor": D("4.0"),      # § 35 Abs. 1 EStG (das 4-fache des Messbetrags)
        "gewst_unternehmerlohn_fiktiv": D("25000"),  # § 31 Abs. 5 GewStG, Einzelunternehmer
        "gewst_lohn_kappung_je_an": D("50000"),      # § 31 Abs. 4 GewStG

        # ── Sonstiges (Vorsorgeaufwendungen, Sonderausgaben) ────────────────
        "arbeitnehmer_pauschbetrag": D("1230"),  # Stand Aug. 2026 bestätigt; eine Anhebung auf 1.430 € wurde angekündigt, aber noch nicht beschlossen
        "basisrente_hoechstbetrag_single": D("30826"),   # 2026: 124.800 € · 24,7 %
        "uebrige_vorsorge_hoechstbetrag_selbststaendig": D("2800"),  # § 10 Abs. 4 EStG
        "uebrige_vorsorge_hoechstbetrag_angestellt": D("1900"),
        "sonderausgaben_pauschbetrag_single": D("36"),
        "sonderausgaben_pauschbetrag_splitting": D("72"),

        # ── Gewerbesteuer-Hebesätze — Defaults, im Formular überschreibbar ──
        "hebesatz_defaults": {
            "Nürtingen": D("390"),
            "Böblingen": D("380"),
        },
    },
}


def parameter(jahr: int) -> dict:
    """Parametersatz für ein Jahr — fällt auf das jüngste bekannte Jahr zurück."""
    if jahr in TARIFE:
        return TARIFE[jahr]
    neuestes = max(TARIFE)
    return TARIFE[neuestes]
