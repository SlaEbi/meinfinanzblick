"""Steuerparameter je Veranlagungsjahr — zentrale, editierbare Quelle.

2024–2026 online recherchiert und mathematisch gegengeprüft: die
Zonen-Koeffizienten der Einkommensteuer sind so konstruiert, dass der
Grenzsteuersatz an jeder Zonengrenze stetig ist (z. B. 23,97 % am Übergang
Zone 2 → Zone 3, 42 % am Übergang Zone 3 → Zone 4) — das wurde für jedes Jahr
einzeln nachgerechnet, bevor die Werte hier eingetragen wurden. Für 2024 galt
zunächst ein Grundfreibetrag von 11.604 €, der im Dezember 2024 rückwirkend
für das ganze Jahr auf 11.784 € angehoben wurde ("Gesetz zur steuerlichen
Freistellung des Existenzminimums 2024") — hier ist die korrigierte
(rückwirkend gültige) Fassung mit dem dafür neu berechneten Zone-2-Koeffizienten
hinterlegt, nicht die ursprüngliche.

Vor der Steuererklärung trotzdem gegen den aktuellen Bescheid/die amtlichen
Verlautbarungen prüfen — dies ist eine Planungsrechnung, keine Steuerberatung.

Neues Jahr ergänzen: einfach einen neuen Eintrag in TARIFE anlegen.
"""
from decimal import Decimal as D

# Werte, die im Gewerbesteuergesetz als feste Beträge (nicht jährlich
# inflationsindexiert) verankert sind — über alle Jahre identisch.
_GEWST_STABIL = {
    "gewst_freibetrag": D("24500"),          # § 11 Abs. 1 GewStG (Einzelunternehmen/Personengesellschaft)
    "gewst_messzahl": D("0.035"),             # § 11 Abs. 2 GewStG
    "gewst_hinzurechnung_freibetrag": D("200000"),  # § 8 Nr. 1 GewStG
    "gewst_hinzurechnung_satz": D("0.25"),
    "gewst_anrechnung_faktor": D("4.0"),      # § 35 Abs. 1 EStG (das 4-fache des Messbetrags)
    "gewst_unternehmerlohn_fiktiv": D("25000"),  # § 31 Abs. 5 GewStG, Einzelunternehmer
    "gewst_lohn_kappung_je_an": D("50000"),      # § 31 Abs. 4 GewStG
    "kirchensteuer_satz": D("0.08"),          # Baden-Württemberg
    "soli_milderungszone_faktor": D("0.119"), # § 4 SolzG, seit der 2021er-Reform unverändert
    "uebrige_vorsorge_hoechstbetrag_selbststaendig": D("2800"),  # § 10 Abs. 4 EStG, nicht indexiert
    "uebrige_vorsorge_hoechstbetrag_angestellt": D("1900"),
    "sonderausgaben_pauschbetrag_single": D("36"),
    "sonderausgaben_pauschbetrag_splitting": D("72"),
    # Hebesätze sind Gemeindebeschlüsse und ändern sich; hier lassen sich
    # bekannte Sätze als Startwert für Prognosen hinterlegen (Gemeindename ->
    # Hebesatz), im Formular je Prognose frei überschreibbar. Für
    # zurückliegende Jahre nicht blind übernehmen, da sich Hebesätze über die
    # Zeit ändern. Leer, bis eigene Gemeinden eingetragen werden.
    "hebesatz_defaults": {},
}

