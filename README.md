# MeinFinanzblick

Privates Finanz- und Notfall-Dashboard — läuft vollständig lokal auf deinem Computer.
Keine Daten werden ins Internet übertragen.

---

## Ersteinrichtung (einmalig)

### Schritt 1 — Python installieren

Öffne [python.org](https://www.python.org/downloads/) und lade **Python 3.11** herunter.
Beim Installieren unbedingt **„Add Python to PATH"** anklicken.

### Schritt 2 — App herunterladen

Öffne das Terminal (auf dem Mac: Launchpad → „Terminal") und gib ein:

```bash
git clone https://github.com/DEIN-BENUTZERNAME/meinfinanzblick.git
cd meinfinanzblick
```

> Ersetze `DEIN-BENUTZERNAME` durch den GitHub-Benutzernamen, den du von Slava erhalten hast.

### Schritt 3 — Einrichten

```bash
make setup
```

Das dauert einige Minuten — die App installiert alle nötigen Bausteine automatisch.

---

## App starten

```bash
make start
```

Danach öffnet sich der Browser automatisch auf `http://localhost:8000`.

Das Terminal-Fenster muss **offen bleiben**, solange du die App nutzt.
Zum Beenden: Terminal-Fenster schließen oder `Strg + C` drücken.

---

## Updates einspielen

Wenn Slava eine neue Version fertig hat, einfach einmal ausführen:

```bash
make update
make start
```

Deine Daten bleiben dabei vollständig erhalten.

---

## Datensicherung

```bash
make backup
```

Legt eine Sicherungskopie der Datenbank im Ordner `backups/` ab.
Diese Kopie kannst du auf einen USB-Stick kopieren und sicher aufbewahren.

---

## Wo liegen die Daten?

```
meinfinanzblick/
├── data/finanzblick.db   ← deine Finanzdaten (nicht im Internet)
└── backups/              ← deine Sicherungskopien
```

Die Datenbank-Datei ist der einzige Ort, wo deine Daten gespeichert werden.
**Kein Cloud-Upload, kein externer Zugriff.**

---

## Häufige Fragen

**Die App startet nicht** → Stelle sicher, dass das Terminal im richtigen Ordner ist (`cd meinfinanzblick`) und führe `make setup` nochmals aus.

**Ich sehe einen weißen Bildschirm** → Warte kurz und lade die Seite neu (F5). Manchmal braucht der Server einen Moment.

**Fehler: „command not found: make"** → Öffne das Terminal und gib ein: `xcode-select --install`. Dann nochmal versuchen.

---

## Kontakt

Bei Fragen oder Problemen: Slava anrufen oder schreiben.
