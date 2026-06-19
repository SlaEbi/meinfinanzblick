# MeinFinanzblick — Bauplan für ein persönliches Finanz- & Notfall-Dashboard

*Erstellt am 19.06.2026 · Grundlage: Marktanalyse + deine Vorgaben (lokale Web-App, automatische Bankanbindung, Passwort-Optionen abgewogen)*

---

## 1. Worum geht es

Du willst **ein zentrales, privates Dashboard**, das vier Dinge zusammenbringt, die heute über Apps, Ordner und Köpfe verstreut sind:

1. **Finanzüberblick** — Darlehen, Kontostände, Depots und Konten auf einen Blick
2. **Finanzplanung** — Vermögensentwicklung, Tilgung, Zukunftsszenarien
3. **Notfall-/Nachlass-Übersicht** — Passwörter/Zugänge so dokumentiert, dass deine Frau im Ernstfall handlungsfähig ist
4. **Versicherungs- & Vertragsübersicht** — Policen, Laufzeiten, Kündigungsfristen, Kontakte

Wichtig: Du willst es **selbst bauen** (mit Claude Code), Schritt für Schritt, angepasst auf deine Wünsche — nicht eine fertige App kaufen. Dieser Plan ist die Landkarte dafür.

---

## 2. Marktanalyse — was es gibt und was wir davon lernen

### 2.1 Deutsche Multibanking-Apps (Kontoaggregation)

| App | Stärken | Schwächen | Idee für uns |
|---|---|---|---|
| **Outbank** | Alle Konten + Investments, hohe Sicherheit, Testsieger | Nur noch Abo, kein Gratis-Tier | Vollständigkeit: Konten **und** Depots in einer Ansicht |
| **Finanzblick** | Kostenlos, werbefrei, Note "gut" (2,2) | Reines Banking, wenig Planung | Saubere Kontoübersicht als Vorbild |
| **Finanzguru** | Bündelt Konten, Depots **und Verträge**, Ausgabenanalyse, Einsparpotenziale | Datenhoheit liegt beim Anbieter | **Verträge/Abos** mitdenken — das brauchst du auch |
| **Sparkasse / Banking4 / StarMoney** | Etabliert, viele Banken, FinTS-Standard | Kein Nachlass-/Notfallteil | Breite Bankanbindung via FinTS |

**Lücke im Markt:** Keine dieser Apps deckt den **Notfall-/Nachlass-Teil** ab. Genau das ist dein Alleinstellungsmerkmal. Multibanking-Apps zeigen dir *Geld*, aber nicht „was muss meine Frau wissen, wenn ich ausfalle".

### 2.2 Open-Source / Self-hosted Tools (zum Abschauen der Architektur)

| Tool | Konzept | Was wir übernehmen |
|---|---|---|
| **Firefly III** | Self-hosted, doppelte Buchführung, Net-Worth-Tracking, Regel-Engine für Transaktionen | Net-Worth-Verlauf, transparente Regeln statt Blackbox-KI |
| **Actual Budget** | Envelope-Budgeting (YNAB-Stil), schlank, offline-fähig, gute Mobile-UX | Einfaches Budget-Modell, Offline-First, schnelle UI |
| **ezBookkeeping** | Leichtgewichtig, self-hosted | Minimaler Ballast, schneller Start |

**Lehre:** Profis trennen oft **Net-Worth-Tracking** (Firefly) von **Tagesbudget** (Actual). Du brauchst vor allem Ersteres + Notfall. Budget ist „nice to have".

### 2.3 Notfallordner-Konzept (der Nachlass-Teil)

Aus Ratgebern (afilio, Biallo, DIA) klar geworden:

- Ein Notfallordner bündelt: persönliche Daten, Bankkonten/Depots, Versicherungen, laufende Verträge, Vollmachten, Verfügungen, wichtige Kontakte.
- **Goldene Regel zu Passwörtern:** Klartext-Passwörter gehören **nicht** in eine offen lesbare Übersicht — nur ein **Verweis**, *wo* sie liegen (Passwort-Manager, Safe, Schließfach). Plus: Ein Passwort-Manager mit **Notfallzugang** (Emergency Access) für die Vertrauensperson.
- Aufbewahrung: sicherer Ort (feuerfester Safe / Bankschließfach), Vertrauensperson kennt den Ort.

