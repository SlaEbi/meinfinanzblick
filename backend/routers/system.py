import subprocess
import sys
import os
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=['System'])

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class UpdateResult(BaseModel):
    success: bool
    git_output: str
    pip_output: str
    message: str


class PublishResult(BaseModel):
    success: bool
    output: str
    message: str


@router.post('/system/update', response_model=UpdateResult)
def run_update():
    git_out = ''
    pip_out = ''

    # git pull
    git_result = subprocess.run(
        ['git', 'pull', '--ff-only'],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    git_out = (git_result.stdout + git_result.stderr).strip()

    if git_result.returncode != 0:
        return UpdateResult(
            success=False,
            git_output=git_out,
            pip_output='',
            message='Git-Update fehlgeschlagen.',
        )

    already_current = 'Already up to date' in git_out or 'Bereits aktuell' in git_out

    # pip install
    pip_result = subprocess.run(
        [sys.executable, '-m', 'pip', 'install', '-q', '-r', 'requirements.txt'],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )
    pip_out = (pip_result.stdout + pip_result.stderr).strip()

    if pip_result.returncode != 0:
        return UpdateResult(
            success=False,
            git_output=git_out,
            pip_output=pip_out,
            message='Abhängigkeiten konnten nicht installiert werden.',
        )

    if already_current:
        message = 'Bereits auf dem neuesten Stand.'
    else:
        message = 'Update erfolgreich. Bitte die Seite neu laden.'

    return UpdateResult(
        success=True,
        git_output=git_out,
        pip_output=pip_out,
        message=message,
    )


@router.post('/system/publish', response_model=PublishResult)
def run_publish():
    out = ''

    # git add -A
    r = subprocess.run(['git', 'add', '-A'], cwd=PROJECT_ROOT, capture_output=True, text=True)
    out += (r.stdout + r.stderr).strip()

    # Gibt es überhaupt Änderungen?
    status = subprocess.run(['git', 'status', '--porcelain'], cwd=PROJECT_ROOT, capture_output=True, text=True)
    if not status.stdout.strip() and r.returncode == 0:
        # Nichts zu committen — trotzdem pushen falls lokale Commits ausstehen
        pass

    # git commit
    r = subprocess.run(
        ['git', 'commit', '-m', 'Update via MeinFinanzblick'],
        cwd=PROJECT_ROOT, capture_output=True, text=True,
    )
    commit_out = (r.stdout + r.stderr).strip()
    out = (out + '\n' + commit_out).strip()
    nothing_to_commit = 'nothing to commit' in commit_out or 'nichts zu committen' in commit_out

    # git push
    r = subprocess.run(['git', 'push'], cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=60)
    push_out = (r.stdout + r.stderr).strip()
    out = (out + '\n' + push_out).strip()

    if r.returncode != 0:
        return PublishResult(success=False, output=out, message='Push fehlgeschlagen.')

    if nothing_to_commit:
        message = 'Keine neuen Änderungen — bereits veröffentlicht.'
    else:
        message = 'Erfolgreich auf GitHub veröffentlicht.'

    return PublishResult(success=True, output=out, message=message)
