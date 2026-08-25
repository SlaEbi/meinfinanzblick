"""Notfall-Mappe als PDF — der eigentliche Zweck der App.

Fasst Sofortmaßnahmen, Kontakte, Konten/Depots, Darlehen, Versicherungen und
Dokumenten-Ablageorte in ein A4-PDF, das ausgedruckt und zu den Papieren
gelegt werden kann. Läuft komplett im Speicher (BytesIO) — es landet keine
Kopie der Notfall-Mappe auf der Platte, außer der Nutzer speichert den
Download selbst.

Enthält bewusst KEINE Klartext-Passwörter und KEINE vollständigen IBANs —
gleiche Linie wie der Rest der App (§5 CLAUDE.md: „Landkarte, kein Tresor").
Für die Zugangsdaten selbst verweist die Mappe auf den Passwortsafe.
"""
from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import (
    Darlehen, Depot, Konto, Kontakt, NotfallEintrag, Versicherung,
)

router = APIRouter(prefix='/export', tags=['Export'])

GOLD   = colors.HexColor('#C9A84C')
DARK   = colors.HexColor('#1A1A1A')
MUTED  = colors.HexColor('#666666')
STRIPE = colors.HexColor('#F9F7F2')
BORDER = colors.HexColor('#E0DDD5')
RED    = colors.HexColor('#8A1C15')
WHITE  = colors.white

KONTO_TYP_LABEL = {
    'giro': 'Girokonto', 'tagesgeld': 'Tagesgeldkonto', 'festgeld': 'Festgeld',
    'sparkonto': 'Sparkonto', 'bargeld': 'Bargeld / Safe', 'sonstige': 'Sonstige',
}
NF_KAT_LABEL = {
    'zugaenge': 'Zugänge & Passwörter', 'dokumente': 'Dokumente & Aufbewahrung',
    'finanzen': 'Finanzielles', 'digital': 'Digitales Erbe', 'sonstiges': 'Sonstiges',
}
NF_KAT_ORDER = ['zugaenge', 'dokumente', 'finanzen', 'digital', 'sonstiges']
NF_ROLLE_LABEL = {
    'bank': 'Bank', 'versicherung': 'Versicherung', 'steuerberater': 'Steuerberater',
    'anwalt': 'Anwalt', 'notar': 'Notar', 'arzt': 'Arzt', 'sonstiges': 'Sonstiges',
}


def mask_iban(iban: str | None) -> str:
    if not iban or len(iban) < 8:
        return iban or '—'
    return f'{iban[:4]} ···· ···· {iban[-4:]}'


def styles() -> dict:
    return {
        'title':    ParagraphStyle('title', fontName='Helvetica-Bold', fontSize=22, leading=27, textColor=DARK, spaceAfter=6),
        'subtitle': ParagraphStyle('subtitle', fontName='Helvetica', fontSize=11, leading=15, textColor=MUTED, spaceAfter=4),
        'section':  ParagraphStyle('section', fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=DARK, spaceBefore=16, spaceAfter=8),
        'lead':     ParagraphStyle('lead', fontName='Helvetica', fontSize=10.5, textColor=DARK, leading=16, spaceAfter=10),
        'hint':     ParagraphStyle('hint', fontName='Helvetica-Oblique', fontSize=9, textColor=MUTED, leading=13),
        'cell':     ParagraphStyle('cell', fontName='Helvetica', fontSize=9.5, textColor=DARK, leading=13),
        'cellB':    ParagraphStyle('cellB', fontName='Helvetica-Bold', fontSize=9.5, textColor=DARK, leading=13),
        'cellMuted':ParagraphStyle('cellMuted', fontName='Helvetica', fontSize=8.5, textColor=MUTED, leading=12),
        'th':       ParagraphStyle('th', fontName='Helvetica-Bold', fontSize=8, textColor=WHITE, leading=11),
        'footer':   ParagraphStyle('footer', fontName='Helvetica', fontSize=8, textColor=MUTED, alignment=TA_CENTER),
        'kat':      ParagraphStyle('kat', fontName='Helvetica-Bold', fontSize=8, textColor=GOLD, leading=11),
    }


