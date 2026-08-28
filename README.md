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
git clone https://github.com/SlaEbi/meinfinanzblick.git
cd meinfinanzblick
```

> Ersetze `DEIN-BENUTZERNAME` durch den GitHub-Benutzernamen, den du erhalten hast.

### Schritt 3 — Einrichten

```bash
make setup
```

Das dauert einige Minuten — die App installiert alle nötigen Bausteine automatisch und erstellt die **MeinFinanzblick.app**.

### Schritt 4 — App in den Programme-Ordner ziehen (empfohlen)

Im Finder den Ordner `meinfinanzblick` öffnen. Die Datei `MeinFinanzblick.app` in den **Programme**-Ordner ziehen. Ab jetzt ist sie im Launchpad verfügbar und kann ins Dock gezogen werden.

---

## App starten

**Einfachste Methode:** Doppelklick auf `MeinFinanzblick.app` — der Browser öffnet sich automatisch.

Zum Beenden: nochmal Doppelklick auf die App → „Beenden" wählen.

**Alternativ per Terminal:**
```bash
make start
```

---

## Updates einspielen

Wenn eine neue Version fertig ist, einfach einmal ausführen:

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

Bei Fragen oder Problemen: den Entwickler kontaktieren.
