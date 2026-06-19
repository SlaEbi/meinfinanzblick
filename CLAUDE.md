# CLAUDE.md — MeinFinanzblick

Dieses Dokument gibt Claude Code den vollständigen Kontext für dieses Projekt. **Vor jeder Arbeit lesen.** Ergänzend gelten: `Bauplan_MeinFinanzblick.md` (Vision, Marktanalyse, Roadmap) und `design.md` (verbindliches Design-System).

---

## 1. Was wir bauen

Ein **privates, lokales Finanz- & Notfall-Dashboard** für eine Privatperson (+ Ehefrau als Notfall-Zugriff). Vier Säulen:

1. **Finanzüberblick** — Konten, Depots, Darlehen, Gesamtvermögen (netto)
2. **Finanzplanung** — Tilgungspläne, Szenarien, Vermögens-Prognose, Net-Worth-Verlauf
3. **Notfall-/Nachlass-Übersicht** — „Wo liegt was", Anleitung für die Ehefrau, Kontakte
4. **Versicherungen & Verträge** — Policen, Laufzeiten, Kündigungsfristen, Fristen-Warnungen

**Leitprinzip:** Manuelle Eingabe — einmal im Monat, strukturiert, übersichtlich. Keine Bankanbindung. Jede Phase endet mit etwas Benutzbarem.

---

## 2. Architektur & Tech-Stack

| Schicht | Wahl | Begründung |
|---|---|---|
| Backend | **Python + FastAPI** | Finanzmathematik trivial, solide Basis |
| Datenbank | **SQLite** (eine Datei) | kein Server, leicht zu sichern, später via SQLCipher verschlüsselbar |
| Frontend | **HTML + Chart.js** zum Start, später optional React | schnelle Ergebnisse, geringe Komplexität |
| Betrieb | **localhost**, Start per Skript | keine Cloud, Daten bleiben auf dem Rechner |

**Harte Grundsätze:**
- **Lokal only.** Keine Daten verlassen den Rechner. Keine externen Cloud-Calls mit Finanzdaten.
- **Datenhoheit.** SQLite-Datei + verschlüsseltes Backup (z. B. USB im Safe).
- **Sicherheit ab Phase 0:** lokaler Login (Master-Passwort), sensible Felder verschlüsselbar.

### Vorgeschlagene Ordnerstruktur
```
MeinFinanzblick/
├── CLAUDE.md                  # dieses Dokument
├── Bauplan_MeinFinanzblick.md # Vision, Markt, Roadmap
├── design.md                  # Design-System (verbindlich)
├── backend/
│   ├── main.py                # FastAPI-App
│   ├── models.py              # SQLAlchemy-Modelle
│   ├── db.py                  # DB-Verbindung/Session
│   ├── routers/               # konten, darlehen, depots, versicherungen, notfall, planung
│   └── services/              # tilgung.py, networth.py
├── frontend/
│   ├── index.html
│   ├── css/tokens.css         # Design-Tokens aus design.md
│   ├── css/app.css
│   └── js/                    # dashboard.js, charts.js, ...
├── data/
│   └── finanzblick.db         # SQLite (NICHT committen)
├── scripts/start.sh           # Doppelklick-Start
├── requirements.txt
└── .gitignore
```

---

## 3. Design-System — VERBINDLICH

Das gesamte Frontend folgt **`design.md` ("Sumi-e Tech Scroll")**. Nicht abweichen. Kurzfassung:

- **Farben (als CSS-Variablen in `tokens.css`):**
  `--rice-paper:#F4F1E8` (Flächen) · `--ink-black:#0D0D0D` (Text) · `--seal-red:#8A1C15` (Akzent/CTA) · `--wash-grey:#808080` (sekundär/Rahmen) · `--ink-wash:rgba(0,0,0,0.1)`
- **Typografie:** `Noto Serif JP` (Überschriften + Body), **`JetBrains Mono` für ALLE Finanzwerte/Zahlen/Metadaten** (Salden, Zinsen, Restschuld, Fristen).
- **Optik:** Reispapier-Textur als Hintergrund, dezente Tuschwasch-Elemente, **rote Siegel-/Stempel-Akzente** (ideal für Warnungen/Fristen), Pinselstrich-Rahmen.
- **Komponenten:** Cards 0.5rem gerundet, Schatten `0 2px 12px rgba(0,0,0,0.06)`, 1px Rahmen. Primär-Button rot, Hover 8 % dunkler + Lift. Inputs: Label oben, Fokusring 2px Akzent.
- **Layout:** CSS Grid, max 1280px zentriert, **asymmetrische Grids** (kein 3-Spalten-Gleichraster), Abschnittsabstände `clamp(4rem,8vw,8rem)`, mobil < 768px kollabieren, `min-h-[100dvh]` statt `h-screen`.
- **Motion:** Ease-out 200–300ms, Eintritt Fade + translate-Y (16px→0), nur `transform`/`opacity`.

