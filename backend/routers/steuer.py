from datetime import date, datetime, timezone
from decimal import Decimal as D

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import SteuerPrognose, SteuerKind, SteuerBetriebsstaette
from ..schemas import (
    SteuerPrognoseCreate, SteuerPrognoseUpdate, SteuerPrognoseResponse, SteuerErgebnis,
)
from ..services.steuer import (
    PrognoseInput, Kind, Betriebsstaette, berechne_prognose,
)
from ..services.steuer_konstanten import parameter as steuer_parameter, ist_naeherung

router = APIRouter(prefix='/steuer', tags=['Steuerprognose'])


def _get_or_404(db: Session, jahr: int) -> SteuerPrognose:
    obj = (
        db.query(SteuerPrognose)
        .options(joinedload(SteuerPrognose.kinder), joinedload(SteuerPrognose.betriebsstaetten))
        .filter(SteuerPrognose.jahr == jahr)
        .first()
    )
    if not obj:
        raise HTTPException(404, f'Keine Steuerprognose für {jahr} gefunden')
    return obj


def _apply_kinder_betriebsstaetten(db: Session, obj: SteuerPrognose, data: SteuerPrognoseCreate):
    obj.kinder = [
        SteuerKind(name=k.name, geburtsdatum=k.geburtsdatum, in_ausbildung_18_25=k.in_ausbildung_18_25)
        for k in data.kinder
    ]
    obj.betriebsstaetten = [
        SteuerBetriebsstaette(
            gemeinde=b.gemeinde, hebesatz=b.hebesatz, arbeitsloehne=b.arbeitsloehne,
            taetigkeitsanteil_pct=b.taetigkeitsanteil_pct, prozent_manuell=b.prozent_manuell,
            vorauszahlung=b.vorauszahlung,
        )
        for b in data.betriebsstaetten
    ]


@router.get('/jahre', response_model=list[int])
def list_jahre(db: Session = Depends(get_db)):
    rows = db.query(SteuerPrognose.jahr).order_by(SteuerPrognose.jahr.desc()).all()
    return [r[0] for r in rows]


@router.get('/{jahr}', response_model=SteuerPrognoseResponse)
def get_prognose(jahr: int, db: Session = Depends(get_db)):
    return _get_or_404(db, jahr)


@router.post('/', response_model=SteuerPrognoseResponse, status_code=201)
def create_prognose(data: SteuerPrognoseCreate, db: Session = Depends(get_db)):
    existing = db.query(SteuerPrognose).filter(SteuerPrognose.jahr == data.jahr).first()
    if existing:
        raise HTTPException(409, f'Für {data.jahr} existiert bereits eine Prognose — PUT zum Aktualisieren nutzen')
    obj = SteuerPrognose(**data.model_dump(exclude={'kinder', 'betriebsstaetten'}))
    db.add(obj)
    db.flush()
    _apply_kinder_betriebsstaetten(db, obj, data)
    db.commit()
    db.refresh(obj)
    return obj


@router.put('/{jahr}', response_model=SteuerPrognoseResponse)
def update_prognose(jahr: int, data: SteuerPrognoseUpdate, db: Session = Depends(get_db)):
    obj = _get_or_404(db, jahr)
    for k, v in data.model_dump(exclude={'kinder', 'betriebsstaetten'}).items():
        setattr(obj, k, v)
    obj.aktualisiert_am = datetime.now(timezone.utc)
    _apply_kinder_betriebsstaetten(db, obj, data)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete('/{jahr}', status_code=204)
def delete_prognose(jahr: int, db: Session = Depends(get_db)):
    obj = _get_or_404(db, jahr)
    db.delete(obj)
    db.commit()