Das fließt direkt in unsere Sicherheitsarchitektur ein (Abschnitt 5).

---

## 3. Feature-Liste: Must-have / Should-have / Nice-to-have

### 3.1 Finanzüberblick (Kern)
- **Must:** Dashboard mit Gesamtvermögen (Netto = Vermögen − Schulden), Liste aller Konten + Salden, aller Depots + aktueller Wert, aller Darlehen + Restschuld
- **Must:** Darlehensdetails — Zinssatz, Rate, Restschuld, Restlaufzeit, nächster Zinsbindungsablauf
- **Should:** Verlaufsgrafik Nettovermögen über Zeit (monatliche Snapshots)
- **Should:** Depot-Aufschlüsselung nach Asset-Klasse / Einzelposition
- **Nice:** Ausgaben-/Kategorienanalyse, Cashflow pro Monat

### 3.2 Finanzplanung
- **Must:** Tilgungsplan pro Darlehen (Annuität: Zins-/Tilgungsanteil, Restschuld über Zeit)
- **Should:** Szenario-Rechner („Was, wenn ich 200 €/Monat mehr tilge?", „Anschlussfinanzierung bei X %")
- **Should:** Vermögens-Prognose (Sparrate + angenommene Rendite → Hochrechnung)
- **Nice:** Ziele/Sparziele mit Fortschrittsbalken, FIRE-/Rentenlücken-Rechner

### 3.3 Notfall- / Nachlass-Übersicht
- **Must:** Strukturierte Liste von Zugängen mit **Verweis** statt Klartext (siehe Sicherheit)
- **Must:** „Im-Ernstfall"-Anleitung für deine Frau (Schritt-für-Schritt, wo liegt was, wen anrufen)
- **Must:** Wichtige Kontakte (Bank, Versicherung, Steuerberater, Anwalt, Notar)
- **Should:** Dokumenten-Checkliste (Testament, Vollmacht, Patientenverfügung — wo abgelegt)
- **Nice:** Digitaler Nachlass (E-Mail, Social, Abos kündigen-Liste)

