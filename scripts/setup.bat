@echo off
chcp 65001 >nul
echo.
echo ╔════════════════════════════════════════╗
echo ║     MeinFinanzblick  —  Einrichtung    ║
echo ╚════════════════════════════════════════╝
echo.

cd /d "%~dp0.."

:: Python prüfen
python --version >nul 2>&1
if errorlevel 1 (
    echo FEHLER: Python nicht gefunden.
    echo Bitte installiere Python 3.11 von https://www.python.org
    echo Wichtig: "Add Python to PATH" anklicken beim Installieren!
    pause
    exit /b 1
)

echo Python gefunden.

:: Virtuelle Umgebung anlegen
if not exist ".venv" (
    echo Erstelle virtuelle Umgebung...
    python -m venv .venv
)
echo Virtuelle Umgebung bereit.

:: Abhängigkeiten installieren
call .venv\Scripts\activate.bat
echo Installiere Abhängigkeiten...
pip install -q --upgrade pip
pip install -q -r requirements.txt
echo Abhängigkeiten installiert.

:: Ordner anlegen
if not exist "data" mkdir data
if not exist "backups" mkdir backups
echo Ordner angelegt.

echo.
echo ╔════════════════════════════════════════╗
echo ║  Einrichtung abgeschlossen!            ║
echo ╚════════════════════════════════════════╝
echo.
echo  Starten: Doppelklick auf scripts\start.bat
echo.
pause
