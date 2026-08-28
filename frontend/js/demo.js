// Demo-Daten für die Vorschau — keine echten Finanzdaten.
// Alle Personen, Kontonummern und Beträge sind frei erfunden.

export const DEMO = {

  konten: [
    { id:1, name:'DKB Girokonto', bank:'DKB', typ:'giro', iban:'DE12 1203 0000 1234 5678 90', saldo:4218.35, waehrung:'EUR', kontoinhaber:'Max Mustermann', notiz:null, bitwarden_name:null, aktualisiert_am:'2026-06-01T10:00:00' },
    { id:2, name:'ING Tagesgeld', bank:'ING', typ:'tagesgeld', iban:'DE98 5002 1000 0099 8765 43', saldo:22500.00, waehrung:'EUR', kontoinhaber:'Max Mustermann', notiz:null, bitwarden_name:null, aktualisiert_am:'2026-06-01T10:00:00' },
    { id:3, name:'Gemeinschaftskonto', bank:'Sparkasse Stuttgart', typ:'giro', iban:'DE71 6005 0101 0001 2345 67', saldo:1847.90, waehrung:'EUR', kontoinhaber:'Max & Julia Mustermann', notiz:null, bitwarden_name:null, aktualisiert_am:'2026-06-01T10:00:00' },
    { id:4, name:'Bargeld / Safe', bank:null, typ:'bargeld', iban:null, saldo:850.00, waehrung:'EUR', kontoinhaber:null, notiz:'Safe im Arbeitszimmer', bitwarden_name:null, aktualisiert_am:'2026-06-01T10:00:00' },
  ],

  darlehen: [
    { id:1, bezeichnung:'Eigenheimkredit', glaeubiger:'DKB Baufinanzierung', urspr_betrag:320000, restschuld:268450, zinssatz:0.0195, rate_monatlich:1290, darlehen_typ:'annuitaet', tilgungsrate_monatlich:null, zinsbindung_bis:'2028-03-01', restlaufzeit:248, sondertilgung_moeglich:true, sondertilgung_betrag:16000, notiz:'Zinsbindung bis März 2028 beachten — rechtzeitig Anschlussfinanzierung prüfen.', anteil_pct:100 },
    { id:2, bezeichnung:'Autokredit BMW', glaeubiger:'VW Bank', urspr_betrag:22000, restschuld:12800, zinssatz:0.039, rate_monatlich:380, darlehen_typ:'annuitaet', tilgungsrate_monatlich:null, zinsbindung_bis:null, restlaufzeit:38, sondertilgung_moeglich:false, sondertilgung_betrag:null, notiz:null, anteil_pct:100 },
  ],

  depots: [
    {
      id:1, name:'Comdirect Depot', broker:'Comdirect', depotinhaber:'Max Mustermann',
      wertpapierdepot_nr:'123456789', depot_bic:'COBADEFFXXX',
      verrechnungskonto:'DE44 2004 1155 0123 4567 89', verrechnungskonto_bic:'COBADEFFXXX',
      auszahlungskonto:null, auszahlungskonto_name:null, auszahlungskonto_bank:null, auszahlungskonto_bic:null,
      wert_aktuell:54320.00, bitwarden_name:null, notiz:'Haupt-ETF-Depot', aktualisiert_am:'2026-06-01T10:00:00',
      positionen: [
        { id:1, depot_id:1, isin:'IE00B4L5Y983', name:'iShares Core MSCI World ETF', anzahl:1200, kurs:39.50, wert:47400 },
        { id:2, depot_id:1, isin:'IE00BKM4GZ66', name:'iShares Core MSCI EM IMI', anzahl:200, kurs:34.60, wert:6920 },
      ],
    },
    {
      id:2, name:'Trade Republic Depot', broker:'Trade Republic', depotinhaber:'Max Mustermann',
      wertpapierdepot_nr:'TR-9876543', depot_bic:null,
      verrechnungskonto:'DE55 5000 1000 0400 0099 88', verrechnungskonto_bic:'SSKMDEMMXXX',
      auszahlungskonto:null, auszahlungskonto_name:null, auszahlungskonto_bank:null, auszahlungskonto_bic:null,
      wert_aktuell:8150.00, bitwarden_name:null, notiz:'Einzelaktien + Bitcoin-ETP', aktualisiert_am:'2026-06-01T10:00:00',
      positionen: [
        { id:3, depot_id:2, isin:'US88160R1014', name:'Tesla Inc.', anzahl:10, kurs:195.40, wert:1954 },
        { id:4, depot_id:2, isin:'US0378331005', name:'Apple Inc.', anzahl:25, kurs:172.80, wert:4320 },
        { id:5, depot_id:2, isin:'IE0003XD1AL2', name:'iShares Bitcoin ETP', anzahl:5, kurs:375.20, wert:1876 },
      ],
    },
  ],

  sachwerte: [
    { id:1, bezeichnung:'Eigenheim Musterstadt', kategorie:'immobilie', beschreibung:'Einfamilienhaus, 140 m², Baujahr 1998', aktueller_wert:420000, anteil_pct:100, anschaffungswert:310000, anschaffungsjahr:2015, aktualisiert_am:'2026-06-01T10:00:00' },
    { id:2, bezeichnung:'BMW 320i (2021)', kategorie:'fahrzeug', beschreibung:'Touring, Automatik, 43.000 km', aktueller_wert:22800, anteil_pct:100, anschaffungswert:38500, anschaffungsjahr:2021, aktualisiert_am:'2026-06-01T10:00:00' },
    { id:3, bezeichnung:'Möbel & Hausrat', kategorie:'sonstiges', beschreibung:null, aktueller_wert:8500, anteil_pct:100, anschaffungswert:null, anschaffungsjahr:null, aktualisiert_am:'2026-06-01T10:00:00' },
  ],

  versicherungen: [
    { id:1, art:'haftpflicht', bezeichnung:'Privathaftpflicht', anbieter:'Allianz', vertragsnummer:'HP-4711-2019', beitrag:78, zahlweise:'jährlich', laufzeit_bis:null, kuendigungsfrist_tage:30, kontakt_telefon:'0800 5352010', kontakt_email:null, notiz:null, erstellt_am:'2026-01-01T00:00:00' },
    { id:2, art:'kfz', bezeichnung:'KFZ-Vollkasko BMW 320i', anbieter:'HUK-Coburg', vertragsnummer:'KFZ-2021-009988', beitrag:1180, zahlweise:'jährlich', laufzeit_bis:null, kuendigungsfrist_tage:30, kontakt_telefon:'0800 2153153', kontakt_email:null, notiz:null, erstellt_am:'2026-01-01T00:00:00' },
    { id:3, art:'leben', bezeichnung:'Berufsunfähigkeitsversicherung', anbieter:'AXA', vertragsnummer:'BU-22-3344556', beitrag:89, zahlweise:'monatlich', laufzeit_bis:'2045-12-31', kuendigungsfrist_tage:60, kontakt_telefon:'0180 5592592', kontakt_email:null, notiz:'Berufsunfähigkeit ab 50 % Einkommensausfall', erstellt_am:'2026-01-01T00:00:00' },
    { id:4, art:'kranken', bezeichnung:'Krankenzusatz (Zahn + Sehhilfe)', anbieter:'DKV', vertragsnummer:'DKV-77-88990', beitrag:45, zahlweise:'monatlich', laufzeit_bis:null, kuendigungsfrist_tage:30, kontakt_telefon:'0800 3746246', kontakt_email:null, notiz:null, erstellt_am:'2026-01-01T00:00:00' },
    { id:5, art:'haus', bezeichnung:'Hausratsversicherung', anbieter:'Allianz', vertragsnummer:'HR-2019-55661', beitrag:180, zahlweise:'jährlich', laufzeit_bis:'2026-09-30', kuendigungsfrist_tage:30, kontakt_telefon:'0800 5352010', kontakt_email:null, notiz:null, erstellt_am:'2026-01-01T00:00:00' },
  ],

  vertraege: [
    { id:1, art:'internet', bezeichnung:'DSL 250 + MagentaTV', anbieter:'Telekom', vertragsnummer:'TEL-4433221', kosten:59.95, zahlweise:'monatlich', laufzeit_bis:'2026-08-31', kuendigungsfrist_tage:30, notiz:'Preiserhöhung wurde angekündigt — Alternativen prüfen', erstellt_am:'2026-01-01T00:00:00' },
    { id:2, art:'strom', bezeichnung:'Ökostrom', anbieter:'Vattenfall', vertragsnummer:'VS-2025-10099', kosten:98.00, zahlweise:'monatlich', laufzeit_bis:'2026-12-31', kuendigungsfrist_tage:30, notiz:null, erstellt_am:'2026-01-01T00:00:00' },
    { id:3, art:'streaming', bezeichnung:'Netflix Standard', anbieter:'Netflix', vertragsnummer:null, kosten:15.99, zahlweise:'monatlich', laufzeit_bis:null, kuendigungsfrist_tage:0, notiz:null, erstellt_am:'2026-01-01T00:00:00' },
    { id:4, art:'streaming', bezeichnung:'Spotify Family', anbieter:'Spotify', vertragsnummer:null, kosten:16.99, zahlweise:'monatlich', laufzeit_bis:null, kuendigungsfrist_tage:0, notiz:null, erstellt_am:'2026-01-01T00:00:00' },
    { id:5, art:'gym', bezeichnung:'FitnessFirst Mitgliedschaft', anbieter:'FitnessFirst', vertragsnummer:'FF-M-889977', kosten:49.90, zahlweise:'monatlich', laufzeit_bis:'2026-12-31', kuendigungsfrist_tage:30, notiz:null, erstellt_am:'2026-01-01T00:00:00' },
  ],

  kontakte: [
    { id:1, name:'Sandra Becker', rolle:'steuerberater', firma:'Steuerkanzlei Becker & Partner', telefon:'0711 12345-0', email:'s.becker@steuerkanzlei-becker.de', adresse:'Königstraße 45, 70173 Stuttgart', notiz:'Mandant seit 2018', erstellt_am:'2026-01-01T00:00:00' },
    { id:2, name:'Dr. Thomas Müller', rolle:'notar', firma:'Notariat Dr. Müller', telefon:'0711 54321-0', email:'kanzlei@notar-mueller-stuttgart.de', adresse:'Calwer Str. 11, 70173 Stuttgart', notiz:'Testament + Grundbucheintragung', erstellt_am:'2026-01-01T00:00:00' },
    { id:3, name:'Kundenservice DKB', rolle:'bank', firma:'DKB AG', telefon:'030 12030-0', email:'service@dkb.de', adresse:'Taubenstraße 7–9, 10117 Berlin', notiz:null, erstellt_am:'2026-01-01T00:00:00' },
    { id:4, name:'Markus Engel', rolle:'versicherung', firma:'Allianz Generalvertretung Engel', telefon:'0172 9876543', email:'m.engel@allianz.de', adresse:'Gerberstraße 3, 70178 Stuttgart', notiz:'Zuständig für Haftpflicht + Hausrat', erstellt_am:'2026-01-01T00:00:00' },
  ],

  todos: [
    { id:1, titel:'Steuerunterlagen 2025 zusammenstellen', notiz:'Belege für die Steuerberaterin sortieren', faelligkeit:'2026-09-30', prioritaet:'hoch', zustaendigkeit:'ich', erledigt:false, sort_order:0, erstellt_am:'2026-06-01T09:00:00' },
    { id:2, titel:'KFZ-Versicherung vergleichen', notiz:null, faelligkeit:'2026-10-15', prioritaet:'mittel', zustaendigkeit:'beide', erledigt:false, sort_order:1, erstellt_am:'2026-06-01T09:00:00' },
    { id:3, titel:'Rauchmelder-Batterien wechseln', notiz:null, faelligkeit:null, prioritaet:'niedrig', zustaendigkeit:'ehefrau', erledigt:false, sort_order:2, erstellt_am:'2026-06-01T09:00:00' },
    { id:4, titel:'ETF-Sparplanrate ab Juli erhöhen', notiz:'Von 500 € auf 600 € anheben', faelligkeit:'2026-07-01', prioritaet:'mittel', zustaendigkeit:'ich', erledigt:true, sort_order:3, erstellt_am:'2026-05-01T09:00:00' },
    { id:5, titel:'Hausratversicherung: Deckungssumme prüfen', notiz:null, faelligkeit:'2026-08-01', prioritaet:'niedrig', zustaendigkeit:'ich', erledigt:true, sort_order:4, erstellt_am:'2026-05-01T09:00:00' },
  ],

  steuerbescheide: [
    {
      id:2, jahr:2024, bescheiddatum:'2025-08-15', veranlagung:'zusammen', vorlaeufig:false,
      einkuenfte_gewerbebetrieb:71000, einkuenfte_gewerbebetrieb_ehefrau:0, einkuenfte_nichtselbststaendig_ehefrau:14800,
      einkuenfte_vermietung:3400, einkuenfte_sonstige:0, gesamtbetrag_einkuenfte:89200,
      zu_versteuerndes_einkommen:79300, kinderfreibetraege:8500,
      est_tariflich:15680, anrechnung_35:2470, kindergeld_hinzurechnung:0, einkommensteuer:13140, soli:0, kirchensteuer:0,
      gewerbesteuermessbetrag:650, gewerbesteuer:2516,
      steuerabzugsbetraege:180, vorauszahlungen_gesamt:11200, nachzahlungszinsen:0, nachzahlung_erstattung:1760,
      vz_folgejahr_quartal:3300, notiz:null, aktualisiert_am:'2025-08-20T10:00:00',
      gemeinden: [
        { id:1, gemeinde:'Lindenau', arbeitsloehne:45000, zerlegungsanteil:64.3, hebesatz:380, gewerbesteuer:1588 },
        { id:2, gemeinde:'Rosenfeld', arbeitsloehne:25000, zerlegungsanteil:35.7, hebesatz:400, gewerbesteuer:928 },
      ],
    },
    {
      id:1, jahr:2023, bescheiddatum:'2024-09-10', veranlagung:'zusammen', vorlaeufig:false,
      einkuenfte_gewerbebetrieb:61000, einkuenfte_gewerbebetrieb_ehefrau:0, einkuenfte_nichtselbststaendig_ehefrau:13600,
      einkuenfte_vermietung:2900, einkuenfte_sonstige:0, gesamtbetrag_einkuenfte:77500,
      zu_versteuerndes_einkommen:69200, kinderfreibetraege:8300,
      est_tariflich:12920, anrechnung_35:2180, kindergeld_hinzurechnung:0, einkommensteuer:10740, soli:0, kirchensteuer:0,
      gewerbesteuermessbetrag:560, gewerbesteuer:2180,
      steuerabzugsbetraege:150, vorauszahlungen_gesamt:9600, nachzahlungszinsen:0, nachzahlung_erstattung:990,
      vz_folgejahr_quartal:2800, notiz:null, aktualisiert_am:'2024-09-15T10:00:00',
      gemeinden: [
        { id:3, gemeinde:'Lindenau', arbeitsloehne:40000, zerlegungsanteil:66.7, hebesatz:380, gewerbesteuer:1420 },
        { id:4, gemeinde:'Rosenfeld', arbeitsloehne:20000, zerlegungsanteil:33.3, hebesatz:400, gewerbesteuer:760 },
      ],
    },
  ],

  sparziele: [
    {
      id:1, name:'Neues Auto', zielbetrag:25000, zieldatum:'2027-06-01', zinssatz:0.02,
      aufbewahrungsort:'Tagesgeldkonto ING', notiz:null, archiviert:false,
      fuetterungen: [
        { id:1, betrag:5000, datum:'2025-09-01', notiz:'Startkapital' },
        { id:2, betrag:500,  datum:'2026-01-15', notiz:null },
        { id:3, betrag:500,  datum:'2026-02-15', notiz:null },
        { id:4, betrag:500,  datum:'2026-03-15', notiz:null },
      ],
      aktueller_stand:6500, restbetrag:18500, fortschritt_pct:26.0, monate_bis_ziel:10, benoetigte_monatsrate:1850,
      aktualisiert_am:'2026-06-01T10:00:00',
    },
    {
      id:2, name:'Urlaub Portugal', zielbetrag:4000, zieldatum:'2027-03-01', zinssatz:0,
      aufbewahrungsort:'Sparbuch', notiz:'Familienurlaub im Frühjahr', archiviert:false,
      fuetterungen: [
        { id:5, betrag:2000, datum:'2026-01-01', notiz:'Anzahlung Flüge' },
        { id:6, betrag:1400, datum:'2026-05-01', notiz:null },
      ],
      aktueller_stand:3400, restbetrag:600, fortschritt_pct:85.0, monate_bis_ziel:7, benoetigte_monatsrate:86,
      aktualisiert_am:'2026-06-01T10:00:00',
    },
  ],

  notfall: [
    { id:1, titel:'Online-Banking-Zugänge', kategorie:'zugaenge', verweis:'1Password – Tresor „Finanzen"', hinweis:'Notfallzugang für Julia im Safe (Kuvert mit 1Password-Masterpasswort)', prioritaet:1, erledigt:false, sort_order:0, erstellt_am:'2026-01-01T00:00:00' },
    { id:2, titel:'Depot-Zugänge (Comdirect + Trade Republic)', kategorie:'zugaenge', verweis:'1Password – Tresor „Depots"', hinweis:'TANs per SMS an Handy 0171-xxx → SIM-Karte im Safe', prioritaet:1, erledigt:false, sort_order:1, erstellt_am:'2026-01-01T00:00:00' },
    { id:3, titel:'Versicherungspolicen', kategorie:'dokumente', verweis:'Ordner „Versicherungen" im Arbeitszimmer (oberes Regal)', hinweis:null, prioritaet:2, erledigt:false, sort_order:2, erstellt_am:'2026-01-01T00:00:00' },
    { id:4, titel:'Steuerberater kontaktieren', kategorie:'finanzen', verweis:'Kontaktliste in diesem Tool', hinweis:'Sandra Becker, 0711 12345-0 – kennt alle Unterlagen', prioritaet:2, erledigt:false, sort_order:3, erstellt_am:'2026-01-01T00:00:00' },
    { id:5, titel:'Testament + Vorsorgevollmacht', kategorie:'dokumente', verweis:'Notariat Dr. Müller (Original) + Kopie im Safe', hinweis:'Vorsorgevollmacht gegenseitig – auch beim Notar hinterlegt', prioritaet:1, erledigt:false, sort_order:4, erstellt_am:'2026-01-01T00:00:00' },
    { id:6, titel:'WLAN-Passwort + Router-Admin', kategorie:'digital', verweis:'Kleines Heft in Schreibtischschublade (links)', hinweis:null, prioritaet:3, erledigt:false, sort_order:5, erstellt_am:'2026-01-01T00:00:00' },
  ],

  networth: {
    aktuell: {
      summe_konten:        29416.25,
      summe_depots:        62470.00,
      summe_sachvermoegen: 451300.00,
      summe_schulden:      281250.00,
      vermoegen_brutto:    543186.25,
      netto:               261936.25,
    },
    verlauf: [
      { id:1,  datum:'2025-05-01', summe_vermoegen:476200, summe_schulden:291800, netto:184400 },
      { id:2,  datum:'2025-06-01', summe_vermoegen:481500, summe_schulden:290100, netto:191400 },
      { id:3,  datum:'2025-07-01', summe_vermoegen:487800, summe_schulden:288400, netto:199400 },
      { id:4,  datum:'2025-08-01', summe_vermoegen:494300, summe_schulden:286700, netto:207600 },
      { id:5,  datum:'2025-09-01', summe_vermoegen:502100, summe_schulden:285000, netto:217100 },
      { id:6,  datum:'2025-10-01', summe_vermoegen:509400, summe_schulden:283400, netto:226000 },
      { id:7,  datum:'2025-11-01', summe_vermoegen:518700, summe_schulden:281700, netto:237000 },
      { id:8,  datum:'2025-12-01', summe_vermoegen:512300, summe_schulden:284500, netto:227800 },
      { id:9,  datum:'2026-01-01', summe_vermoegen:524800, summe_schulden:283800, netto:241000 },
      { id:10, datum:'2026-02-01', summe_vermoegen:533100, summe_schulden:283200, netto:249900 },
      { id:11, datum:'2026-03-01', summe_vermoegen:537400, summe_schulden:282500, netto:254900 },
      { id:12, datum:'2026-04-01', summe_vermoegen:540200, summe_schulden:281900, netto:258300 },
      { id:13, datum:'2026-05-01', summe_vermoegen:542100, summe_schulden:281550, netto:260550 },
      { id:14, datum:'2026-06-01', summe_vermoegen:543186, summe_schulden:281250, netto:261936 },
    ],
  },

  spending: {
    id:1,
    name:'Conscious Spending Plan 2026',
    stand:'2026-01-01',
    brutto_monatlich:8200,
    netto_monatlich:5800,
    sonstiges_puffer_pct:0.05,
    ist_aktiv:true,
    erstellt_am:'2026-01-01T00:00:00',
    positionen: [
      // ── Fixkosten ──
      { id:1,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'Eigenheimkredit Rate',          betrag:1290,  sort_order:0 },
      { id:2,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'Strom (Ökostrom)',               betrag:98,    sort_order:1 },
      { id:3,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'Gas / Heizung',                  betrag:85,    sort_order:2 },
      { id:4,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'DSL & TV (Telekom)',             betrag:59.95, sort_order:3 },
      { id:5,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'Lebensmittel & Drogerie',        betrag:650,   sort_order:4 },
      { id:6,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'Versicherungen (monatl. Anteil)',betrag:195,   sort_order:5 },
      { id:7,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'KFZ-Kraftstoff',                betrag:120,   sort_order:6 },
      { id:8,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'Telefon / Handy',                betrag:60,    sort_order:7 },
      { id:9,  plan_id:1, kategorie:'fixkosten',   bezeichnung:'GEZ / Rundfunkbeitrag',          betrag:18.36, sort_order:8 },
      { id:10, plan_id:1, kategorie:'fixkosten',   bezeichnung:'Kindergeld zurücklegen',         betrag:150,   sort_order:9 },
      // ── Investments ──
      { id:11, plan_id:1, kategorie:'investments', bezeichnung:'ETF-Sparplan Comdirect',         betrag:500,   sort_order:0 },
      { id:12, plan_id:1, kategorie:'investments', bezeichnung:'Tagesgeld-Sparrate ING',         betrag:300,   sort_order:1 },
      // ── Sparziele ──
      { id:13, plan_id:1, kategorie:'sparziele',   bezeichnung:'Urlaubs-Kasse',                  betrag:200,   sort_order:0 },
      { id:14, plan_id:1, kategorie:'sparziele',   bezeichnung:'Instandhaltungsrücklage Haus',   betrag:150,   sort_order:1 },
      // ── GFS ──
      { id:15, plan_id:1, kategorie:'gfs',         bezeichnung:'Restaurants & Ausgehen',         betrag:250,   sort_order:0 },
      { id:16, plan_id:1, kategorie:'gfs',         bezeichnung:'Kleidung & Schuhe',              betrag:120,   sort_order:1 },
      { id:17, plan_id:1, kategorie:'gfs',         bezeichnung:'Streaming & Abos',               betrag:33,    sort_order:2 },
      { id:18, plan_id:1, kategorie:'gfs',         bezeichnung:'Freizeit & Hobbys',              betrag:200,   sort_order:3 },
      { id:19, plan_id:1, kategorie:'gfs',         bezeichnung:'Fitnessstudio',                  betrag:49.90, sort_order:4 },
      { id:20, plan_id:1, kategorie:'gfs',         bezeichnung:'Urlaub (monatl. Anteil)',        betrag:250,   sort_order:5 },
      { id:21, plan_id:1, kategorie:'gfs',         bezeichnung:'Sonstiges / Puffer',             betrag:170.79,sort_order:6 },
    ],
  },

};