### 3.4 Versicherungen & Verträge
- **Must:** Übersicht aller Policen — Anbieter, Versicherungsnummer, Beitrag, **Laufzeit & Kündigungsfrist**, Kontakt
- **Must:** Fristen-Warnungen (z. B. „läuft in 60 Tagen aus / kündbar bis …")
- **Should:** Laufende Verträge/Abos (Strom, Internet, Mobilfunk, Streaming) analog
- **Nice:** Dokumenten-Upload (Police als PDF lokal verlinkt)

### 3.5 Querschnitt (technisch)
- **Must:** Lokale Datenhaltung, Backup/Export
- **Should:** Verschlüsselung sensibler Felder, Login-Schutz
- **Nice:** Mobile-taugliche Ansicht, Mehrbenutzer (du + Frau)

---

## 4. Technische Architektur (lokale Web-App)

Da du **lokale Web-App** gewählt hast — Daten bleiben auf deinem Rechner, läuft im Browser:

```
┌─────────────────────────────────────────────┐
│   Browser (Frontend)                         │
│   - Dashboard, Tabellen, Charts              │
│   - z. B. React + Tailwind oder schlankes    │
│     Vanilla/HTML + Chart.js                  │
└───────────────┬─────────────────────────────┘
                │ lokale API (localhost)
┌───────────────▼─────────────────────────────┐
│   Backend (läuft lokal auf deinem PC)        │
│   - Python (FastAPI) ODER Node.js            │
│   - Geschäftslogik: Tilgung, Net Worth       │
│   - Bankanbindung via FinTS                  │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│   Datenhaltung (lokal)                        │
│   - SQLite-Datei (verschlüsselbar)           │
│   - sensible Felder zusätzlich verschlüsselt │
│   - Backup als Export                        │
└─────────────────────────────────────────────┘
```

**Empfohlener Stack (gut mit Claude Code baubar):**
- **Backend:** Python + **FastAPI** — weil die beste Bankanbindungs-Bibliothek (`python-fints`) in Python existiert und Tilgungs-/Finanzmathematik in Python trivial ist.
- **Datenbank:** **SQLite** (eine Datei, kein Server nötig, leicht zu sichern). Verschlüsselung via SQLCipher oder feldweise.
- **Frontend:** Start einfach mit **HTML + Chart.js** (schnell sichtbare Ergebnisse), später Ausbau zu React, wenn du mehr Interaktivität willst. **Gestaltung folgt verbindlich `design.md` (siehe 4.2).**
- **Betrieb:** Doppelklick-Start per Skript; App öffnet sich auf `localhost`. Kein Server, keine Cloud.

### 4.2 Design-System (verbindlich, aus `design.md`)
Das gesamte Frontend folgt dem Stil **„Sumi-e Tech Scroll"** — traditionelle Tuschmalerei trifft moderne, technische Klarheit. Alle Phasen mit UI halten sich daran:

- **Farben:** Reispapier-Beige `#F4F1E8` (Flächen), Tinten-Schwarz `#0D0D0D` (Text), Siegel-Rot `#8A1C15` (Akzente/CTAs), Wasch-Grau `#808080` (sekundär/Rahmen). **Kein reines Schwarz `#000000`** als Text/Fläche, Akzent-Sättigung max. 80 %.
- **Typografie:** `Noto Serif JP` für Überschriften & Fließtext, **`JetBrains Mono` für alle Finanzwerte/Zahlen/Metadaten** (passt perfekt zu Salden, Zinssätzen, Restschuld). Hero `clamp(2.5rem,5vw,4rem)`, Body 1rem/1.6.
- **Optik:** Reispapier-Textur als Hintergrund, dezente Tuschwasch-Elemente, **rote Siegel-/Stempel-Akzente**, Pinselstrich-Rahmen, optional isometrische Tech-Overlays.
- **Komponenten:** Cards leicht gerundet (0.5rem), feiner Schatten `0 2px 12px rgba(0,0,0,0.06)`, 1px Rahmen. Primär-Button rot gefüllt, Hover = 8 % dunkler + leichter Lift. Inputs mit Label oben, Fokusring 2px Akzent.
- **Layout:** CSS Grid, max. 1280px zentriert, **asymmetrische Grids** (kein 3-gleiche-Spalten-Raster), Abschnittsabstände `clamp(4rem,8vw,8rem)`, alles kollabiert unter 768px, `min-h-[100dvh]` statt `h-screen`.
- **Motion:** Ease-out 200–300ms, Listen-Eintritt Fade + translate-Y (16px→0), Stagger 80ms; nur `transform`/`opacity` animieren.
- **Verboten:** Emojis in der UI (nur **Lucide**-Icons), reines Schwarz, übersättigte Akzente, kaputte Bildlinks, generisches Lorem Ipsum, Floskeln wie „Elevate/Seamless/Unleash".

*Praktisch:* In Phase 0 legen wir die Design-Tokens als CSS-Variablen (`--rice-paper`, `--ink-black`, `--seal-red`, `--wash-grey`, `--font-serif`, `--font-mono`) zentral an, sodass jede spätere Komponente sie automatisch erbt.

### 4.1 Automatische Bankanbindung (deine Wahl)
- **FinTS/HBCI** ist der deutsche Standard; `python-fints` kann **Salden, Umsätze und Depot-Bestände** abrufen — auch Sparkonten, Kreditkarten und Depots. Das deckt fast alle deutschen Banken ab.
- Ablauf: pro Bank einmal Zugangsdaten + TAN-Verfahren einrichten, dann Abruf auf Knopfdruck.
- **Wichtig & ehrlich:** FinTS ist mächtig, aber die Einrichtung pro Bank ist fummelig (PIN/TAN, teils PSD2-Zwang). **Empfehlung:** in Phase 1 zuerst **manuelle Eingabe** lauffähig machen (sofort nutzbar), dann FinTS als eigene Phase nachrüsten. So hast du früh ein funktionierendes Tool und das komplexe Stück blockiert dich nicht.
- Alternative bei Frust mit FinTS: Aggregator-APIs (finAPI, enable:Banking) — komfortabler, aber Daten laufen über einen Dritten → Datenhoheit geringer.

---

## 5. Sicherheit & der Passwort-Teil (Optionen abgewogen)

Du wolltest die Passwort-Frage offen — hier die zwei Wege ehrlich gegenübergestellt:

### Option A — Nur Verweise, keine Klartext-Passwörter *(empfohlen, Best Practice)*
Das Dashboard speichert **keine** Passwörter, sondern nur: „Konto X → liegt im Passwort-Manager Y" / „Tresor im Arbeitszimmer" / „Notfallzugang ist für meine Frau eingerichtet". Zusätzlich richtest du im Passwort-Manager (Bitwarden, 1Password, KeePass) den **Emergency/Notfall-Zugang** für deine Frau ein.
- **Pro:** Kein Single Point of Failure; selbst wenn das Dashboard kompromittiert wird, sind keine Passwörter drin. Entspricht der Notfallordner-Empfehlung der Ratgeber.
- **Contra:** Du brauchst zusätzlich einen Passwort-Manager; ein Schritt mehr.

### Option B — Passwörter verschlüsselt im Tool selbst
Passwörter werden mit einem Master-Passwort verschlüsselt lokal abgelegt (z. B. AES-256).
- **Pro:** Alles an einem Ort, bequem.
- **Contra:** Du baust faktisch einen eigenen Passwort-Manager — das ist sicherheitskritisch und leicht falsch gemacht (Krypto-Fehler, Backups im Klartext, vergessenes Master-PW = alles weg). Höheres Risiko, mehr Verantwortung.

**Meine Empfehlung:** **Option A.** Das Tool wird zur *Landkarte* („wo liegt was, wer ist zu kontaktieren, in welcher Reihenfolge"), die eigentlichen Geheimnisse bleiben im dafür gebauten Passwort-Manager mit Notfallzugang. Du kannst Option B später als optionales Modul ergänzen, falls du es wirklich willst — aber bewusst und mit ordentlicher Krypto.

**Grundschutz unabhängig davon:**
- Lokaler Login fürs Dashboard (Master-Passwort).
- SQLite-Datei verschlüsselt (SQLCipher).
- Regelmäßiges verschlüsseltes Backup (z. B. auf USB-Stick im Safe).
- Klartext-Exporte vermeiden.

---

## 6. Roadmap — Phasen für Claude Code

Jede Phase ist ein in sich nutzbarer Meilenstein. Du kannst nach jeder Phase aufhören und hast etwas Funktionierendes.

### Phase 0 — Fundament (½–1 Tag)
- Projektgerüst (FastAPI + SQLite + simple HTML-Seite)
- **Design-Tokens aus `design.md` als CSS-Variablen + Basis-Layout (Sumi-e Tech Scroll) anlegen**
- Datenmodell anlegen: Konten, Darlehen, Depots, Versicherungen, Verträge, Kontakte, Notfall-Einträge
- „Hello Dashboard": leere Seite im finalen Look, die aus der DB liest
- **Ergebnis:** lauffähige App auf localhost

### Phase 1 — Manueller Finanzüberblick (1–2 Tage)
- Eingabemasken für Konten/Darlehen/Depots (manuelles Pflegen)
- Dashboard: Gesamtvermögen, Konten-, Depot-, Darlehensliste
- Erste Charts (Vermögensaufteilung)
- **Ergebnis:** Du siehst dein komplettes Finanzbild — sofort nutzbar

### Phase 2 — Finanzplanung (1–2 Tage)
- Tilgungsplan-Generator pro Darlehen (Annuität)
- Szenario-Rechner (Sondertilgung, Anschlusszins)
- Vermögens-Prognose
- Monatliche Net-Worth-Snapshots + Verlaufschart
- **Ergebnis:** aus „Überblick" wird „Planung"

### Phase 3 — Versicherungen & Verträge (1 Tag)
- Erfassung Policen/Verträge inkl. Laufzeit & Kündigungsfrist
- Fristen-Dashboard mit Warnungen (X Tage vorher)
- Kontaktverzeichnis
- **Ergebnis:** nie wieder eine Kündigungsfrist verpassen

### Phase 4 — Notfall-/Nachlass-Modul (1–2 Tage)
- Strukturierte „Wo liegt was"-Übersicht (Option A: Verweise)
- „Im-Ernstfall"-Anleitung für deine Frau (druckbar als PDF)
- Wichtige Kontakte + Dokumenten-Checkliste
- **Ergebnis:** deine Frau wäre im Ernstfall handlungsfähig

### Phase 5 — Automatische Bankanbindung (2–4 Tage, optional)
- FinTS-Integration (`python-fints`): Salden, Umsätze, Depotstände abrufen
- Bank für Bank einrichten und testen
- Automatischer Snapshot-Abgleich
- **Ergebnis:** weniger manuelle Pflege

### Phase 6 — Feinschliff (laufend)
- Verschlüsselung/Backup härten
- Mobile-Ansicht, Mehrbenutzer (du + Frau)
- Budget-/Ausgabenanalyse (nice-to-have)
- Export/Reports (PDF)

---

## 7. Empfohlene Reihenfolge & Prinzipien

1. **Erst Wert, dann Komfort:** Manuelle Eingabe (Phase 1) liefert sofort Nutzen. Die komplexe Bankanbindung (Phase 5) kommt später und blockiert nichts.
2. **Notfall-Modul nicht aufschieben:** Phase 4 ist dein eigentliches Alleinstellungsmerkmal und schützt deine Familie — höher priorisieren, als es „technisch spannend" ist.
3. **Sicherheit von Anfang an:** Lokal + Login + Backup ab Phase 0 mitdenken, nicht nachträglich.
4. **Klein liefern, oft testen:** Jede Phase endet mit etwas Benutzbarem. Mit Claude Code arbeitest du am besten in kleinen, klar umrissenen Aufgaben.

---

## 8. Offene Punkte für dich

- Soll deine Frau **mitnutzen** können (eigener Login) oder nur im Ernstfall Zugriff?
- Welche **Banken** willst du anbinden (für Phase 5 Machbarkeit prüfen)?
- Brauchst du **mobilen** Zugriff oder reicht der Desktop?
- Soll ich als nächsten Schritt **Phase 0 + 1 konkret als Claude-Code-Projekt aufsetzen** (Gerüst + erstes Dashboard)?

---

## Quellen

- [Check24 — Multibanking-Apps 2026](https://www.check24.de/konto-kredit/ratgeber/multibanking/)
- [Handelsblatt — Haushaltsbuch-Apps Vergleich 2026](https://www.handelsblatt.com/vergleich/kostenlose-haushaltsbuch-apps-vergleich/)
- [neuebanken.de — Finanzguru-Alternativen / Multibanking](https://www.neuebanken.de/finanzguru-alternativen/)
- [Firefly III (GitHub)](https://github.com/firefly-iii/firefly-iii) · [Firefly III vs Actual Budget](https://talos.tools/compare/firefly-iii-vs-actual-budget)
- [afilio — Notfallordner](https://www.afilio.de/ratgeber/patientenverfuegung/notfallordner) · [Biallo — Notfallordner](https://www.biallo.de/soziales/news/notfallordner-wichtige-dokumente/) · [DIA — Notfallordner](https://www.dia-vorsorge.de/mit-dem-notfallordner-handlungsfaehig-im-krisenfall/)
- [python-fints (Doku)](https://python-fints.readthedocs.io/en/latest/) · [FinTS (Wikipedia)](https://en.wikipedia.org/wiki/FinTS) · [adorsys open-banking-gateway](https://github.com/adorsys/open-banking-gateway)
- [VR-Bank — Tilgungsplan erstellen](https://www.vr.de/privatkunden/themenwelten/finanzen/kredit-finanzierung/tilgungsplan-erstellen.html)