**Verboten:** Emojis in der UI (nur **Lucide**-Icons) · reines Schwarz `#000000` · übersättigte Akzente (>80 %) · 3-gleiche-Spalten-Feature-Layout · `h-screen` · kaputte Bildlinks (nutze inline-SVG/picsum.photos) · Lorem Ipsum · Floskeln („Elevate/Seamless/Unleash/Next-Gen").

---

## 4. Datenmodell (Start-Schema)

Kern-Entitäten (Felder erweiterbar):

- **Konto** — name, bank, typ (giro/tagesgeld/…), iban, saldo, waehrung, aktualisiert_am
- **Depot** — name, bank, depotnummer, wert_aktuell, aktualisiert_am; **Position** (depot_id, isin, name, anzahl, kurs, wert)
- **Darlehen** — bezeichnung, glaeubiger, urspr_betrag, restschuld, zinssatz, rate_monatlich, zinsbindung_bis, restlaufzeit, sondertilgung_moeglich
- **Versicherung** — art, anbieter, vertragsnummer, beitrag, zahlweise, laufzeit_bis, kuendigungsfrist_tage, kontakt, police_pfad
- **Vertrag** — art (strom/internet/…), anbieter, vertragsnummer, kosten, laufzeit_bis, kuendigungsfrist_tage
- **Kontakt** — name, rolle (bank/versicherung/steuerberater/anwalt/notar), telefon, email, notiz
- **NotfallEintrag** — titel, kategorie, **verweis** (wo liegt es: Passwort-Manager/Safe/…), hinweis — *KEINE Klartext-Passwörter, siehe §5*
- **NetWorthSnapshot** — datum, summe_vermoegen, summe_schulden, netto (monatlich automatisch)

---

## 5. Sicherheit & der Passwort-Teil

**Entscheidung: Option A (Best Practice).** Das Tool ist eine **Landkarte**, kein Passwort-Tresor. NotfallEintrag speichert nur **Verweise** („liegt im Passwort-Manager X / Safe im Arbeitszimmer"), niemals Klartext-Passwörter. Die echten Geheimnisse bleiben im Passwort-Manager (Bitwarden/1Password/KeePass) mit **Notfallzugang für die Ehefrau**.

Option B (Passwörter verschlüsselt im Tool) ist bewusst zurückgestellt — nur später, optional, mit ordentlicher Krypto (AES-256, Master-PW, kein Klartext-Backup).

Grundschutz immer: lokaler Login, SQLite verschlüsselbar (SQLCipher), regelmäßiges verschlüsseltes Backup, keine Klartext-Exporte.

**Für Claude Code:** Niemals Secrets/Zugangsdaten/PINs in Code, Logs oder die DB im Klartext schreiben.

---

## 6. Roadmap — Phasen

Aktueller Stand: **Planung abgeschlossen, Phase 0 noch nicht begonnen.**

- **Phase 0 — Fundament:** Gerüst (FastAPI+SQLite+HTML), **Design-Tokens aus design.md**, Datenmodell, leeres Dashboard im finalen Look.
- **Phase 1 — Manueller Finanzüberblick:** Eingabemasken Konten/Darlehen/Depots, Dashboard mit Gesamtvermögen + Listen + erste Charts. *(Sofort nutzbar.)*
- **Phase 2 — Finanzplanung:** Tilgungsplan (Annuität), Szenario-Rechner, Vermögens-Prognose, Net-Worth-Verlauf.
- **Phase 3 — Versicherungen & Verträge:** Erfassung + Fristen-Dashboard mit Warnungen + Kontakte.
- **Phase 4 — Notfall-/Nachlass-Modul:** „Wo liegt was", druckbare Ernstfall-Anleitung (PDF) für die Ehefrau, Dokumenten-Checkliste. *(Hoch priorisieren — schützt die Familie.)*
- **Phase 5 — Feinschliff:** Verschlüsselung/Backup härten, PDF-Reports, Budget-Analyse.

**Empfohlener nächster Schritt:** Phase 0 + 1 zusammen umsetzen.

---

## 7. Konventionen für Claude Code

- **Sprache:** UI und Nutzertexte auf **Deutsch**. Code-Kommentare/Variablen Englisch ok.
- **Klein liefern:** ein klar umrissener Schritt pro Aufgabe, jede Phase endet lauffähig und testbar.
- **Design zuerst prüfen:** Bevor du UI baust, `design.md` + §3 hier abgleichen. Werte immer in `JetBrains Mono`.
- **Finanzmathematik testen:** Tilgungs-/Prognoserechnungen mit Unit-Tests gegen bekannte Werte verifizieren (z. B. Annuität gegen einen Online-Rechner).
- **Geld korrekt rechnen:** Beträge als `Decimal` (nicht float) bzw. in Cent als Integer; Rundung explizit.
- **Keine Secrets** in Repo/Logs/DB-Klartext. `data/`, `*.db`, `.env`, Backups in `.gitignore`.
- **Abhängigkeiten schlank halten:** nur was nötig ist; `requirements.txt` pflegen.

---

## 8. Setup & Befehle (Zielzustand)

```bash
# einrichten
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt          # fastapi, uvicorn, sqlalchemy, pydantic

# starten (Backend serviert auch das Frontend)
uvicorn backend.main:app --reload --port 8000
# Dashboard: http://localhost:8000

# Tests
pytest

# Backup (Beispiel)
cp data/finanzblick.db backups/finanzblick_$(date +%F).db
```
*(requirements.txt / scripts werden in Phase 0 angelegt — diese Befehle sind das Ziel.)*

---

## 9. Offene Entscheidungen

- Ehefrau: eigener Login zum Mitnutzen, oder nur Ernstfall-Zugriff?
- Mobiler Zugriff nötig oder reicht Desktop?

---

## 10. Erste Aufgabe für Claude Code

> „Setze Phase 0 + 1 um: FastAPI-Backend mit SQLite, Datenmodell aus §4, Design-Tokens aus `design.md`/§3, und ein Dashboard mit manuellen Eingabemasken für Konten, Darlehen und Depots sowie Gesamtvermögen + erste Charts. Komplett im Sumi-e-Tech-Scroll-Look, Werte in JetBrains Mono."