@router.get('/{jahr}/berechnung', response_model=SteuerErgebnis)
def berechnung(jahr: int, db: Session = Depends(get_db)):
    obj = _get_or_404(db, jahr)

    inp = PrognoseInput(
        jahr=obj.jahr,
        veranlagung=obj.veranlagung,
        kirchensteuerpflicht=obj.kirchensteuerpflicht,
        zerlegungsmodus=obj.zerlegungsmodus,
        gewinn_gewerbebetrieb=D(str(obj.gewinn_gewerbebetrieb or 0)),
        gewinn_gewerbebetrieb_ehefrau=D(str(obj.gewinn_gewerbebetrieb_ehefrau or 0)),
        sonstige_einkuenfte=D(str(obj.sonstige_einkuenfte or 0)),
        bruttolohn_ehefrau=D(str(obj.bruttolohn_ehefrau or 0)),
        werbungskosten_ehefrau=D(str(obj.werbungskosten_ehefrau or 0)),
        vermietung_einnahmen=D(str(obj.vermietung_einnahmen or 0)),
        vermietung_werbungskosten=D(str(obj.vermietung_werbungskosten or 0)),
        vermietung_afa=D(str(obj.vermietung_afa or 0)),
        kv_pv_beitraege_gesamt=D(str(obj.kv_pv_beitraege_gesamt or 0)),
        basisrente_beitrag=D(str(obj.basisrente_beitrag or 0)),
        uebrige_vorsorge_ich=D(str(obj.uebrige_vorsorge_ich or 0)),
        uebrige_vorsorge_ehefrau=D(str(obj.uebrige_vorsorge_ehefrau or 0)),
        spenden=D(str(obj.spenden or 0)),
        kinderbetreuungskosten=D(str(obj.kinderbetreuungskosten or 0)),
        handwerkerleistungen=D(str(obj.handwerkerleistungen or 0)),
        gewst_hinzurechnung_zinsen_mieten=D(str(obj.gewst_hinzurechnung_zinsen_mieten or 0)),
        gewst_kuerzung_grundbesitz=D(str(obj.gewst_kuerzung_grundbesitz or 0)),
        est_vz_q1=D(str(obj.est_vz_q1 or 0)),
        est_vz_q2=D(str(obj.est_vz_q2 or 0)),
        est_vz_q3=D(str(obj.est_vz_q3 or 0)),
        est_vz_q4=D(str(obj.est_vz_q4 or 0)),
        lohnsteuer_ehefrau=D(str(obj.lohnsteuer_ehefrau or 0)),
        soli_ehefrau=D(str(obj.soli_ehefrau or 0)),
        kirchensteuer_ehefrau=D(str(obj.kirchensteuer_ehefrau or 0)),
        kinder=[
            Kind(geburtsdatum=k.geburtsdatum, in_ausbildung_18_25=bool(k.in_ausbildung_18_25), name=k.name or '')
            for k in obj.kinder
        ],
        betriebsstaetten=[
            Betriebsstaette(
                gemeinde=b.gemeinde, hebesatz=D(str(b.hebesatz)),
                arbeitsloehne=D(str(b.arbeitsloehne or 0)),
                taetigkeitsanteil_pct=D(str(b.taetigkeitsanteil_pct or 0)),
                prozent_manuell=D(str(b.prozent_manuell)) if b.prozent_manuell is not None else None,
                vorauszahlung=D(str(b.vorauszahlung or 0)),
            )
            for b in obj.betriebsstaetten
        ],
        heute=date.today(),
    )

    if not inp.betriebsstaetten:
        raise HTTPException(422, 'Mindestens eine Betriebsstätte mit Hebesatz wird benötigt')

    ergebnis = berechne_prognose(inp)
    return ergebnis


@router.get('/{jahr}/hebesatz-defaults')
def hebesatz_defaults(jahr: int):
    """Default-Hebesätze fürs Formular (Nürtingen/Böblingen), editierbar."""
    p = steuer_parameter(jahr)
    return {g: float(h) for g, h in p['hebesatz_defaults'].items()}


@router.get('/{jahr}/meta')
def meta(jahr: int):
    """Formular-Metadaten fürs Frontend: ob für dieses Jahr ein eigens
    recherchierter Tarif vorliegt oder der jüngste bekannte als Näherung dient."""
    return {'ist_naeherung': ist_naeherung(jahr)}
