# -*- coding: utf-8 -*-
"""Erstellt die Installationsanleitung fuer MeinFinanzblick als PDF."""
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable, Table, TableStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
# Direkt in den ausgelieferten Ordner schreiben (wird unter /landing/ serviert)
OUT = PROJECT / "docs" / "MeinFinanzblick_Installationsanleitung.pdf"

GOLD    = colors.HexColor("#C9A84C")
DARK    = colors.HexColor("#1A1A1A")
MUTED   = colors.HexColor("#666666")
CODE_BG = colors.HexColor("#2A2A2A")
WHITE   = colors.white
STRIPE  = colors.HexColor("#F9F7F2")
BORDER  = colors.HexColor("#E0DDD5")


def make_styles():
    return {
        "title":    ParagraphStyle("title",    fontName="Helvetica-Bold",    fontSize=22, leading=27, textColor=DARK,  spaceAfter=6,  alignment=TA_LEFT),
        "subtitle": ParagraphStyle("subtitle", fontName="Helvetica",         fontSize=11, leading=15, textColor=MUTED, spaceAfter=14, alignment=TA_LEFT),
        "section":  ParagraphStyle("section",  fontName="Helvetica-Bold",    fontSize=9.5, leading=13, textColor=GOLD, spaceAfter=5, spaceBefore=4),
        "heading":  ParagraphStyle("heading",  fontName="Helvetica-Bold",    fontSize=13, leading=17, textColor=DARK,  spaceAfter=6),
        "body":     ParagraphStyle("body",     fontName="Helvetica",         fontSize=10.5, textColor=DARK, spaceAfter=6, leading=16),
        "hint":     ParagraphStyle("hint",     fontName="Helvetica-Oblique", fontSize=9.5,  textColor=MUTED, spaceAfter=4, leading=14),
        "code":     ParagraphStyle("code",     fontName="Courier-Bold",      fontSize=10.5, textColor=WHITE, spaceAfter=0, leading=16),
        "footer":   ParagraphStyle("footer",   fontName="Helvetica",         fontSize=8.5,  textColor=MUTED, alignment=TA_CENTER),
    }


def code_block(text, s):
    return Table(
        [[Paragraph(text, s["code"])]],
        colWidths=[15.5 * cm],
        style=TableStyle([
            ("BACKGROUND",  (0,0), (-1,-1), CODE_BG),
            ("TOPPADDING",  (0,0), (-1,-1), 10),
            ("BOTTOMPADDING",(0,0),(-1,-1), 10),
            ("LEFTPADDING", (0,0), (-1,-1), 14),
            ("RIGHTPADDING",(0,0), (-1,-1), 14),
        ])
    )


