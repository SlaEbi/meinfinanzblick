#!/usr/bin/env bash
# Ersteinrichtung MeinFinanzblick
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     MeinFinanzblick  —  Einrichtung    ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Python-Version prüfen
if ! command -v python3 &>/dev/null; then
  echo "❌  Python 3 nicht gefunden."
  echo "    Bitte installiere Python 3.11+ von https://www.python.org"
  exit 1
fi

PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)

if [ "$PY_MAJOR" -lt 3 ] || [ "$PY_MINOR" -lt 9 ]; then
  echo "❌  Python $PY_VERSION gefunden, aber mindestens 3.9 wird benötigt."
  exit 1
fi

echo "✓  Python $PY_VERSION gefunden"

# Virtuelle Umgebung anlegen
if [ ! -d ".venv" ]; then
  echo "→   Erstelle virtuelle Umgebung..."
  python3 -m venv .venv
fi
echo "✓  Virtuelle Umgebung bereit"

# Abhängigkeiten installieren
source .venv/bin/activate
echo "→   Installiere Abhängigkeiten..."
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo "✓  Abhängigkeiten installiert"

# Daten-Ordner anlegen
mkdir -p data backups
echo "✓  Datenordner angelegt"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅  Einrichtung abgeschlossen!        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "  Starten:   make start"
echo "  oder:      ./scripts/start.sh"
echo ""