TARIFE = {
    2024: {
        **_GEWST_STABIL,
        # ── Einkommensteuertarif §32a EStG — rückwirkend korrigierte Fassung ─
        "grundfreibetrag": D("11784"),
        "zone2_bis": D("17005"),
        "zone2_a": D("954.80"),   # neu berechnet für die rückwirkende Anhebung des Grundfreibetrags
        "zone2_b": D("1400"),
        "zone3_bis": D("66760"),
        "zone3_a": D("181.19"),
        "zone3_b": D("2397"),
        # zone3_c/zone4_abzug/zone5_abzug: Die veröffentlichten Werte (1.025,38 /
        # 10.602,13 / 18.936,88) gehörten zur Fassung VOR der rückwirkenden
        # Korrektur des Grundfreibetrags (11.604 € statt 11.784 €) und ergäben
        # zusammen mit dem korrigierten Zone-2-Koeffizienten (oben) einen Sprung
        # von ca. 34 € an der Zonengrenze 17.005. Die Werte hier sind stattdessen
        # von Zone 2 aus durchgehend für Stetigkeit neu berechnet (keine amtliche
        # Quelle für die korrigierte Fassung gefunden — mathematisch aber
        # eindeutig bestimmt, siehe test_alle_jahre_zonengrenzen_stetig).
        "zone3_c": D("991.21"),
        "zone4_bis": D("277825"),
        "zone4_satz": D("0.42"),
        "zone4_abzug": D("10636.67"),
        "zone5_satz": D("0.45"),
        "zone5_abzug": D("18971.87"),
        # ── Kinder ───────────────────────────────────────────────────────────
        "kinderfreibetrag_je_elternteil": D("3306"),
        "bea_freibetrag_je_elternteil": D("1464"),
        "kindergeld_monatlich": D("250"),
        # ── Solidaritätszuschlag ────────────────────────────────────────────
        "soli_satz": D("0.055"),
        "soli_freigrenze_single": D("18130"),
        "soli_freigrenze_splitting": D("36260"),
        # ── Sonstiges ────────────────────────────────────────────────────────
        "arbeitnehmer_pauschbetrag": D("1230"),
        "basisrente_hoechstbetrag_single": D("27566"),
    },
    2025: {
        **_GEWST_STABIL,
        # ── Einkommensteuertarif §32a EStG ──────────────────────────────────
        "grundfreibetrag": D("12096"),
        "zone2_bis": D("17443"),
        "zone2_a": D("932.30"),
        "zone2_b": D("1400"),
        "zone3_bis": D("68480"),
        "zone3_a": D("176.64"),
        "zone3_b": D("2397"),
        "zone3_c": D("1015.13"),
        "zone4_bis": D("277825"),
        "zone4_satz": D("0.42"),
        "zone4_abzug": D("10911.92"),
        "zone5_satz": D("0.45"),
        "zone5_abzug": D("19246.67"),
        # ── Kinder ───────────────────────────────────────────────────────────
        "kinderfreibetrag_je_elternteil": D("3336"),
        "bea_freibetrag_je_elternteil": D("1464"),
        "kindergeld_monatlich": D("255"),
        # ── Solidaritätszuschlag ────────────────────────────────────────────
        "soli_satz": D("0.055"),
        "soli_freigrenze_single": D("19950"),
        "soli_freigrenze_splitting": D("39900"),
        # ── Sonstiges ────────────────────────────────────────────────────────
        "arbeitnehmer_pauschbetrag": D("1230"),
        "basisrente_hoechstbetrag_single": D("29344"),
    },
    2026: {
        **_GEWST_STABIL,
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
        # ── Sonstiges ────────────────────────────────────────────────────────
        "arbeitnehmer_pauschbetrag": D("1230"),  # Stand Aug. 2026 bestätigt; eine Anhebung auf 1.430 € wurde angekündigt, aber noch nicht beschlossen
        "basisrente_hoechstbetrag_single": D("30826"),   # 2026: 124.800 € · 24,7 %
    },
}


def ist_naeherung(jahr: int) -> bool:
    """True, wenn für dieses Jahr noch kein eigener (recherchierter) Tarif
    hinterlegt ist und stattdessen der jüngste bekannte Tarif als Näherung
    verwendet wird — z. B. für ein kommendes Jahr, dessen Tarif noch nicht
    endgültig beschlossen ist."""
    return jahr not in TARIFE


def parameter(jahr: int) -> dict:
    """Parametersatz für ein Jahr — fällt auf das jüngste bekannte Jahr zurück."""
    if jahr in TARIFE:
        return TARIFE[jahr]
    neuestes = max(TARIFE)
    return TARIFE[neuestes]