def build():
    doc = SimpleDocTemplate(
        str(OUT), pagesize=A4,
        leftMargin=2.8*cm, rightMargin=2.8*cm,
        topMargin=2.5*cm, bottomMargin=2.5*cm,
    )
    s = make_styles()
    story = []

    # Header
    story.append(Paragraph("MeinFinanzblick", s["title"]))
    story.append(Paragraph("Installationsanleitung &middot; Fuer den ersten Start", s["subtitle"]))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=18))
    story.append(Paragraph(
        "Diese Anleitung fuehrt dich Schritt fuer Schritt durch die Einrichtung. "
        "Du brauchst keinerlei Vorkenntnisse, nur ca. <b>15 Minuten</b> und eine "
        "Internetverbindung. Folge den Schritten einfach der Reihe nach.",
        s["body"]))
    story.append(Spacer(1, 14))

    # Schritt 1
    story.append(Paragraph("SCHRITT 1", s["section"]))
    story.append(Paragraph("Python installieren", s["heading"]))
    story.append(Paragraph(
        "Python ist das Programm, mit dem MeinFinanzblick laeuft. "
        "Oeffne deinen Browser und gehe auf:", s["body"]))
    story.append(Spacer(1, 4))
    story.append(code_block("python.org/downloads", s))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Klicke auf den grossen gelben Knopf <b>Download Python</b>. "
        "Es laedt eine Datei herunter (Endung <b>.pkg</b>). "
        "Doppelklicke sie und klicke dich durch die Installation "
        "&mdash; immer auf <b>Weiter</b> bzw. <b>Fortfahren</b> und am Ende <b>Installieren</b>.", s["body"]))
    story.append(Paragraph(
        "Falls Python schon installiert ist: einfach weiter zu Schritt 2.",
        s["hint"]))
    story.append(Spacer(1, 12))

    # Schritt 2
    story.append(Paragraph("SCHRITT 2", s["section"]))
    story.append(Paragraph("Terminal oeffnen", s["heading"]))
    story.append(Paragraph(
        "Druecke gleichzeitig <b>Command (Cmd) + Leertaste</b>, "
        "tippe <b>Terminal</b> ein und druecke <b>Enter</b>.", s["body"]))
    story.append(Paragraph(
        "Ein Fenster oeffnet sich &mdash; das ist das Terminal. Dort tippst du gleich Befehle ein.",
        s["hint"]))
    story.append(Spacer(1, 12))

    # Schritt 3
    story.append(Paragraph("SCHRITT 3", s["section"]))
    story.append(Paragraph("Entwicklerwerkzeuge installieren (einmalig)", s["heading"]))
    story.append(Paragraph("Tippe den folgenden Befehl <b>exakt so</b> ein und druecke <b>Enter</b>:", s["body"]))
    story.append(Spacer(1, 4))
    story.append(code_block("xcode-select --install", s))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        'Falls ein Fenster aufpoppt: auf "Installieren" klicken und warten '
        '(ca. 2-5 Minuten). Falls die Meldung "already installed" erscheint: '
        'alles gut, weiter zu Schritt 4.', s["hint"]))
    story.append(Spacer(1, 12))

    # Schritt 4
    story.append(Paragraph("SCHRITT 4", s["section"]))
    story.append(Paragraph("App herunterladen", s["heading"]))
    story.append(Paragraph("Tippe diese zwei Zeilen nacheinander ein &mdash; jede mit <b>Enter</b> bestaetigen:", s["body"]))
    story.append(Spacer(1, 4))
    story.append(code_block("git clone https://github.com/SlaEbi/meinfinanzblick.git", s))
    story.append(Spacer(1, 6))
    story.append(code_block("cd meinfinanzblick", s))
    story.append(Spacer(1, 12))

    # Schritt 5
    story.append(Paragraph("SCHRITT 5", s["section"]))
    story.append(Paragraph("App einrichten", s["heading"]))
    story.append(Paragraph("Tippe diesen Befehl ein und druecke <b>Enter</b>:", s["body"]))
    story.append(Spacer(1, 4))
    story.append(code_block("make setup", s))
    story.append(Spacer(1, 6))
    story.append(Paragraph(
        "Das laeuft jetzt automatisch durch und dauert einige Minuten. "
        "Du siehst Haekchen wenn alles klappt. <b>Terminal nicht schliessen</b> waehrend es laeuft.",
        s["hint"]))
    story.append(Spacer(1, 12))

    # Schritt 6
    story.append(Paragraph("SCHRITT 6", s["section"]))
    story.append(Paragraph("App-Symbol in den Programme-Ordner legen", s["heading"]))
    rows = [
        ["1.", "Oeffne den Finder (das blaue Gesicht im Dock)"],
        ["2.", "Navigiere zum Ordner meinfinanzblick (liegt im Benutzerordner)"],
        ["3.", 'Ziehe die Datei MeinFinanzblick.app in den Ordner "Programme" (links in der Seitenleiste)'],
        ["4.", "Fertig &mdash; die App ist jetzt im Launchpad und kann ins Dock gezogen werden"],
    ]
    # Convert hint text to Paragraph for HTML entities
    rows_p = [[c, Paragraph(t, s["body"])] for c, t in rows]
    t = Table(rows_p, colWidths=[0.7*cm, 14.8*cm])
    t.setStyle(TableStyle([
        ("FONTNAME",     (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE",     (0,0), (-1,-1), 10.5),
        ("TEXTCOLOR",    (0,0), (0,-1), GOLD),
        ("TOPPADDING",   (0,0), (-1,-1), 3),
        ("BOTTOMPADDING",(0,0), (-1,-1), 3),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
    ]))
    story.append(t)
    story.append(Spacer(1, 16))

    # Divider
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=14))

    # App starten
    story.append(Paragraph("APP STARTEN", s["section"]))
    story.append(Paragraph(
        "<b>Doppelklick auf MeinFinanzblick.app</b> &mdash; der Browser oeffnet sich automatisch mit der App.",
        s["body"]))
    story.append(Paragraph('Zum Beenden: nochmal Doppelklick &rarr; "Beenden" waehlen.', s["hint"]))
    story.append(Spacer(1, 14))

    # Problemloesungen
    story.append(Paragraph("FALLS ETWAS NICHT FUNKTIONIERT", s["section"]))
    problems = [
        ['"command not found: make"',
         "Schritt 3 nochmal ausfuehren, Terminal neu oeffnen, ab Schritt 4 wiederholen."],
        ['"command not found: python"',
         "Schritt 1 wurde uebersprungen &mdash; Python von python.org installieren, Terminal neu oeffnen."],
        ["Weisser Bildschirm im Browser",
         "Kurz warten (10 Sekunden) und Seite neu laden mit Cmd + R."],
        ["Sonstiges",
         "Den Entwickler kontaktieren &mdash; er hilft sofort weiter."],
    ]
    prob_rows = [[Paragraph(a, ParagraphStyle("pb", fontName="Helvetica-Bold", fontSize=10, textColor=DARK)),
                  Paragraph(b, s["body"])] for a, b in problems]
    pt = Table(prob_rows, colWidths=[5.5*cm, 10*cm])
    pt.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), STRIPE),
        ("TOPPADDING",   (0,0), (-1,-1), 7),
        ("BOTTOMPADDING",(0,0), (-1,-1), 7),
        ("LEFTPADDING",  (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("LINEBELOW",    (0,0), (-1,-2), 0.5, BORDER),
        ("VALIGN",       (0,0), (-1,-1), "TOP"),
    ]))
    story.append(pt)
    story.append(Spacer(1, 22))

    # Footer
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8))
    story.append(Paragraph(
        "MeinFinanzblick &middot; Privates Finanz-Dashboard &middot; Alle Daten bleiben lokal auf deinem Mac",
        s["footer"]))

    doc.build(story)
    print(f"PDF erstellt: {OUT}")


build()
