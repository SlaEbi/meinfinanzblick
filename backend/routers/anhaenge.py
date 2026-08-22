import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Anhang

UPLOADS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', '..', 'data', 'uploads')
)
os.makedirs(UPLOADS_DIR, exist_ok=True)

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

ALLOWED_ENTITY_TYPEN = {
    'konto', 'darlehen', 'depot', 'sachwert',
    'versicherung', 'vertrag', 'dokument', 'notfall',
}

router = APIRouter(prefix='/anhaenge', tags=['Anhänge'])


def delete_anhaenge_fuer(entity_typ: str, entity_id: int, db: Session) -> None:
    """Löscht alle Anhänge (Datei + DB-Zeile) eines Datensatzes.

    Muss vor jedem db.delete() eines Datensatzes mit Anhängen aufgerufen werden.
    Ohne FK/Cascade bleiben sonst verwaiste Anhang-Zeilen zurück, die bei einer
    späteren, von SQLite wiederverwendeten ID plötzlich am falschen (neuen)
    Datensatz auftauchen.
    """
    anhaenge = db.query(Anhang).filter(
        Anhang.entity_typ == entity_typ,
        Anhang.entity_id == entity_id,
    ).all()
    for a in anhaenge:
        path = os.path.join(UPLOADS_DIR, a.dateiname)
        if os.path.exists(path):
            os.remove(path)
        db.delete(a)


@router.get('/datei/{anhang_id}')
def get_datei(anhang_id: int, db: Session = Depends(get_db)):
    a = db.query(Anhang).filter(Anhang.id == anhang_id).first()
    if not a:
        raise HTTPException(404, 'Anhang nicht gefunden')
    path = os.path.join(UPLOADS_DIR, a.dateiname)
    if not os.path.exists(path):
        raise HTTPException(404, 'Datei nicht auf dem Server')
    mime = a.mime_type or 'application/octet-stream'
    # PDF und Bilder direkt im Browser anzeigen, alles andere herunterladen
    can_inline = mime in ('application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp')
    return FileResponse(
        path,
        media_type=mime,
        filename=a.original_name,
        content_disposition_type='inline' if can_inline else 'attachment',
    )


@router.get('/{entity_typ}/{entity_id}')
def list_anhaenge(entity_typ: str, entity_id: int, db: Session = Depends(get_db)):
    return db.query(Anhang).filter(
        Anhang.entity_typ == entity_typ,
        Anhang.entity_id == entity_id,
    ).order_by(Anhang.hochgeladen_am).all()


@router.post('/{entity_typ}/{entity_id}')
async def upload_anhang(
    entity_typ: str,
    entity_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if entity_typ not in ALLOWED_ENTITY_TYPEN:
        raise HTTPException(400, f'Ungültiger Entity-Typ: {entity_typ}')

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, 'Datei zu groß (max. 20 MB)')

    original = file.filename or 'datei'
    ext = os.path.splitext(original)[1].lower() or '.bin'
    stored_name = f'{uuid.uuid4()}{ext}'
    path = os.path.join(UPLOADS_DIR, stored_name)

    with open(path, 'wb') as f:
        f.write(content)

    anhang = Anhang(
        entity_typ=entity_typ,
        entity_id=entity_id,
        dateiname=stored_name,
        original_name=original,
        mime_type=file.content_type,
    )
    db.add(anhang)
    db.commit()
    db.refresh(anhang)
    return anhang


@router.delete('/{anhang_id}', status_code=204)
def delete_anhang(anhang_id: int, db: Session = Depends(get_db)):
    a = db.query(Anhang).filter(Anhang.id == anhang_id).first()
    if not a:
        raise HTTPException(404, 'Anhang nicht gefunden')
    path = os.path.join(UPLOADS_DIR, a.dateiname)
    if os.path.exists(path):
        os.remove(path)
    db.delete(a)
    db.commit()
    return None
