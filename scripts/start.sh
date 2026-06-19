#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

if [ ! -d ".venv" ]; then
  echo "Erstelle virtuelle Umgebung..."
  python3 -m venv .venv
fi

source .venv/bin/activate

echo "Installiere Abhängigkeiten..."
pip install -q -r requirements.txt

echo ""
echo "╔════════════════════════════════════╗"
echo "║   MeinFinanzblick  ·  localhost    ║"
echo "╚════════════════════════════════════╝"
echo "  → http://localhost:8000"
echo ""

uvicorn backend.main:app --reload --port 8000
