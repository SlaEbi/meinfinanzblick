---
name: immobilie
description: Wertet ein Immobilien-Inserat (Link zu ImmoScout24, Kleinanzeigen o. ä.) als Kapitalanlage aus und legt es als Objekt im Immobilienrechner von MeinFinanzblick an. Verwenden, wenn der Nutzer /immobilie mit einem Link aufruft oder einen Inserat-Link zur Auswertung schickt.
argument-hint: <Inserat-Link>
---

# /immobilie — Inserat auswerten und in der App anlegen

Link: $ARGUMENTS

Ziel: Daten aus dem Inserat übernehmen, fehlende Werte als Annahme kennzeichnen, das Objekt über `scripts/immobilie_anlegen.py` im Immobilienrechner speichern und die Kennzahlen knapp berichten. Planungsrechnung, **keine Kaufempfehlung und keine Anlageberatung**: Zahlen und gängige Richtwerte nennen, die Entscheidung bleibt beim Nutzer.

## 1. Inserat lesen

1. Kein Link übergeben → nach dem Link fragen und stoppen.
2. Tracking-Parameter entfernen (alles ab `?` bzw. `#`), z. B. `https://www.immobilienscout24.de/expose/171436282`.
3. Im eingebauten Browser öffnen (`preview_start` mit `url`) und mit `get_page_text` lesen. **Nicht** per curl/WebFetch abrufen: ImmoScout24 blockt Server-Abrufe (401, Roboter-Sperre).
4. Zeigt die Seite ein Captcha oder eine Sperre: nichts davon lösen. Dem Nutzer sagen, er soll die Seite im Browser-Fenster selbst freischalten oder den Exposé-Text hier einfügen.

## 2. Werte übernehmen

Auch den Beschreibungstext lesen, dort stehen oft Ist-Miete, Stellplatzmiete oder das Hausgeld.

| Feld (`eingaben`) | Quelle im Inserat | Hinweise |
|---|---|---|
| `kaufpreis` | Kaufpreis | Stellplatz/Garage mit eigenem Preis dazurechnen, wenn seine Miete in der Kaltmiete steckt; im Bericht erwähnen |
| `wohnflaeche` | Wohnfläche | |
| `bundesland`, `grunderwerbsteuer_pct` | Ort/PLZ, Brotkrumen („Wohnung kaufen Baden-Württemberg“) | Satz aus der Tabelle unten |
| `makler_pct` | Provision für Käufer | provisionsfrei → 0 |
| `afa_modus`, `afa_satz_pct` | Baujahr | vor 1925: 2,5 %; 1925–2022: 2 %; ab 2023 fertiggestellt: 3 %; Neubau mit Baubeginn 10/2023–9/2029: `degressiv` |
| `kaltmiete_monat` | Ist-Miete bzw. „Mieteinnahmen“, sonst Text | **Leerstehend und keine Miete angegeben → beim Nutzer nachfragen, nicht schätzen** |
| `verwaltung_monat` | nicht umlagefähiges Hausgeld ohne Rücklage | |
| `instandhaltung_monat` | Instandhaltungsrücklage im Hausgeld | |
| `renovierung` | nur wenn das Inserat einen konkreten Sanierungsbedarf beziffert | |

Grunderwerbsteuer 2026: BY 3,5 · BW, NI, RP, ST, TH 5,0 · HB, HH, SN 5,5 · BE, HE, MV 6,0 · BB, NW, SL, SH 6,5 (%).

## 3. Annahmen für fehlende Werte

Jede Annahme im Bericht als Annahme kennzeichnen.

- **Hausgeld fehlt:** Verwaltung 30 €/Monat (bei 2–3 Einheiten eher 25 €), Instandhaltung 1 €/m² Wohnfläche im Monat (Baujahr vor 1990: 1,30 €/m²).
- **Nur Hausgeld gesamt angegeben:** etwa ein Drittel ist nicht umlagefähig; die ausgewiesene Rücklage zählt zur Instandhaltung, der Rest zur Verwaltung.
- `notar_grundbuch_pct` 2,0 · `grundstuecksanteil_pct` 25 (Großstadt-Innenlage 35) · `mietausfall_pct` 2 · `mietsteigerung_pct` 1,5 · `kostensteigerung_pct` 2 · `wertsteigerung_pct` 1,5 · `betrachtung_jahre` 10 (Verkauf direkt nach Ablauf der Spekulationsfrist, also steuerfrei)
- **Finanzierung:** `eigenkapital` = Kaufnebenkosten exakt, auf volle Euro aufgerundet: `kaufpreis × (grunderwerbsteuer_pct + notar_grundbuch_pct + makler_pct) / 100`. Der Kaufpreis wird also voll finanziert, die Renovierung auch · `zinssatz_pct` 3,5 · `tilgung_pct` 2 · `zinsbindung_jahre` 10 · `anschlusszins_pct` 4 · `sondertilgung_jahr` 0
- **Steuer:** `zve` 140000 · `splitting` true · `kirchensteuer_pct` 0 (Vorgabe des Nutzers)

Nennt der Nutzer im Aufruf oder im Gespräch eigene Werte (Eigenkapital, Zins, Einkommen …), gehen diese vor.

## 4. Objekt anlegen

Name: `<Typ> <Ort> <Zimmer> Zi.` plus Besonderheit und Scout-ID, z. B. `ETW Neuffen 3 Zi. + Stellplatz (IS24 171436282)`, höchstens 80 Zeichen.

JSON ins Scratchpad schreiben und anlegen:

```json
{"name": "...", "eingaben": {"kaufpreis": 330000, "bundesland": "BW", "grunderwerbsteuer_pct": 5.0, "...": "..."}}
```

```bash
.venv/bin/python scripts/immobilie_anlegen.py <pfad/objekt.json>
```

Das Skript läuft über die echte API (Validierung und Rechnung wie im Browser) und gibt Kennzahlen, Jahr 1 und Warnungen als JSON aus. Mit `--nur-rechnen` wird nichts gespeichert, z. B. um vorab zwei Varianten zu vergleichen. Speichert der Nutzer eine Variante nicht ausdrücklich, nur die Hauptvariante anlegen.

## 5. Bericht

Kurz halten:

1. Eine Zeile: angelegt als „<Name>“ unter Rechner → Immobilienrechner → Gespeicherte Objekte.
2. **Aus dem Inserat** (Stichpunkte) und **Annahmen, bitte prüfen** (Stichpunkte, Unsicherstes zuerst, meist das Hausgeld).
3. Tabelle: Bruttomietrendite / Faktor, Nettomietrendite, Cashflow pro Monat vor und nach Steuern, Eigenkapitalrendite im 1. Jahr, Rendite p. a. auf das Eigenkapital (IRR) über die Haltedauer, Vermögenszuwachs.
4. Die Warnungen der App in einem Satz.
5. Einordnung gegen gängige Richtwerte (Faktor unter 20–25, Bruttomietrendite 4–6 %, Cashflow nach Steuern ≥ 0): welcher Wert am stärksten wirkt, z. B. „Mit 20.000 € mehr Eigenkapital wäre der Cashflow …“ (bei Bedarf mit `--nur-rechnen` gegenrechnen). Keine Kauf- oder Verkaufsempfehlung.
