import subprocess
import sys
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=['System'])

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class UpdateResult(BaseModel):
    success: bool
    detail: str
    message: str


class PublishResult(BaseModel):
    success: bool
    detail: str
    message: str


def _friendly_git_error(raw: str) -> str:
    if 'no tracking information' in raw or 'no such remote' in raw.lower():
        return 'Kein GitHub-Repository verbunden. Bitte einmalig "git remote add origin …" ausführen.'
    if 'Could not resolve host' in raw or 'unable to connect' in raw.lower():
        return 'Keine Internetverbindung. Bitte Verbindung prüfen und erneut versuchen.'
    if 'Authentication failed' in raw or 'Permission denied' in raw:
        return 'Zugriff auf GitHub verweigert. Bitte SSH-Key prüfen.'
    if 'conflict' in raw.lower():
        return 'Es gibt einen Konflikt mit lokalen Änderungen. Bitte den Entwickler kontaktieren.'
    if 'not a git repository' in raw:
        return 'Kein Git-Repository gefunden. Bitte den Entwickler kontaktieren.'
    return 'Unbekannter Fehler beim Update. Bitte den Entwickler kontaktieren.'


@router.post('/system/update', response_model=UpdateResult)
def run_update():
    # git pull
    git_result = subprocess.run(
        ['git', 'pull', '--ff-only'],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    git_raw = (git_result.stdout + git_result.stderr).strip()

    if git_result.returncode != 0:
        return UpdateResult(
            success=False,
            detail='',
            message=_friendly_git_error(git_raw),
        )

    already_current = 'Already up to date' in git_raw or 'Bereits aktuell' in git_raw

    # pip install
    pip_result = subprocess.run(
        [sys.executable, '-m', 'pip', 'install', '-q', '-r', 'requirements.txt'],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )

    if pip_result.returncode != 0:
        return UpdateResult(
            success=False,
            detail='',
            message='Neue Programm-Bausteine konnten nicht installiert werden. Bitte den Entwickler kontaktieren.',
        )

    if already_current:
        message = 'Die App ist bereits auf dem neuesten Stand.'
        detail = ''
    else:
        message = 'Update erfolgreich! Bitte die Seite neu laden.'
        detail = 'Neue Version wurde heruntergeladen und installiert.'

    return UpdateResult(success=True, detail=detail, message=message)


@router.post('/system/publish', response_model=PublishResult)
def run_publish():
    # git add -A
    subprocess.run(['git', 'add', '-A'], cwd=PROJECT_ROOT, capture_output=True, text=True)

    # git commit
    r = subprocess.run(
        ['git', 'commit', '-m', 'Update via MeinFinanzblick'],
        cwd=PROJECT_ROOT, capture_output=True, text=True,
    )
    commit_raw = (r.stdout + r.stderr).strip()
    nothing_to_commit = 'nothing to commit' in commit_raw or 'nichts zu committen' in commit_raw

    # git push
    r = subprocess.run(['git', 'push'], cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=60)
    push_raw = (r.stdout + r.stderr).strip()

    if r.returncode != 0:
        return PublishResult(
            success=False,
            detail='',
            message=_friendly_git_error(push_raw),
        )

    if nothing_to_commit:
        message = 'Keine neuen Änderungen vorhanden — alles bereits veröffentlicht.'
        detail = ''
    else:
        message = 'Erfolgreich auf GitHub veröffentlicht.'
        detail = 'Andere Geräte können jetzt mit "Update" die neue Version laden.'

    return PublishResult(success=True, detail=detail, message=message)
