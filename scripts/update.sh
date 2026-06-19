#!/usr/bin/env bash
# Update MeinFinanzblick auf neueste Version
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     MeinFinanzblick  —  Update         ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Git-Status prüfen
if ! git rev-parse --git-dir &>/dev/null; then
  echo "❌  Kein Git-Repository gefunden."
  echo "    Bitte stelle sicher, dass die App per git clone eingerichtet wurde."
  exit 1
fi

# Lokale Änderungen sichern (nur wenn vorhanden)
STASHED=false
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "→   Lokale Änderungen werden temporär gesichert..."
  git stash
  STASHED=true
fi

# Neueste Version holen
echo "→   Lade Updates herunter..."
git pull --ff-only origin main 2>/dev/null || git pull --ff-only origin master 2>/dev/null || {
  echo "❌  Update fehlgeschlagen. Bitte prüfe die Internetverbindung."
  [ "$STASHED" = true ] && git stash pop
  exit 1
}
echo "✓  Code aktualisiert"

# Temporäre Änderungen wiederherstellen
if [ "$STASHED" = true ]; then
  git stash pop || echo "⚠️  Hinweis: Lokale Änderungen konnten nicht wiederhergestellt werden."
fi

# Abhängigkeiten aktualisieren
if [ -d ".venv" ]; then
  source .venv/bin/activate
  echo "→   Aktualisiere Abhängigkeiten..."
  pip install -q --upgrade pip
  pip install -q -r requirements.txt
  echo "✓  Abhängigkeiten aktualisiert"
else
  echo "⚠️  Keine virtuelle Umgebung gefunden. Führe zuerst 'make setup' aus."
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅  Update abgeschlossen!             ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "  Neustart:   make start"
echo ""
