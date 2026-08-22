"""Manuelles Backup — Datenbank + Anhänge als ZIP-Download.

Deckt nur die erste Stufe des Backup-Vorhabens ab: einen Button in der App,
der die aktuelle SQLite-Datenbank plus alle hochgeladenen Anhänge in einem
ZIP herunterlädt. Ein automatisches, wiederkehrendes Backup außerhalb der
App (z. B. ein Cron/launchd-Skript) ist bewusst NICHT Teil davon — das bleibt
ein separater Schritt.

Die Datenbank wird nicht direkt kopiert, sondern über SQLite's eingebaute
Online-Backup-API dupliziert (`Connection.backup()`). Das liefert eine
konsistente Kopie, auch während die App gerade schreibt — ein simples
`shutil.copy()` der .db-Datei könnte sonst mitten in einer Transaktion
greifen und eine beschädigte Kopie erzeugen.
"""
import os
import sqlite3
import tempfile
import zipfile
from datetime import date
from io import BytesIO

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..db import DB_PATH
from .anhaenge import UPLOADS_DIR

router = APIRouter(tags=['Backup'])


def _backup_db_datei() -> str:
    """Erstellt eine konsistente Kopie der DB in einer temporären Datei und
    gibt deren Pfad zurück. Aufrufer ist für das Löschen verantwortlich."""
    fd, tmp_path = tempfile.mkstemp(suffix='.db')
    os.close(fd)
    quelle = sqlite3.connect(DB_PATH)
    ziel = sqlite3.connect(tmp_path)
    try:
        with ziel:
            quelle.backup(ziel)
    finally:
        quelle.close()
        ziel.close()
    return tmp_path


def build_backup_zip() -> BytesIO:
    buf = BytesIO()
    tmp_db_path = _backup_db_datei()
    try:
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(tmp_db_path, arcname='finanzblick.db')
            if os.path.isdir(UPLOADS_DIR):
                for name in sorted(os.listdir(UPLOADS_DIR)):
                    path = os.path.join(UPLOADS_DIR, name)
                    if os.path.isfile(path):
                        zf.write(path, arcname=f'uploads/{name}')
    finally:
        os.remove(tmp_db_path)
    buf.seek(0)
    return buf


@router.get('/backup.zip')
def export_backup():
    buf = build_backup_zip()
    filename = f'MeinFinanzblick-Backup_{date.today().isoformat()}.zip'
    return StreamingResponse(
        buf,
        media_type='application/zip',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