def data_table(header: list[str], rows: list[list], col_widths: list[float], s: dict) -> Table:
    head_row = [Paragraph(h, s['th']) for h in header]
    body_rows = [[Paragraph(str(c) if c not in (None, '') else '—', s['cell']) for c in row] for row in rows]
    t = Table([head_row] + body_rows, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), DARK),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, STRIPE]),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    return t


def build_notfall_pdf(db: Session) -> BytesIO:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2.2 * cm, rightMargin=2.2 * cm,
        topMargin=2.2 * cm, bottomMargin=2.2 * cm,
        title='Notfall-Mappe',
    )
    s = styles()
    story = []
    full_width = 17.1 * cm

    # ── Deckblatt ──────────────────────────────────────────────────────────
    story.append(Paragraph('Notfall-Mappe', s['title']))
    story.append(Paragraph(f'Stand: {date.today().strftime("%d.%m.%Y")} &middot; Vertraulich', s['subtitle']))
    story.append(HRFlowable(width='100%', thickness=1.5, color=GOLD, spaceAfter=14))
    story.append(Paragraph(
        'Diese Mappe fasst zusammen, wo im Ernstfall was zu finden ist &mdash; Konten, '
        'Verträge, Ansprechpartner. Sie ersetzt keinen Passwort-Manager: Zugangsdaten '
        'stehen bewusst nicht im Klartext hier, sondern im Passwortsafe, auf den unten '
        'verwiesen wird.', s['lead']))

    # ── Sofortmaßnahmen ────────────────────────────────────────────────────
    sofort = db.query(NotfallEintrag).filter(
        NotfallEintrag.kategorie == 'sofortmassnahme'
    ).order_by(NotfallEintrag.sort_order, NotfallEintrag.titel).all()
    if sofort:
        story.append(Paragraph('Sofortmaßnahmen', s['section']))
        rows = []
        for e in sofort:
            box = '☑' if e.erledigt else '☐'
            titel = f'{box}  {e.titel}'
            hinweis = e.hinweis or ''
            rows.append([Paragraph(titel, s['cellB']), Paragraph(hinweis, s['cellMuted'])])
        t = Table(rows, colWidths=[6.5 * cm, full_width - 6.5 * cm])
        t.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, -2), 0.5, BORDER),
            ('TOPPADDING', (0, 0), (-1, -1), 7),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(t)

    # ── Kontakte ───────────────────────────────────────────────────────────
    kontakte = db.query(Kontakt).order_by(Kontakt.rolle, Kontakt.name).all()
    if kontakte:
        story.append(Paragraph('Wichtige Kontakte', s['section']))
        rows = [[k.name, NF_ROLLE_LABEL.get(k.rolle, k.rolle), k.firma, k.telefon, k.email] for k in kontakte]
        story.append(data_table(
            ['NAME', 'ROLLE', 'FIRMA', 'TELEFON', 'E-MAIL'], rows,
            [3.4 * cm, 3 * cm, 3.7 * cm, 3.3 * cm, 3.7 * cm], s,
        ))

    # ── Konten & Depots ────────────────────────────────────────────────────
    konten = db.query(Konto).order_by(Konto.name).all()
    depots = db.query(Depot).order_by(Depot.name).all()
    if konten or depots:
        story.append(Paragraph('Konten & Depots', s['section']))
        rows = []
        for k in konten:
            typ = KONTO_TYP_LABEL.get(k.typ, k.typ)
            rows.append([k.name, typ, mask_iban(k.iban), k.bitwarden_name or '—'])
        for d in depots:
            rows.append([d.name, 'Depot' + (f' ({d.broker})' if d.broker else ''),
                         mask_iban(d.verrechnungskonto), d.bitwarden_name or '—'])
        story.append(data_table(
            ['NAME', 'TYP', 'IBAN (MASKIERT)', 'SAFE-EINTRAG'], rows,
            [4.3 * cm, 3.8 * cm, 4.3 * cm, 4.7 * cm], s,
        ))
        story.append(Paragraph(
            'Vollständige IBANs, Zugangsdaten und PINs stehen im Passwortsafe unter dem '
            'jeweils genannten Eintrag &mdash; nicht in dieser Mappe.', s['hint']))

    # ── Darlehen ───────────────────────────────────────────────────────────
    darlehen = db.query(Darlehen).order_by(Darlehen.bezeichnung).all()
    if darlehen:
        story.append(Paragraph('Darlehen', s['section']))
        rows = []
        for d in darlehen:
            anteil = float(d.anteil_pct or 100)
            restschuld = f'{float(d.restschuld):,.0f} €'.replace(',', '.')
            if anteil < 100:
                restschuld += f' (davon {anteil:.0f} % eigen)'
            rate = f'{float(d.rate_monatlich):,.0f} € / Mon.'.replace(',', '.')
            rows.append([d.bezeichnung, d.glaeubiger, restschuld, rate])
        story.append(data_table(
            ['BEZEICHNUNG', 'GLÄUBIGER', 'RESTSCHULD', 'RATE'], rows,
            [4.5 * cm, 4.3 * cm, 4.3 * cm, 4 * cm], s,
        ))

    # ── Versicherungen ─────────────────────────────────────────────────────
    versicherungen = db.query(Versicherung).order_by(Versicherung.art, Versicherung.bezeichnung).all()
    if versicherungen:
        story.append(Paragraph('Versicherungen', s['section']))
        rows = [[v.bezeichnung, v.anbieter, v.vertragsnummer, v.kontakt_telefon] for v in versicherungen]
        story.append(data_table(
            ['BEZEICHNUNG', 'ANBIETER', 'VERTRAGSNR.', 'TELEFON'], rows,
            [4.5 * cm, 4.3 * cm, 4.3 * cm, 4 * cm], s,
        ))

    # ── Weitere Notfall-Einträge, nach Kategorie ──────────────────────────
    weitere = db.query(NotfallEintrag).filter(
        NotfallEintrag.kategorie != 'sofortmassnahme'
    ).order_by(NotfallEintrag.kategorie, NotfallEintrag.sort_order, NotfallEintrag.titel).all()
    by_kat: dict[str, list] = {}
    for e in weitere:
        by_kat.setdefault(e.kategorie, []).append(e)
    if by_kat:
        story.append(Paragraph('Weitere Hinweise', s['section']))
        for kat in NF_KAT_ORDER:
            eintraege = by_kat.get(kat)
            if not eintraege:
                continue
            story.append(Paragraph(NF_KAT_LABEL.get(kat, kat).upper(), s['kat']))
            rows = [
                [e.titel, e.verweis, e.hinweis, e.gueltig_bis.strftime('%d.%m.%Y') if e.gueltig_bis else '']
                for e in eintraege
            ]
            story.append(data_table(
                ['TITEL', 'VERWEIS (WO LIEGT ES)', 'HINWEIS', 'GÜLTIG BIS'], rows,
                [4 * cm, 4.3 * cm, 6.3 * cm, 2.5 * cm], s,
            ))
            story.append(Spacer(1, 6))

    # ── Fußzeile ───────────────────────────────────────────────────────────
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=8))
    story.append(Paragraph(
        f'Erstellt von MeinFinanzblick am {date.today().strftime("%d.%m.%Y")} &middot; '
        'nach jeder größeren Änderung neu ausdrucken', s['footer'],
    ))

    doc.build(story)
    buf.seek(0)
    return buf


@router.get('/notfall-pdf')
def export_notfall_pdf(db: Session = Depends(get_db)):
    buf = build_notfall_pdf(db)
    filename = f'Notfall-Mappe_{date.today().isoformat()}.pdf'
    return StreamingResponse(
        buf,
        media_type='application/pdf',
        headers={'Content-Disposition': f'inline; filename="{filename}"'},
    )
