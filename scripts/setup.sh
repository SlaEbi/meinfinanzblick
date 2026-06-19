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
pip install -q Pillow
echo "✓  Abhängigkeiten installiert"

# Daten-Ordner anlegen
mkdir -p data backups
echo "✓  Datenordner angelegt"

# macOS App-Bundle erstellen
echo "→   Erstelle App-Bundle..."
APP="$PROJECT_DIR/MeinFinanzblick.app"
mkdir -p "$APP/Contents/MacOS"
mkdir -p "$APP/Contents/Resources"

cat > "$APP/Contents/MacOS/MeinFinanzblick" << 'APPSCRIPT'
#!/usr/bin/env bash
APP_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"

if lsof -i :8000 -sTCP:LISTEN &>/dev/null; then
  ANTWORT=$(osascript <<'EOF'
    button returned of (display dialog "MeinFinanzblick läuft bereits." buttons {"Beenden", "Im Browser öffnen"} default button "Im Browser öffnen" with title "MeinFinanzblick")
EOF
  )
  if [ "$ANTWORT" = "Beenden" ]; then
    pkill -f "uvicorn backend.main:app"
    osascript -e 'display notification "MeinFinanzblick wurde beendet." with title "MeinFinanzblick"'
  else
    open "http://localhost:8000"
  fi
  exit 0
fi

cd "$APP_DIR"
nohup "$APP_DIR/.venv/bin/python" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 > /tmp/meinfinanzblick.log 2>&1 &

for i in $(seq 1 20); do
  sleep 0.5
  if curl -s http://localhost:8000 &>/dev/null; then break; fi
done

open "http://localhost:8000"
osascript -e 'display notification "MeinFinanzblick läuft auf localhost:8000" with title "MeinFinanzblick"' 2>/dev/null
exit 0
APPSCRIPT

chmod +x "$APP/Contents/MacOS/MeinFinanzblick"

cat > "$APP/Contents/Info.plist" << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>MeinFinanzblick</string>
  <key>CFBundleDisplayName</key><string>MeinFinanzblick</string>
  <key>CFBundleIdentifier</key><string>de.privat.meinfinanzblick</string>
  <key>CFBundleVersion</key><string>1.0</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleExecutable</key><string>MeinFinanzblick</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><false/>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSArchitecturePriority</key>
  <array><string>arm64</string></array>
</dict>
</plist>
PLIST

# Icon generieren
python3 "$SCRIPT_DIR/make_icon.py" 2>/dev/null && echo "✓  App-Icon erstellt" || echo "⚠️  Icon konnte nicht erstellt werden (optional)"

# Finder-Cache aktualisieren
touch "$APP" 2>/dev/null || true

echo "✓  App-Bundle erstellt: MeinFinanzblick.app"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ✅  Einrichtung abgeschlossen!        ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "  App starten:  Doppelklick auf MeinFinanzblick.app"
echo "  oder:         make start"
echo ""
echo "  Tipp: Ziehe MeinFinanzblick.app in den Programme-Ordner"
echo "        oder ins Dock für schnellen Zugriff."
echo ""
