import { api } from './api.js?v=16';
import { DEMO } from './demo.js?v=2';

// ── Formatierung ────────────────────────────────────────────────────────────

const fmt = {
  // Zeigt Cent nur, wenn welche vorhanden sind ("43,49 €", aber "18.138 €" bleibt
  // glatt) — rundet also nie echte Cent-Beträge unsichtbar weg. Zeigt bei Cent
  // immer beide Nachkommastellen ("89,90 €", nie "89,9 €"). Für Tabellen,
  // Summenzeilen und alles, wo ein Betrag exakt stimmen muss.
  eur: (v) => {
    const hatCent = Math.round((v ?? 0) * 100) % 100 !== 0;
    return new Intl.NumberFormat('de-DE', {
      style: 'currency', currency: 'EUR',
      minimumFractionDigits: hatCent ? 2 : 0, maximumFractionDigits: 2
    }).format(v ?? 0);
  },

  // Rundet immer auf ganze Euro — bewusst ungenau, nur für die großen
  // Dashboard-Kacheln, wo es um die Größenordnung geht, nicht um den Cent.
  eurKurz: (v) => new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(v ?? 0),

  pct: (v) => new Intl.NumberFormat('de-DE', {
    style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format((v ?? 0) / 100),

  date: (v) => v ? new Date(v).toLocaleDateString('de-DE') : '—',

  dateISO: (v) => {
    if (!v) return '';
    return v.substring(0, 10);
  },
};

// ── Konto-Typ Labels ─────────────────────────────────────────────────────────

const KONTO_TYP_LABEL = {
  giro:       'Girokonto',
  tagesgeld:  'Tagesgeldkonto',
  festgeld:   'Festgeld',
  sparkonto:  'Sparkonto',
  bargeld:    'Bargeld / Safe',
  sonstige:   'Sonstige',
};

// ── Anhang-Helper ─────────────────────────────────────────────────────────────

const ANHANG_ICON_PDF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M9 15h6M9 11h3"/></svg>`;
const ANHANG_ICON_IMG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

async function loadAnhaenge(entityTyp, entityId) {
  const container = document.getElementById(`anhang-container-${entityTyp}-${entityId}`);
  if (!container) return;

  let anhaenge = [];
  try { anhaenge = await api.anhaenge.list(entityTyp, entityId); } catch {}

  const listHtml = anhaenge.length
    ? anhaenge.map(a => {
        const icon = (a.mime_type || '').includes('pdf') ? ANHANG_ICON_PDF : ANHANG_ICON_IMG;
        return `<div class="anhang-item">
          ${icon}
          <a href="/api/v1/anhaenge/datei/${a.id}" target="_blank" rel="noopener">${escapeHtml(a.original_name)}</a>
          <button class="btn-icon danger" onclick="deleteAnhang(${a.id},'${entityTyp}',${entityId})" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>`;
      }).join('')
    : '<p class="form-hint" style="margin:0">Keine Anhänge vorhanden.</p>';

  container.innerHTML = `
    <div class="anhang-list">${listHtml}</div>
    <div class="anhang-upload">
      <label class="btn-anhang-upload">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Anhang hinzufügen
        <input type="file" accept=".pdf,.jpg,.jpeg,.png" style="display:none"
          onchange="uploadAnhang('${entityTyp}',${entityId},this)">
      </label>
      <span class="form-hint" style="margin:0">PDF, JPG, PNG — max. 20 MB</span>
    </div>`;
}

window.deleteAnhang = async function(anhangId, entityTyp, entityId) {
  if (!confirm('Anhang wirklich löschen?')) return;
  try {
    await api.anhaenge.delete(anhangId);
    toast('Anhang gelöscht.');
    await loadAnhaenge(entityTyp, entityId);
  } catch (e) { toast(e.message); }
};

window.uploadAnhang = async function(entityTyp, entityId, input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    await api.anhaenge.upload(entityTyp, entityId, file);
    toast('Anhang hochgeladen.');
    await loadAnhaenge(entityTyp, entityId);
  } catch (e) { toast(e.message); }
};

function anhangPlaceholderHtml(entityTyp, entityId) {
  if (!entityId) {
    return `<p class="form-hint">Anhänge können nach dem ersten Speichern hinzugefügt werden.</p>`;
  }
  return `<div id="anhang-container-${entityTyp}-${entityId}"><p class="form-hint">Lädt…</p></div>`;
}

// ── Chart-Helfer ─────────────────────────────────────────────────────────────

// Liest eine CSS-Variable aus dem Theme
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// Setzt den Füllstand eines Reglers als CSS-Variable, damit die Strecke links
// vom Griff im Akzentton liegt (nativ wäre sie browserblau). Muss auch nach
// einer Änderung von min/max erneut laufen.
function syncRangeFill(el) {
  if (!el) return;
  const min = Number(el.min) || 0;
  const max = Number(el.max);
  const span = max - min;
  const pct = span > 0 ? ((Number(el.value) - min) / span) * 100 : 0;
  el.style.setProperty('--range-pct', `${Math.max(0, Math.min(100, pct))}%`);
}

document.addEventListener('input', (e) => {
  if (e.target.classList?.contains('range-slider')) syncRangeFill(e.target);
});

// Beide Rechner starten immer heute, Planjahr 1 endet also im nächsten
// Kalenderjahr. Echte Jahreszahlen sind über 25–30 Jahre hinweg deutlich
// greifbarer als "J. 1" — man sieht sofort, wann man wo steht.
function planKalenderjahr(jahr) {
  return new Date().getFullYear() + jahr;
}

// Achsenkonfiguration für die Jahres-Achse der Rechner-Charts: vierstellige
// Jahreszahlen brauchen mehr Platz als "J. 1", darum nicht kippen, sondern
// ausdünnen.
// Legendentext der Rechner-Charts: war mit 10px in Wash-Grau auf dem dunklen
// Kartenhintergrund kaum lesbar. Etwas größer, heller und mit dickerem
// Linien-Swatch, damit Farbe und Beschriftung beide auf den ersten Blick
// zuzuordnen sind.
function legendLabels(theme) {
  return {
    font: { family: "'JetBrains Mono', monospace", size: 11, weight: '500' },
    color: theme.text,
    usePointStyle: true,
    pointStyle: 'line',
    boxWidth: 20,
    boxHeight: 3,
    padding: 16,
  };
}

function jahresAchse(theme) {
  return {
    ticks: {
      font: { family: "'JetBrains Mono', monospace", size: 10 },
      color: theme.grey,
      maxTicksLimit: 10,
      maxRotation: 0,
      autoSkip: true,
    },
    grid: { display: false },
  };
}

function chartTheme() {
  return {
    accent:  cssVar('--seal-red', '#C9A84C'),
    grey:    cssVar('--wash-grey', '#888888'),
    text:    cssVar('--ink-black', '#F0F0EE'),
    grid:    'rgba(255,255,255,0.06)',
    font:    cssVar('--font-serif', 'sans-serif'),
  };
}

// Farbpalette für Donut-/Schulden-Charts — hellere, gesättigte Varianten,
// abgestimmt auf den dunklen Kartenhintergrund (#242424).
// Hue-divers statt monochrom — klare Unterscheidbarkeit.
const PALETTE = {
  donut:    ['#4DA8E0', '#6DC44E', '#F0A030'],
  schulden: ['#E04848', '#4DA8E0', '#6DC44E', '#F0A030', '#A880D8', '#C09060'],
};
// Trenn-Farbe zwischen Segmenten (= Hintergrundsfarbe der Chart-Karte)
function segmentBorder() {
  return cssVar('--surface', '#242424');
}

// Blendet eine Leer-Meldung ein/aus, OHNE das Canvas zu zerstören.
// Gibt true zurück, wenn Daten vorhanden sind (Chart soll gezeichnet werden).
function chartEmptyState(canvasId, isEmpty, message) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return false;
  const wrap = canvas.parentElement;
  let overlay = wrap.querySelector('.chart-empty');
  if (isEmpty) {
    canvas.style.display = 'none';
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'chart-empty';
      wrap.appendChild(overlay);
    }
    overlay.textContent = message;
    overlay.style.display = '';
    return false;
  }
  canvas.style.display = '';
  if (overlay) overlay.remove();
  return true;
}

// ── Finanzmathematik ─────────────────────────────────────────────────────────

// Annuitäts-Restlaufzeit in Monaten.
// zinssatz als Dezimalwert (0.035 = 3,5 %). Gibt {monate} oder {fehler} zurück.
function restlaufzeitMonate(restschuld, zinssatz, rate) {
  if (!restschuld || !rate) return { fehler: 'unvollstaendig' };
  const r = zinssatz / 12;
  if (r <= 0) return { monate: Math.ceil(restschuld / rate) };
  const zinsAnteil = restschuld * r;
  if (rate <= zinsAnteil) return { fehler: 'rate_zu_niedrig' };
  return { monate: Math.ceil(Math.log(rate / (rate - zinsAnteil)) / Math.log(1 + r)) };
}

function formatRestlaufzeit(monate) {
  const jahre  = Math.floor(monate / 12);
  const monRest = monate % 12;
  return jahre > 0
    ? `${jahre} Jahr${jahre !== 1 ? 'e' : ''} ${monRest > 0 ? monRest + ' Monat' + (monRest !== 1 ? 'e' : '') : ''}`.trim()
    : `${monate} Monat${monate !== 1 ? 'e' : ''}`;
}

// ── State ───────────────────────────────────────────────────────────────────

const state = {
  view: 'dashboard',
  demoMode: sessionStorage.getItem('mfb-demo') === '1',
  konten: [],
  darlehen: [],
  depots: [],
  sachwerte: [],
  versicherungen: [],
  vertraege: [],
  kontakte: [],
  notfall: [],
  todos: [],
  sparziele: [],
  steuerbescheide: [],
  networth: null,
  charts: {},
  editingId: null,
};

// ── Toast ───────────────────────────────────────────────────────────────────

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ── Navigation ──────────────────────────────────────────────────────────────

function navigate(view) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(el => {
    const dv = el.dataset.view;
    el.classList.toggle('active', dv === view || (dv === 'rechner' && view.startsWith('rechner-')));
  });
  document.querySelectorAll('.view').forEach(el => {
    el.classList.toggle('active', el.id === `view-${view}`);
  });
  renderCurrentView();
}

// ── Daten laden ─────────────────────────────────────────────────────────────

async function loadAll() {
  if (state.demoMode) {
    state.konten         = DEMO.konten;
    state.darlehen       = DEMO.darlehen;
    state.depots         = DEMO.depots;
    state.sachwerte      = DEMO.sachwerte;
    state.versicherungen = DEMO.versicherungen;
    state.vertraege      = DEMO.vertraege;
    state.kontakte       = DEMO.kontakte;
    state.notfall        = DEMO.notfall;
    state.networth       = DEMO.networth;
    state.todos          = DEMO.todos;
    state.steuerbescheide = DEMO.steuerbescheide;
    state.sparziele      = DEMO.sparziele;
    return;
  }
  const [konten, darlehen, depots, sachwerte, versicherungen, vertraege, kontakte, notfall, networth, todos, steuerbescheide, sparziele] = await Promise.all([
    api.konten.list(),
    api.darlehen.list(),
    api.depots.list(),
    api.sachvermoegen.list(),
    api.versicherungen.list(),
    api.vertraege.list(),
    api.kontakte.list(),
    api.notfall.list(),
    api.networth.get(),
    api.todos.list(),
    api.steuerbescheide.list(),
    api.sparziele.list(),
  ]);
  state.konten         = konten;
  state.darlehen       = darlehen;
  state.depots         = depots;
  state.sachwerte      = sachwerte;
  state.versicherungen = versicherungen;
  state.vertraege      = vertraege;
  state.kontakte       = kontakte;
  state.notfall        = notfall;
  state.networth       = networth;
  state.todos          = todos;
  state.steuerbescheide = steuerbescheide;
  state.sparziele      = sparziele;
}

function renderCurrentView() {
  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'konten')    renderKonten();
  if (state.view === 'darlehen')  renderDarlehen();
  if (state.view === 'depots')    renderDepots();
  if (state.view === 'sachwerte')      renderSachwerte();
  if (state.view === 'spending')       renderSpending();
  if (state.view === 'sparziele')      renderSparziele();
  if (state.view === 'versicherungen') renderVersicherungen();
  if (state.view === 'vertraege')      renderVertraege();
  if (state.view === 'steuern')        renderSteuern();
  if (state.view === 'rechner-zinseszins')     renderRechnerZinseszins();
  if (state.view === 'rechner-darlehen')       renderRechnerDarlehen();
  if (state.view === 'rechner-kapitalentnahme') renderRechnerKapitalentnahme();
  if (state.view === 'notfall')        renderNotfall();
  if (state.view === 'todos')          renderTodos();
}

// ── Dashboard ───────────────────────────────────────────────────────────────

function renderDashboard() {
  const nw = state.networth?.aktuell ?? {};
  const netto = nw.netto ?? 0;

  // Hero
  document.getElementById('nw-netto').textContent          = fmt.eurKurz(netto);
  document.getElementById('nw-konten').textContent         = fmt.eurKurz(nw.summe_konten ?? 0);
  document.getElementById('nw-depots').textContent         = fmt.eurKurz(nw.summe_depots ?? 0);
  document.getElementById('nw-sachvermoegen').textContent  = fmt.eurKurz(nw.summe_sachvermoegen ?? 0);
  document.getElementById('nw-schulden').textContent       = fmt.eurKurz(nw.summe_schulden ?? 0);

  // Netto-Klasse
  const heroEl = document.getElementById('nw-netto');
  heroEl.className = 'card-value hero mono ' + (netto >= 0 ? '' : 'negative');

  // Fristen & Warnungen
  renderDashboardWarnings();

  // Charts zeichnen
  renderDonutChart();
  renderSchuldenChart();
  renderVerlaufChart();

  // Quick-Listen
  renderDashboardKonten();
  renderDashboardDarlehen();
}

// ── Fristen & Warnungen ───────────────────────────────────────────────────────

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.floor((d - t) / 86400000);
}

function kuendigungDeadline(item) {
  if (!item.laufzeit_bis || !item.kuendigungsfrist_tage) return null;
  const d = new Date(item.laufzeit_bis);
  d.setDate(d.getDate() - item.kuendigungsfrist_tage);
  return d;
}

// Icons (Lucide, inline)
const WARN_ICONS = {
  car:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 002 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  file:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  percent:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  bell:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 01-3.4 0"/></svg>',
  clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

// ── Aktualität ──────────────────────────────────────────────────────────────
// Das Leitprinzip der App ist "einmal im Monat pflegen" — ohne einen Hinweis
// sieht ein acht Monate alter Depotwert genauso aktuell aus wie einer von
// gestern. STALE_TAGE ist bewusst etwas über einem Monat, damit ein normaler
// Pflege-Rhythmus nicht ständig als "veraltet" markiert wird.
const STALE_TAGE = 45;

function istVeraltet(dateStr) {
  const days = daysUntil(dateStr);
  return days !== null && days < -STALE_TAGE;
}

// Datum unter einem Wert (Konten-/Depot-Tabelle) — färbt sich, wenn der Wert
// länger als STALE_TAGE nicht aktualisiert wurde.
function aktualisiertHtml(dateStr) {
  const veraltet = istVeraltet(dateStr);
  const style = veraltet
    ? `color:#F87171;font-weight:500`
    : `color:var(--wash-grey);font-weight:400`;
  const titel = veraltet ? ' title="Seit über 45 Tagen nicht aktualisiert"' : '';
  return `<br><span class="mono" style="font-size:0.72rem;${style}"${titel}>${fmt.date(dateStr)}</span>`;
}

function collectStaleWarnings() {
  const out = [];
  for (const k of state.konten ?? []) {
    if (!istVeraltet(k.aktualisiert_am)) continue;
    out.push({ typ: 'Wert veraltet', icon: WARN_ICONS.clock, name: k.name, days: daysUntil(k.aktualisiert_am), datum: k.aktualisiert_am, view: 'konten' });
  }
  for (const d of state.depots ?? []) {
    if (!istVeraltet(d.aktualisiert_am)) continue;
    out.push({ typ: 'Wert veraltet', icon: WARN_ICONS.clock, name: d.name, days: daysUntil(d.aktualisiert_am), datum: d.aktualisiert_am, view: 'depots' });
  }
  return out;
}

// Glocken-Toggle für Kündigungsfrist-Erinnerung im Formular
function fristBellHtml(active) {
  const on = active === true;
  return `<button type="button" id="f-frist-bell" class="frist-bell${on ? ' active' : ''}"
    data-active="${on}" onclick="toggleFristBell(this)"
    title="Erinnerung an Kündigungsfrist im Dashboard anzeigen">${WARN_ICONS.bell}</button>`;
}

window.toggleFristBell = function(btn) {
  const next = btn.dataset.active !== 'true';
  btn.dataset.active = next;
  btn.classList.toggle('active', next);
};

function collectWarnings() {
  const out = [];

  // TÜV (nur Fahrzeuge) — bis 60 Tage vorher; überfällig immer zeigen (Pflicht)
  for (const s of state.sachwerte ?? []) {
    if (s.kategorie !== 'fahrzeug' || !s.naechster_tuev) continue;
    const days = daysUntil(s.naechster_tuev);
    if (days === null || days > 60) continue;
    out.push({ typ: 'TÜV fällig', icon: WARN_ICONS.car, name: s.bezeichnung, days, datum: s.naechster_tuev, view: 'sachwerte' });
  }

  // Kündigungsfristen Versicherungen — nur mit aktivierter Glocke; Fenster -30…60 Tage
  for (const v of state.versicherungen ?? []) {
    if (!v.frist_erinnerung) continue;
    const days = vsDaysTillKuendigung(v);
    if (days === null || days > 60 || days < -30) continue;
    out.push({ typ: 'Kündigungsfrist', icon: WARN_ICONS.shield, name: v.bezeichnung, days, datum: kuendigungDeadline(v), view: 'versicherungen' });
  }

  // Kündigungsfristen Verträge — nur mit aktivierter Glocke
  for (const v of state.vertraege ?? []) {
    if (!v.frist_erinnerung) continue;
    const days = vsDaysTillKuendigung(v);
    if (days === null || days > 60 || days < -30) continue;
    out.push({ typ: 'Kündigungsfrist', icon: WARN_ICONS.file, name: v.bezeichnung, days, datum: kuendigungDeadline(v), view: 'vertraege' });
  }

  // Zinsbindung Darlehen — bis 90 Tage vorher, nicht länger als 30 Tage überfällig
  for (const d of state.darlehen ?? []) {
    const days = daysUntil(d.zinsbindung_bis);
    if (days === null || days > 90 || days < -30) continue;
    out.push({ typ: 'Zinsbindung endet', icon: WARN_ICONS.percent, name: d.bezeichnung, days, datum: d.zinsbindung_bis, view: 'darlehen' });
  }

  // Veraltete Konten-/Depotwerte
  out.push(...collectStaleWarnings());

  return out.sort((a, b) => a.days - b.days);
}

function renderDashboardWarnings() {
  const host = document.getElementById('dash-warnings');
  if (!host) return;
  const warnings = collectWarnings();
  if (!warnings.length) { host.innerHTML = ''; return; }

  const rows = warnings.map(w => {
    const sev = (w.days <= 30 || w.days < 0) ? 'urgent' : 'soon';
    const daysTxt =
      w.days < 0  ? `überfällig seit ${Math.abs(w.days)} ${Math.abs(w.days) === 1 ? 'Tag' : 'Tagen'}` :
      w.days === 0 ? 'heute fällig' :
                     `noch ${w.days} ${w.days === 1 ? 'Tag' : 'Tage'}`;
    return `
      <button class="alert-item ${sev}" onclick="navigate('${w.view}')">
        <span class="alert-icon">${w.icon}</span>
        <span class="alert-text"><strong>${escapeHtml(w.typ)}</strong> · ${escapeHtml(w.name)}</span>
        <span class="alert-days mono">${daysTxt} · ${fmt.date(w.datum)}</span>
      </button>`;
  }).join('');

  host.innerHTML = `
    <div class="alert-banner">
      <div class="alert-banner-head">
        <span class="alert-seal">${WARN_ICONS.bell}</span>
        <span>Anstehende Fristen</span>
        <span class="alert-count">${warnings.length}</span>
      </div>
      <div class="alert-list">${rows}</div>
    </div>`;
}

function renderDonutChart() {
  const nw = state.networth?.aktuell ?? {};
  const data = [
    nw.summe_konten ?? 0,
    nw.summe_depots ?? 0,
    nw.summe_sachvermoegen ?? 0,
  ];

  const hatDaten = data.some(v => Number(v) > 0);
  if (!chartEmptyState('chart-donut', !hatDaten, 'Noch kein Vermögen erfasst')) {
    if (state.charts.donut) { state.charts.donut.destroy(); state.charts.donut = null; }
    return;
  }
  const ctx = document.getElementById('chart-donut').getContext('2d');
  const theme = chartTheme();

  if (state.charts.donut) state.charts.donut.destroy();

  state.charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Konten', 'Depots', 'Sachwerte'],
      datasets: [{
        data,
        backgroundColor: PALETTE.donut,
        borderColor: segmentBorder(),
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: theme.font, size: 12, weight: '400' },
            color: theme.text,
            padding: 16,
            boxWidth: 10,
            boxHeight: 10,
            borderRadius: 5,
            generateLabels: legendLabelsWithPercent,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${fmt.eur(ctx.raw)}`,
          },
          bodyFont: { family: "'JetBrains Mono', monospace" },
        },
      },
    },
  });
}

// Legend labels with percentage suffix (for doughnut charts)
function legendLabelsWithPercent(chart) {
  const ds = chart.data.datasets[0];
  const total = ds.data.reduce((sum, v) => sum + Number(v ?? 0), 0);
  return chart.data.labels.map((label, i) => {
    const value = Number(ds.data[i] ?? 0);
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return {
      text: `${label}  ${pct} %`,
      fillStyle: ds.backgroundColor[i],
      strokeStyle: ds.backgroundColor[i],
      lineWidth: 0,
      borderRadius: 5,
      fontColor: chartTheme().text,
      index: i,
    };
  });
}

function renderSchuldenChart() {
  const darlehen = state.darlehen ?? [];

  if (!chartEmptyState('chart-schulden', !darlehen.length, 'Keine Darlehen erfasst')) {
    if (state.charts.schulden) { state.charts.schulden.destroy(); state.charts.schulden = null; }
    return;
  }
  const ctx = document.getElementById('chart-schulden').getContext('2d');
  const theme = chartTheme();

  if (state.charts.schulden) state.charts.schulden.destroy();

  const SCHULDEN_COLORS = PALETTE.schulden;
  const labels = darlehen.map(d => d.bezeichnung);
  // nur Eigenanteil berücksichtigen (z. B. 50 % bei GbR-Hälfte)
  const data   = darlehen.map(d => Number(d.restschuld ?? 0) * (Number(d.anteil_pct ?? 100) / 100));
  const colors = darlehen.map((_, i) => SCHULDEN_COLORS[i % SCHULDEN_COLORS.length]);

  state.charts.schulden = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: segmentBorder(),
        borderWidth: 2,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: theme.font, size: 12, weight: '400' },
            color: theme.text,
            padding: 12,
            boxWidth: 10,
            boxHeight: 10,
            borderRadius: 5,
            generateLabels: legendLabelsWithPercent,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${fmt.eur(ctx.raw)}`,
          },
          bodyFont: { family: "'JetBrains Mono', monospace" },
        },
      },
    },
  });
}

// ── Snapshot Popup ──────────────────────────────────────────────────────────

function closeSnapshotPopup() {
  document.getElementById('snapshot-popup')?.remove();
}

function showSnapshotPopup(snapshot, nativeEvent) {
  closeSnapshotPopup();
  const popup = document.createElement('div');
  popup.id = 'snapshot-popup';
  popup.className = 'snapshot-popup';
  const datum = new Date(snapshot.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
  popup.innerHTML = `
    <div class="snapshot-popup-header">
      <span class="snapshot-popup-date">${datum}</span>
      <button class="snapshot-popup-close" onclick="closeSnapshotPopup()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="snapshot-popup-val mono">${fmt.eur(snapshot.netto)}</div>
    <button class="snapshot-popup-del" onclick="deleteSnapshot(${snapshot.id})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      Löschen
    </button>`;

  // Popup an Klickposition setzen, innerhalb des Viewports halten
  document.body.appendChild(popup);
  const pw = popup.offsetWidth || 160;
  const ph = popup.offsetHeight || 90;
  let x = nativeEvent.clientX + 12;
  let y = nativeEvent.clientY - ph / 2;
  if (x + pw > window.innerWidth  - 8) x = nativeEvent.clientX - pw - 12;
  if (y < 8)                           y = 8;
  if (y + ph > window.innerHeight - 8) y = window.innerHeight - ph - 8;
  popup.style.left = x + 'px';
  popup.style.top  = y + 'px';
}

window.deleteSnapshot = async function(id) {
  closeSnapshotPopup();
  try {
    await api.networth.deleteSnapshot(id);
    toast('Snapshot gelöscht.');
    await refresh();
  } catch (e) { toast(e.message); }
};

function renderVerlaufChart() {
  const verlauf = state.networth?.verlauf ?? [];

  if (!chartEmptyState('chart-verlauf', verlauf.length === 0, 'Noch keine Verlaufsdaten. Erstelle den ersten Snapshot.')) {
    if (state.charts.verlauf) { state.charts.verlauf.destroy(); state.charts.verlauf = null; }
    return;
  }
  const ctx = document.getElementById('chart-verlauf').getContext('2d');
  const theme = chartTheme();

  if (state.charts.verlauf) state.charts.verlauf.destroy();

  state.charts.verlauf = new Chart(ctx, {
    type: 'line',
    data: {
      labels: verlauf.map(s => new Date(s.datum).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })),
      datasets: [{
        label: 'Nettovermögen',
        data: verlauf.map(s => s.netto),
        borderColor: theme.accent,
        backgroundColor: 'rgba(201,168,76,0.08)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointHoverRadius: 8,
        pointBackgroundColor: theme.accent,
        pointHoverBackgroundColor: theme.accent,
      }],
    },
    options: {
      cursor: 'pointer',
      onClick: (event, elements) => {
        if (!elements.length) { closeSnapshotPopup(); return; }
        showSnapshotPopup(verlauf[elements[0].index], event.native);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ` ${fmt.eur(ctx.raw)}` },
          bodyFont: { family: "'JetBrains Mono', monospace" },
        },
      },
      scales: {
        y: {
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: theme.grey,
            callback: (v) => (v === 0 ? '€0' : '€' + (v / 1000).toFixed(0) + 'k'),
          },
          grid: { color: theme.grid },
          border: { dash: [4, 4] },
        },
        x: {
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: theme.grey,
          },
          grid: { display: false },
        },
      },
    },
  });
}

function renderDashboardKonten() {
  const el = document.getElementById('dash-konten-list');
  if (!el) return;
  if (!state.konten.length) {
    el.innerHTML = '<tr><td colspan="3" class="text-muted" style="text-align:center;padding:2rem">Noch keine Konten erfasst</td></tr>';
    return;
  }
  el.innerHTML = state.konten.slice(0, 5).map(k => `
    <tr>
      <td>${k.name}<br><span class="text-muted" style="font-size:0.75rem">${k.bank}</span></td>
      <td><span class="badge badge-${k.typ}">${k.typ}</span></td>
      <td class="right mono">${fmt.eur(k.saldo)}</td>
    </tr>
  `).join('');
}

function renderDashboardDarlehen() {
  const el = document.getElementById('dash-darlehen-list');
  if (!el) return;
  if (!state.darlehen.length) {
    el.innerHTML = '<tr><td colspan="3" class="text-muted" style="text-align:center;padding:2rem">Noch keine Darlehen erfasst</td></tr>';
    return;
  }
  el.innerHTML = state.darlehen.slice(0, 5).map(d => {
    const anteil = d.anteil_pct != null ? Number(d.anteil_pct) : 100;
    const restschuld = Number(d.restschuld);
    const schuldenZelle = anteil < 100
      ? `<strong>${fmt.eur(restschuld * anteil / 100)}</strong><br>
         <span class="text-muted" style="font-size:0.7rem">Gesamt: ${fmt.eur(restschuld)}</span>`
      : fmt.eur(restschuld);
    return `
    <tr>
      <td>${d.bezeichnung}<br><span class="text-muted" style="font-size:0.75rem">${d.glaeubiger}</span></td>
      <td class="mono">${fmt.pct(d.zinssatz * 100)}</td>
      <td class="right mono text-red">${schuldenZelle}</td>
    </tr>`;
  }).join('');
}

// ── Konten View ─────────────────────────────────────────────────────────────

function renderKonten() {
  const sumKt = state.konten.reduce((s, k) => s + (Number(k.saldo) || 0), 0);
  const elSum = document.getElementById('kt-sum-konten');
  if (elSum) elSum.textContent = fmt.eur(sumKt);

  const tbody = document.getElementById('konten-tbody');
  if (!tbody) return;

  if (!state.konten.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
        </svg>
        <p>Noch keine Konten erfasst.</p>
        <button class="btn btn-primary btn-sm" onclick="openKontoForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Erstes Konto hinzufügen
        </button>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = state.konten.map(k => `
    <tr>
      <td>
        <strong>${escapeHtml(k.name)}</strong>
        ${k.kontoinhaber ? `<br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(k.kontoinhaber)}</span>` : ''}
        ${k.bitwarden_name ? `<br><a href="https://vault.bitwarden.com" target="_blank" rel="noopener" class="bw-link" title="In Bitwarden öffnen: ${escapeHtml(k.bitwarden_name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> ${escapeHtml(k.bitwarden_name)}</a>` : ''}
      </td>
      <td><span class="badge badge-${k.typ}">${KONTO_TYP_LABEL[k.typ] ?? k.typ}</span></td>
      <td class="mono">
        ${k.iban ? maskIBAN(k.iban) : '—'}
        ${k.bic ? `<br><span class="text-muted" style="font-size:0.72rem">${escapeHtml(k.bic)}</span>` : ''}
      </td>
      <td class="right mono ${k.saldo >= 0 ? '' : 'text-red'}">
        ${fmt.eur(k.saldo)}
        ${aktualisiertHtml(k.aktualisiert_am)}
      </td>
      <td class="right"><div class="action-cell">
        <button class="btn-icon" onclick="openKontoForm(${k.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteKonto(${k.id})" title="Löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div></td>
    </tr>
  `).join('');
}

function maskIBAN(iban) {
  if (!iban || iban.length < 8) return iban;
  return iban.substring(0, 4) + ' ···· ···· ' + iban.substring(iban.length - 4);
}

window.openKontoForm = function(id = null) {
  state.editingId = id;
  const konto = id ? state.konten.find(k => k.id === id) : null;
  const title = id ? 'Konto bearbeiten' : 'Konto hinzufügen';

  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Name <span class="required">*</span></label>
        <input id="f-name" class="form-input" value="${escapeHtml(konto?.name ?? '')}" required>
      </div>
      <div class="form-group">
        <label class="form-label">Kontotyp <span class="required">*</span></label>
        <select id="f-typ" class="form-select">
          ${Object.entries(KONTO_TYP_LABEL).map(([val, label]) =>
            `<option value="${val}" ${konto?.typ === val ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">IBAN</label>
        <input id="f-iban" class="form-input mono" value="${escapeHtml(konto?.iban ?? '')}">
        <p class="form-hint">Wird maskiert angezeigt (nur zur Identifikation)</p>
      </div>
      <div class="form-group">
        <label class="form-label">BIC</label>
        <input id="f-bic" class="form-input mono" value="${escapeHtml(konto?.bic ?? '')}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Saldo (€) <span class="required">*</span></label>
      <input id="f-saldo" class="form-input" type="number" step="0.01" value="${konto?.saldo ?? 0}">
    </div>
    <div class="form-group">
      <label class="form-label">Kontoinhaber</label>
      <input id="f-kontoinhaber" class="form-input" value="${escapeHtml(konto?.kontoinhaber ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Passwortsafe-Eintrag</label>
      <input id="f-bitwarden" class="form-input" value="${escapeHtml(konto?.bitwarden_name ?? '')}">
      <p class="form-hint">Klick in der Tabelle öffnet vault.bitwarden.com</p>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <textarea id="f-notiz" class="form-input" rows="3">${escapeHtml(konto?.notiz ?? '')}</textarea>
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('konto', id)}
  `;
  document.getElementById('modal-submit').onclick = submitKontoForm;
  openModal();
  if (id) loadAnhaenge('konto', id);
};

async function submitKontoForm() {
  const data = {
    name:           document.getElementById('f-name').value.trim(),
    typ:            document.getElementById('f-typ').value,
    iban:           document.getElementById('f-iban').value.trim() || null,
    bic:            document.getElementById('f-bic').value.trim() || null,
    saldo:          parseFloat(document.getElementById('f-saldo').value) || 0,
    waehrung:       'EUR',
    kontoinhaber:   document.getElementById('f-kontoinhaber').value.trim() || null,
    bitwarden_name: document.getElementById('f-bitwarden').value.trim() || null,
    notiz:          document.getElementById('f-notiz').value.trim() || null,
  };
  if (!data.name) return toast('Bitte einen Namen eingeben.');
  try {
    if (state.editingId) {
      await api.konten.update(state.editingId, data);
      toast('Konto aktualisiert.');
    } else {
      await api.konten.create(data);
      toast('Konto gespeichert.');
    }
    closeModal();
    await refresh();
  } catch (e) { toast(e.message); }
}

window.deleteKonto = async function(id) {
  const name = state.konten.find(x => x.id === id)?.name ?? '';
  if (!confirm(`Konto „${name}" wirklich löschen?`)) return;
  try {
    await api.konten.delete(id);
    toast('Konto gelöscht.');
    await refresh();
  } catch (e) { toast(e.message); }
};

// ── Darlehen View ────────────────────────────────────────────────────────────

function renderDarlehen() {
  const sumDl = state.darlehen.reduce((s, d) => s + (Number(d.restschuld) || 0) * (Number(d.anteil_pct ?? 100) / 100), 0);
  const elSum = document.getElementById('dl-sum-darlehen');
  if (elSum) elSum.textContent = fmt.eur(sumDl);

  const tbody = document.getElementById('darlehen-tbody');
  if (!tbody) return;

  if (!state.darlehen.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <p>Noch keine Darlehen erfasst.</p>
        <button class="btn btn-primary btn-sm" onclick="openDarlehenForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Erstes Darlehen hinzufügen
        </button>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = state.darlehen.map(d => {
    const zinsbindungWarning = zinsbindungBald(d.zinsbindung_bis);
    const isTilg = d.darlehen_typ === 'tilgungsdarlehen';

    // Aktuelle Monatsrate berechnen
    const restschuld        = Number(d.restschuld);
    const zinssatz          = Number(d.zinssatz);
    const tilgungsrate      = Number(d.tilgungsrate_monatlich ?? 0);
    const rateNetto         = Number(d.rate_monatlich);   // bei Annuität: Tilgung+Zinsen netto
    const zinsenAktuell     = restschuld * zinssatz / 12;
    const ustAufZinsen      = d.hat_ust_auf_zinsen ? zinsenAktuell * 0.19 : 0;
    const rateAktuell       = isTilg
      ? tilgungsrate + zinsenAktuell + ustAufZinsen
      : rateNetto + ustAufZinsen;

    // Restlaufzeit — immer auf Basis der Nettorate (ohne USt, die den Schuldenabbau nicht beeinflusst)
    let rlText;
    if (isTilg) {
      const monate = tilgungsrate > 0 ? Math.ceil(restschuld / tilgungsrate) : null;
      rlText = monate ? `noch ${formatRestlaufzeit(monate)}` : '—';
    } else {
      const rl = restlaufzeitMonate(restschuld, zinssatz, rateNetto);
      rlText = rl.monate ? `noch ${formatRestlaufzeit(rl.monate)}`
             : rl.fehler === 'rate_zu_niedrig' ? 'Rate deckt Zinsen nicht' : '—';
    }

    // Rate-Aufschlüsselung
    let rateDetails;
    if (isTilg) {
      rateDetails = `Tilgung ${fmt.eur(tilgungsrate)} + Zinsen ${fmt.eur(zinsenAktuell)}`;
      if (ustAufZinsen > 0) rateDetails += ` + USt ${fmt.eur(ustAufZinsen)}`;
    } else if (ustAufZinsen > 0) {
      const tilgungAkt = rateNetto - zinsenAktuell;
      rateDetails = `Tilgung ${fmt.eur(tilgungAkt)} + Zinsen ${fmt.eur(zinsenAktuell)} + USt ${fmt.eur(ustAufZinsen)}`;
    }
    const rateHtml = (isTilg || ustAufZinsen > 0)
      ? `${fmt.eur(rateAktuell)} / Mon.
         <br><span class="text-muted" style="font-size:0.7rem">${rateDetails}</span>
         <br><span class="text-muted" style="font-size:0.7rem">${rlText}</span>`
      : `${fmt.eur(rateAktuell)} / Mon.
         <br><span class="text-muted" style="font-size:0.7rem">${rlText}</span>`;

    return `
    <tr>
      <td>
        <strong>${d.bezeichnung}</strong><br>
        <span class="text-muted" style="font-size:0.75rem">${d.glaeubiger}</span>
      </td>
      <td class="mono text-red">
        ${(d.anteil_pct != null && Number(d.anteil_pct) < 100)
          ? `<strong>${fmt.eur(d.restschuld * Number(d.anteil_pct) / 100)}</strong>
             <br><span class="text-muted" style="font-size:0.7rem">Gesamt: ${fmt.eur(d.restschuld)}</span>`
          : fmt.eur(d.restschuld)}
      </td>
      <td class="mono">${fmt.pct(d.zinssatz * 100)}</td>
      <td class="mono">${rateHtml}</td>
      <td>
        <span class="mono" style="font-size:0.75rem ${zinsbindungWarning ? ';color:#F87171' : ''}">
          ${d.zinsbindung_bis ? fmt.date(d.zinsbindung_bis) : '—'}
          ${zinsbindungWarning ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11" style="vertical-align:-1px;margin-left:2px"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>' : ''}
        </span>
      </td>
      <td class="right"><div class="action-cell">
        <button class="btn-icon" onclick="openDarlehenTilgungsplan(${d.id})" title="Tilgungsplan">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-4-4L3 15.5"/></svg>
        </button>
        <button class="btn-icon" onclick="openDarlehenForm(${d.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteDarlehen(${d.id})" title="Löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div></td>
    </tr>
  `}).join('');
}

function zinsbindungBald(bis) {
  if (!bis) return false;
  const diff = (new Date(bis) - new Date()) / (1000 * 60 * 60 * 24 * 30);
  return diff < 12; // weniger als 12 Monate
}

// ── Tilgungsplan & Sondertilgungs-Szenario ────────────────────────────────
// Rechnet in backend/services/tilgung.py (kanonische Quelle, getestet) —
// das Frontend fragt bei jeder Slider-Bewegung neu ab statt lokal
// nachzurechnen. Lokaler Server, daher spürt man die Latenz beim Ziehen
// praktisch nicht; ein leichtes Debounce genügt.

const tpTimers = {};

window.openDarlehenTilgungsplan = async function(id) {
  const d = state.darlehen.find(x => x.id === id);
  if (!d) return;

  document.getElementById('modal-title').textContent = `Tilgungsplan · ${d.bezeichnung}`;

  const hatSonder = !!d.sondertilgung_moeglich;
  const restschuld = Number(d.restschuld) || 0;
  const maxSonder = Math.max(1000, Math.min(Number(d.sondertilgung_betrag) || restschuld, restschuld));

  document.getElementById('modal-body').innerHTML = `
    ${hatSonder ? `
      <div class="form-group">
        <label class="form-label">Jährliche Sondertilgung</label>
        <input id="tp-slider" type="range" min="0" max="${Math.round(maxSonder)}" step="250" value="0"
          oninput="tpQueueUpdate(${id}, this.value)" style="width:100%">
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--wash-grey);margin-top:0.2rem">
          <span>0 €</span>
          <span id="tp-slider-val" class="mono" style="font-weight:600;color:var(--ink-black)">0 €</span>
          <span>${fmt.eur(maxSonder)}</span>
        </div>
        ${d.sondertilgung_betrag ? `<p class="form-hint">Vertraglich max. ${fmt.eur(d.sondertilgung_betrag)} / Jahr erlaubt.</p>` : ''}
      </div>
      <div class="stat-grid" style="grid-template-columns:1fr 1fr;margin-bottom:1rem">
        <div class="stat-card">
          <div class="label">Laufzeitverkürzung</div>
          <div class="value mono" id="tp-monate-diff">—</div>
        </div>
        <div class="stat-card">
          <div class="label">Zinsersparnis</div>
          <div class="value mono" id="tp-zinsen-diff">—</div>
        </div>
      </div>
    ` : `<p class="form-hint">Laut Vertrag ist für dieses Darlehen keine Sondertilgung vorgesehen.</p>`}
    <div id="tp-tabelle-container"><p class="form-hint">Lädt…</p></div>
  `;

  openModal();
  document.getElementById('modal-submit').style.display = 'none';

  await tpLadeUndRender(id, 0);
};

window.tpQueueUpdate = function(id, wert) {
  const el = document.getElementById('tp-slider-val');
  if (el) el.textContent = fmt.eur(wert);
  clearTimeout(tpTimers.slider);
  tpTimers.slider = setTimeout(() => tpLadeUndRender(id, wert), 200);
};

async function tpLadeUndRender(id, sondertilgungJahr) {
  const container = document.getElementById('tp-tabelle-container');
  if (!container) return;
  try {
    const plan = await api.darlehen.tilgungsplan(id, sondertilgungJahr);

    const diffEl = document.getElementById('tp-monate-diff');
    const zinsDiffEl = document.getElementById('tp-zinsen-diff');
    if (diffEl && zinsDiffEl) {
      const { monate_gesamt: monateMit, monate_ohne_sondertilgung: monateOhne,
              zinsen_gesamt: zinsenMit, zinsen_ohne_sondertilgung: zinsenOhne } = plan;
      const monateDiff = (monateOhne != null && monateMit != null) ? monateOhne - monateMit : 0;
      diffEl.textContent = monateDiff > 0 ? formatRestlaufzeit(monateDiff) : '—';
      zinsDiffEl.textContent = fmt.eur(Math.max(0, zinsenOhne - zinsenMit));
    }

    if (!plan.jahre.length) {
      container.innerHTML = '<p class="form-hint">Keine gültige Tilgungsrechnung möglich — die Rate deckt vermutlich nicht einmal die Zinsen.</p>';
      return;
    }

    const zeigtSonder = Number(sondertilgungJahr) > 0;
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Jahr</th><th class="right">Zinsen</th><th class="right">Tilgung</th>
            ${zeigtSonder ? '<th class="right">Sondertilgung</th>' : ''}
            <th class="right">Restschuld z. Jahresende</th>
          </tr>
        </thead>
        <tbody>
          ${plan.jahre.map(j => `
            <tr>
              <td>${j.jahr}</td>
              <td class="right mono">${fmt.eur(j.zins)}</td>
              <td class="right mono">${fmt.eur(j.tilgung)}</td>
              ${zeigtSonder ? `<td class="right mono">${j.sondertilgung > 0 ? fmt.eur(j.sondertilgung) : '—'}</td>` : ''}
              <td class="right mono">${fmt.eur(j.restschuld_ende)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p class="form-hint" style="margin-top:0.6rem">
        Gesamtlaufzeit: ${plan.monate_gesamt != null ? formatRestlaufzeit(plan.monate_gesamt) : 'läuft über 60 Jahre hinaus'}
        &middot; Gesamtzinsen: ${fmt.eur(plan.zinsen_gesamt)}
      </p>`;
  } catch (e) {
    container.innerHTML = `<p class="form-hint">Fehler beim Laden: ${escapeHtml(e.message)}</p>`;
  }
}

// ── Darlehensrechner ───────────────────────────────────────────────────────
// Freier Szenario-Rechner: unabhängig von gespeicherten Darlehen, alle Werte
// frei editierbar. Rate und Laufzeit sind verkoppelt — welches Feld gerade
// "abgeleitet" wird (statt vom Nutzer eingegeben), merkt sich drAnchor.
// Annuität: gibt der Nutzer die Rate ein, wird die Laufzeit draus berechnet
// (und umgekehrt, klassische Annuitätenformel). Tilgungsdarlehen: linear,
// daher reicht Dreisatz in beide Richtungen.

let drAnchor = 'rate'; // 'rate' | 'laufzeit' — welches Feld der Nutzer zuletzt bewusst gesetzt hat
const drTimers = {};

// Nötige Monatsrate für eine gewünschte Laufzeit (Umkehrung der Annuitätenformel).
function drRateAusLaufzeit(betrag, zinssatzDezimal, laufzeitJahre, typ) {
  const n = Math.round(laufzeitJahre * 12);
  if (n <= 0 || betrag <= 0) return 0;
  if (typ === 'tilgungsdarlehen') return betrag / n;
  const r = zinssatzDezimal / 12;
  if (r <= 0) return betrag / n;
  return betrag * r / (1 - Math.pow(1 + r, -n));
}

// Laufzeit (Monate) aus Rate — nutzt dieselbe Formel wie die Darlehen-Tabelle.
function drLaufzeitAusRate(betrag, zinssatzDezimal, rate, typ) {
  if (betrag <= 0 || rate <= 0) return null;
  if (typ === 'tilgungsdarlehen') return Math.ceil(betrag / rate);
  const res = restlaufzeitMonate(betrag, zinssatzDezimal, rate);
  return res.monate ?? null;
}

function drLesenFelder() {
  const betrag = parseFloat(document.getElementById('dr-betrag').value) || 0;
  const zinssatzPct = parseFloat(document.getElementById('dr-zinssatz').value) || 0;
  const typ = document.getElementById('dr-typ').value;
  // Zahlenfeld ist die Quelle der Wahrheit, der Regler folgt ihm nur visuell.
  const sondertilgung = Number(document.getElementById('dr-sonder-input').value) || 0;
  return { betrag, zinssatzDezimal: zinssatzPct / 100, typ, sondertilgung };
}

window.drTypChanged = function() {
  const typ = document.getElementById('dr-typ').value;
  document.getElementById('dr-rate-label').textContent =
    typ === 'tilgungsdarlehen' ? 'Monatliche Tilgung (€)' : 'Monatliche Rate (€)';
  drRecalc();
};

window.drAnchorChanged = function(feld) {
  drAnchor = feld;
  drRecalc();
};

window.drSliderInput = function(wert) {
  document.getElementById('dr-sonder-input').value = wert;
  clearTimeout(drTimers.slider);
  drTimers.slider = setTimeout(() => drRecalc(true), 200);
};

window.drSonderInputChanged = function(wert) {
  const slider = document.getElementById('dr-slider');
  const v = Math.max(0, Number(wert) || 0);
  // Regler bei Bedarf erweitern, statt einen getippten Wert stillschweigend zu kappen.
  if (v > Number(slider.max)) slider.max = v;
  slider.value = v;
  syncRangeFill(slider);
  clearTimeout(drTimers.slider);
  drTimers.slider = setTimeout(() => drRecalc(true), 300);
};

// Berechnet sofort (clientseitig) das jeweils abgeleitete Feld (Rate ↔ Laufzeit),
// damit die Eingabe nicht auf den Server wartet — und holt danach (debounced)
// den vollständigen Tilgungsplan vom Server.
window.drRecalc = function(nurTabelle = false) {
  const { betrag, zinssatzDezimal, typ, sondertilgung } = drLesenFelder();

  // Sondertilgungs-Slider-Obergrenze an die Darlehenssumme anpassen — aber
  // einen bewusst höher getippten Wert im Zahlenfeld nicht stillschweigend
  // kappen, nur die Regler-Obergrenze bei Bedarf mit hochziehen.
  const sliderMax = Math.max(1000, Math.min(betrag, 100000), sondertilgung);
  const slider = document.getElementById('dr-slider');
  slider.max = Math.round(sliderMax);
  syncRangeFill(slider);
  document.getElementById('dr-slider-max').textContent = fmt.eur(sliderMax);

  const rateInput = document.getElementById('dr-rate');
  const laufzeitInput = document.getElementById('dr-laufzeit');

  if (drAnchor === 'laufzeit') {
    const laufzeitJahre = parseFloat(laufzeitInput.value) || 0;
    const rate = drRateAusLaufzeit(betrag, zinssatzDezimal, laufzeitJahre, typ);
    if (rate > 0) rateInput.value = rate.toFixed(0);
  } else {
    const rate = parseFloat(rateInput.value) || 0;
    const monate = drLaufzeitAusRate(betrag, zinssatzDezimal, rate, typ);
    if (monate) laufzeitInput.value = (monate / 12).toFixed(1);
  }

  clearTimeout(drTimers.recalc);
  drTimers.recalc = setTimeout(() => drLadeUndRender(), nurTabelle ? 0 : 300);
};

// Kennzahl in der Ersparnis-Zeile setzen — ohne Wert bleibt sie grau statt
// ein grünes "—" zu zeigen.
function setKpi(id, hatWert, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('is-empty', !hatWert);
}

function renderDrRestschuldChart(jahre, baselineJahre, betrag) {
  if (!chartEmptyState('chart-dr-restschuld', !jahre.length, 'Keine gültige Tilgungsrechnung möglich.')) {
    if (state.charts.drRestschuld) { state.charts.drRestschuld.destroy(); state.charts.drRestschuld = null; }
    return;
  }
  const ctx = document.getElementById('chart-dr-restschuld').getContext('2d');
  const theme = chartTheme();

  if (state.charts.drRestschuld) state.charts.drRestschuld.destroy();

  const datasets = [{
    label: 'Restschuld',
    data: [betrag, ...jahre.map(j => j.restschuld_ende)],
    borderColor: theme.accent,
    backgroundColor: 'rgba(201,168,76,0.12)',
    borderWidth: 2,
    fill: true,
    tension: 0.3,
    pointRadius: 0,
    pointHoverRadius: 4,
  }];
  if (baselineJahre?.length) {
    datasets.push({
      label: 'Ohne Sondertilgung',
      data: [betrag, ...baselineJahre.map(j => j.restschuld_ende)],
      borderColor: theme.grey,
      borderDash: [5, 4],
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: 0,
    });
  }

  // Mit Sondertilgung ist das Darlehen früher weg, die Vergleichsreihe läuft
  // also länger. Die Achse muss der längeren Reihe folgen — sonst bricht die
  // gestrichelte Linie mitten in der Luft ab.
  // Startpunkt heute (volle Darlehenssumme) plus ein Label je Tilgungsjahr.
  const achsenJahre = Math.max(jahre.length, baselineJahre?.length ?? 0);
  const labels = Array.from({ length: achsenJahre + 1 }, (_, i) => String(planKalenderjahr(i)));

  state.charts.drRestschuld = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      // s. Zinseszins-Chart: sonst füllt das Canvas die Karte nicht aus.
      maintainAspectRatio: false,
      layout: { padding: { top: 4 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: !!baselineJahre?.length,
          align: 'start',
          labels: legendLabels(theme),
        },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt.eur(ctx.raw)}` },
          bodyFont: { family: "'JetBrains Mono', monospace" },
        },
      },
      scales: {
        y: {
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: theme.grey,
            callback: (v) => (v === 0 ? '€0' : '€' + (v / 1000).toFixed(0) + 'k'),
          },
          grid: { color: theme.grid },
        },
        x: jahresAchse(theme),
      },
    },
  });
}

async function drLadeUndRender() {
  const container = document.getElementById('dr-tabelle-container');
  if (!container) return;
  const { betrag, zinssatzDezimal, typ, sondertilgung } = drLesenFelder();
  const rate = parseFloat(document.getElementById('dr-rate').value) || 0;

  if (betrag <= 0 || rate <= 0) {
    container.innerHTML = '<p class="form-hint">Bitte Darlehenssumme und Rate eingeben.</p>';
    return;
  }

  const params = {
    betrag, zinssatz: zinssatzDezimal, darlehen_typ: typ, sondertilgung_jahr: sondertilgung,
    ...(typ === 'tilgungsdarlehen' ? { tilgungsrate_monatlich: rate } : { rate_monatlich: rate }),
  };

  try {
    const plan = await api.darlehen.simulation(params);
    // Vergleichslinie im Chart: derselbe Endpunkt, aber ohne Sondertilgung —
    // nur bei Bedarf ein zweiter Call, kein Backend-Ausbau nötig.
    const baselinePlan = sondertilgung > 0
      ? await api.darlehen.simulation({ ...params, sondertilgung_jahr: 0 })
      : null;

    document.getElementById('dr-out-laufzeit').textContent =
      plan.monate_gesamt != null ? formatRestlaufzeit(plan.monate_gesamt) : '> 60 Jahre';
    document.getElementById('dr-out-zinsen').textContent = fmt.eur(plan.zinsen_gesamt);
    // Gesamtkosten = Darlehenssumme + Zinsen — was am Ende insgesamt an die Bank
    // fließt. Die Sondertilgung ändert daran nichts, sie tilgt nur schneller
    // dieselbe Summe; sie wirkt hier ausschließlich über geringere Zinsen.
    document.getElementById('dr-out-gesamtkosten').textContent = fmt.eur(betrag + plan.zinsen_gesamt);

    const { monate_gesamt: monateMit, monate_ohne_sondertilgung: monateOhne,
            zinsen_gesamt: zinsenMit, zinsen_ohne_sondertilgung: zinsenOhne } = plan;
    const monateDiff = (sondertilgung > 0 && monateOhne != null && monateMit != null) ? monateOhne - monateMit : 0;
    const zinsenDiff = sondertilgung > 0 ? Math.max(0, zinsenOhne - zinsenMit) : 0;
    setKpi('dr-out-monate-diff', monateDiff > 0, monateDiff > 0 ? formatRestlaufzeit(monateDiff) : '—');
    setKpi('dr-out-zinsen-diff', zinsenDiff > 0, zinsenDiff > 0 ? fmt.eur(zinsenDiff) : '—');

    // Der Untertitel darf keinen Vergleich versprechen, den es ohne
    // Sondertilgung gar nicht gibt.
    const subtitle = document.getElementById('dr-chart-subtitle');
    if (subtitle) {
      subtitle.textContent = baselinePlan
        ? 'Mit und ohne Sondertilgung im Vergleich'
        : 'Restschuld über die gesamte Laufzeit';
    }

    renderDrRestschuldChart(plan.jahre, baselinePlan?.jahre ?? null, betrag);

    if (!plan.jahre.length) {
      container.innerHTML = '<p class="form-hint">Keine gültige Tilgungsrechnung möglich — die Rate deckt vermutlich nicht einmal die Zinsen.</p>';
      return;
    }

    const zeigtSonder = sondertilgung > 0;
    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Jahr</th><th class="right">Zinsen</th><th class="right">Tilgung</th>
            ${zeigtSonder ? '<th class="right">Sondertilgung</th>' : ''}
            <th class="right">Restschuld z. Jahresende</th>
          </tr>
        </thead>
        <tbody>
          ${plan.jahre.map(j => `
            <tr>
              <td class="mono">${planKalenderjahr(j.jahr)}<span class="jahr-nr">J. ${j.jahr}</span></td>
              <td class="right mono" style="color:#F0A030">${fmt.eur(j.zins)}</td>
              <td class="right mono">${fmt.eur(j.tilgung)}</td>
              ${zeigtSonder ? `<td class="right mono" style="color:#4ADE80">${j.sondertilgung > 0 ? fmt.eur(j.sondertilgung) : '—'}</td>` : ''}
              <td class="right mono">${fmt.eur(j.restschuld_ende)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    container.innerHTML = `<p class="form-hint">Fehler beim Laden: ${escapeHtml(e.message)}</p>`;
  }
}

// ── Zinseszins-Simulator ───────────────────────────────────────────────────
// Freier Rechner, unabhängig von gespeicherten Daten — läuft serverseitig in
// backend/services/zinseszins.py (kanonische, getestete Quelle), Debounce
// analog zum Darlehensrechner.

const zzTimers = {};

function zzLesenFelder() {
  return {
    startkapital: parseFloat(document.getElementById('zz-startkapital').value) || 0,
    sparrateMonatlich: parseFloat(document.getElementById('zz-sparrate').value) || 0,
    zinssatzDezimal: (parseFloat(document.getElementById('zz-zinssatz').value) || 0) / 100,
    laufzeitJahre: parseInt(document.getElementById('zz-laufzeit').value) || 0,
    inflationDezimal: (parseFloat(document.getElementById('zz-inflation').value) || 0) / 100,
  };
}

window.zzLaufzeitInputChanged = function(wert) {
  const slider = document.getElementById('zz-laufzeit-slider');
  slider.value = Math.max(1, Math.min(60, Number(wert) || 1));
  syncRangeFill(slider);
  zzRecalc();
};

window.zzLaufzeitSliderInput = function(wert) {
  document.getElementById('zz-laufzeit').value = wert;
  zzRecalc();
};

window.zzRecalc = function() {
  clearTimeout(zzTimers.recalc);
  zzTimers.recalc = setTimeout(() => zzLadeUndRender(), 200);
};

function renderZinseszinsChart(jahre, startkapital) {
  if (!chartEmptyState('chart-zinseszins', !jahre.length, 'Bitte gültige Werte eingeben.')) {
    if (state.charts.zinseszins) { state.charts.zinseszins.destroy(); state.charts.zinseszins = null; }
    return;
  }
  const ctx = document.getElementById('chart-zinseszins').getContext('2d');
  const theme = chartTheme();

  if (state.charts.zinseszins) state.charts.zinseszins.destroy();

  state.charts.zinseszins = new Chart(ctx, {
    type: 'line',
    data: {
      // Die Kurve beginnt heute, nicht erst nach dem ersten Sparjahr — sonst
      // stünde am linken Rand schon ein verzinster Wert und das laufende Jahr
      // käme in der Achse gar nicht vor.
      labels: [String(planKalenderjahr(0)), ...jahre.map(j => String(planKalenderjahr(j.jahr)))],
      datasets: [
        {
          label: 'Gesamtkapital',
          data: [startkapital, ...jahre.map(j => j.gesamtkapital)],
          borderColor: theme.accent,
          backgroundColor: 'rgba(201,168,76,0.12)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: 'Gesamtkapital (real)',
          data: [startkapital, ...jahre.map(j => j.gesamtkapital_real)],
          // Gold vs. Orange waren auf der goldenen Fläche kaum zu unterscheiden.
          // Blau ist der klare Kontrast (s. PALETTE.donut) und bleibt zusätzlich
          // per Strichelung von der durchgezogenen Gesamtkapital-Linie getrennt.
          borderColor: '#4DA8E0',
          borderDash: [5, 4],
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: 'Eigene Einzahlungen',
          data: [startkapital, ...jahre.map(j => j.einzahlungen_kumuliert)],
          borderColor: theme.grey,
          borderWidth: 2,
          fill: false,
          tension: 0.3,
          pointRadius: 0,
        },
      ],
    },
    options: {
      // Ohne das behält Chart.js das 2:1-Verhältnis bei und lässt rechts in der
      // Karte eine tote Fläche stehen — das Canvas soll den Container füllen.
      maintainAspectRatio: false,
      layout: { padding: { top: 4 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          align: 'start',
          labels: legendLabels(theme),
        },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmt.eur(ctx.raw)}` },
          bodyFont: { family: "'JetBrains Mono', monospace" },
        },
      },
      scales: {
        y: {
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: theme.grey,
            callback: (v) => (v === 0 ? '€0' : '€' + (v / 1000).toFixed(0) + 'k'),
          },
          grid: { color: theme.grid },
        },
        x: jahresAchse(theme),
      },
    },
  });
}

async function zzLadeUndRender() {
  const container = document.getElementById('zz-tabelle-container');
  if (!container) return;
  const { startkapital, sparrateMonatlich, zinssatzDezimal, laufzeitJahre, inflationDezimal } = zzLesenFelder();

  if (laufzeitJahre <= 0) {
    container.innerHTML = '<p class="form-hint" style="padding:1.5rem">Bitte eine Laufzeit von mindestens einem Jahr angeben.</p>';
    return;
  }

  try {
    const erg = await api.zinseszins.simulation({
      startkapital, sparrate_monatlich: sparrateMonatlich, zinssatz: zinssatzDezimal,
      laufzeit_jahre: laufzeitJahre, inflationsrate: inflationDezimal,
    });

    document.getElementById('zz-out-gesamtkapital').textContent = fmt.eur(erg.gesamtkapital_end);
    document.getElementById('zz-out-einzahlungen').textContent = fmt.eur(erg.einzahlungen_gesamt);
    document.getElementById('zz-out-zinsertrag').textContent = fmt.eur(erg.zinsertrag_gesamt);
    // Das inflationsbereinigte Endkapital steht nur pro Jahr in der Antwort —
    // der Endwert ist also das letzte Jahr. Ohne Inflation ist er identisch
    // mit dem nominalen Endkapital, das ist so gewollt.
    document.getElementById('zz-out-gesamtkapital-real').textContent =
      fmt.eur(erg.jahre.at(-1)?.gesamtkapital_real ?? erg.gesamtkapital_end);

    renderZinseszinsChart(erg.jahre, startkapital);

    if (!erg.jahre.length) {
      container.innerHTML = '<p class="form-hint" style="padding:1.5rem">Keine Berechnung möglich.</p>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Jahr</th><th class="right">Einzahlungen kumuliert</th><th class="right">Zinsertrag kumuliert</th>
            <th class="right">Gesamtkapital</th><th class="right">Gesamtkapital (real)</th>
          </tr>
        </thead>
        <tbody>
          ${erg.jahre.map(j => `
            <tr>
              <td class="mono">${planKalenderjahr(j.jahr)}<span class="jahr-nr">J. ${j.jahr}</span></td>
              <td class="right mono">${fmt.eur(j.einzahlungen_kumuliert)}</td>
              <td class="right mono" style="color:#F0A030">${fmt.eur(j.zinsertrag_kumuliert)}</td>
              <td class="right mono"><strong>${fmt.eur(j.gesamtkapital)}</strong></td>
              <td class="right mono">${fmt.eur(j.gesamtkapital_real)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    container.innerHTML = `<p class="form-hint" style="padding:1.5rem">Fehler beim Laden: ${escapeHtml(e.message)}</p>`;
  }
}

// ── Kapitalentnahmerechner ───────────────────────────────────────────────────
// Freier Rechner, unabhängig von gespeicherten Daten — läuft serverseitig in
// backend/services/kapitalentnahme.py (kanonische, getestete Quelle). Gleiche
// Anchor-Logik wie der Darlehensrechner (Entnahme ↔ Laufzeit): ein verzinster
// Kapitalstock, der um eine feste Entnahme schrumpft, folgt exakt derselben
// Rekursion wie eine Restschuld, die um eine feste Rate schrumpft.

let keAnchor = 'entnahme'; // 'entnahme' | 'laufzeit' — welches Feld der Nutzer zuletzt bewusst gesetzt hat
const keTimers = {};

// Laufzeit (Monate) aus Entnahme — dieselbe Formel wie restlaufzeitMonate beim
// Darlehen (Kapital ↔ Restschuld, Entnahme ↔ Rate), nur für die Sofort-Anzeige
// im Eingabefeld; der eigentliche Rechenweg für die Tabelle läuft über die API.
function keLaufzeitAusEntnahme(kapital, zinssatzDezimal, entnahme) {
  if (kapital <= 0 || entnahme <= 0) return null;
  return restlaufzeitMonate(kapital, zinssatzDezimal, entnahme).monate ?? null;
}

// Nötige Monatsentnahme für eine gewünschte Laufzeit (Umkehrung der
// Annuitätenformel — analog zu drRateAusLaufzeit ohne Tilgungsdarlehen-Variante).
function keEntnahmeAusLaufzeit(kapital, zinssatzDezimal, laufzeitJahre) {
  const n = Math.round(laufzeitJahre * 12);
  if (n <= 0 || kapital <= 0) return 0;
  const r = zinssatzDezimal / 12;
  if (r <= 0) return kapital / n;
  return kapital * r / (1 - Math.pow(1 + r, -n));
}

function keLesenFelder() {
  return {
    kapital: parseFloat(document.getElementById('ke-kapital').value) || 0,
    zinssatzDezimal: (parseFloat(document.getElementById('ke-zinssatz').value) || 0) / 100,
  };
}

window.keAnchorChanged = function(feld) {
  keAnchor = feld;
  keRecalc();
};

window.keRecalc = function(nurTabelle = false) {
  const { kapital, zinssatzDezimal } = keLesenFelder();
  const entnahmeInput = document.getElementById('ke-entnahme');
  const laufzeitInput = document.getElementById('ke-laufzeit');

  if (keAnchor === 'laufzeit') {
    const laufzeitJahre = parseFloat(laufzeitInput.value) || 0;
    const entnahme = keEntnahmeAusLaufzeit(kapital, zinssatzDezimal, laufzeitJahre);
    if (entnahme > 0) entnahmeInput.value = entnahme.toFixed(0);
  } else {
    const entnahme = parseFloat(entnahmeInput.value) || 0;
    const monate = keLaufzeitAusEntnahme(kapital, zinssatzDezimal, entnahme);
    if (monate) laufzeitInput.value = (monate / 12).toFixed(1);
  }

  clearTimeout(keTimers.recalc);
  keTimers.recalc = setTimeout(() => keLadeUndRender(), nurTabelle ? 0 : 300);
};

function renderKeKapitalChart(jahre, kapital) {
  if (!chartEmptyState('chart-ke-kapital', !jahre.length, 'Keine gültige Entnahmerechnung möglich.')) {
    if (state.charts.keKapital) { state.charts.keKapital.destroy(); state.charts.keKapital = null; }
    return;
  }
  const ctx = document.getElementById('chart-ke-kapital').getContext('2d');
  const theme = chartTheme();

  if (state.charts.keKapital) state.charts.keKapital.destroy();

  // Startpunkt heute (volles Kapital), s. Zinseszins-/Restschuld-Chart.
  const labels = [String(planKalenderjahr(0)), ...jahre.map(j => String(planKalenderjahr(j.jahr)))];
  const daten = [kapital, ...jahre.map(j => j.kapital_ende)];

  state.charts.keKapital = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Kapital',
        data: daten,
        borderColor: theme.accent,
        backgroundColor: 'rgba(201,168,76,0.12)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
      }],
    },
    options: {
      maintainAspectRatio: false,
      layout: { padding: { top: 4 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ` ${fmt.eur(ctx.raw)}` },
          bodyFont: { family: "'JetBrains Mono', monospace" },
        },
      },
      scales: {
        y: {
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: theme.grey,
            callback: (v) => (v === 0 ? '€0' : '€' + (v / 1000).toFixed(0) + 'k'),
          },
          grid: { color: theme.grid },
        },
        x: jahresAchse(theme),
      },
    },
  });
}

async function keLadeUndRender() {
  const container = document.getElementById('ke-tabelle-container');
  if (!container) return;
  const { kapital, zinssatzDezimal } = keLesenFelder();
  const entnahmeInput = document.getElementById('ke-entnahme');
  const laufzeitInput = document.getElementById('ke-laufzeit');

  let params;
  if (keAnchor === 'laufzeit') {
    const laufzeitJahre = parseFloat(laufzeitInput.value) || 0;
    if (kapital <= 0 || laufzeitJahre <= 0) {
      container.innerHTML = '<p class="form-hint">Bitte Kapital und Laufzeit eingeben.</p>';
      return;
    }
    params = { kapital, zinssatz: zinssatzDezimal, modus: 'betrag', laufzeit_jahre: laufzeitJahre };
  } else {
    const entnahme = parseFloat(entnahmeInput.value) || 0;
    if (kapital <= 0 || entnahme <= 0) {
      container.innerHTML = '<p class="form-hint">Bitte Kapital und Entnahme eingeben.</p>';
      return;
    }
    params = { kapital, zinssatz: zinssatzDezimal, modus: 'laufzeit', entnahme_monatlich: entnahme };
  }

  try {
    const plan = await api.kapitalentnahme.simulation(params);
    // Bei modus='betrag' liefert das Backend die exakte (nicht auf ganze Euro
    // gerundete) Entnahme zurück — Feld nachziehen, damit Eingabe und
    // simulierter Kapitalverlauf konsistent bleiben (sonst könnte "10 Jahre"
    // eingetippt, aber "9 Jahre 11 Monate" simuliert werden).
    if (keAnchor === 'laufzeit') entnahmeInput.value = plan.monatliche_entnahme.toFixed(0);

    document.getElementById('ke-out-laufzeit').textContent =
      plan.monate_gesamt != null ? formatRestlaufzeit(plan.monate_gesamt) : '> 60 Jahre';
    document.getElementById('ke-out-zinsertrag').textContent = fmt.eur(plan.zinsertrag_gesamt);
    document.getElementById('ke-out-entnahme').textContent = fmt.eur(plan.entnahme_gesamt);
    document.getElementById('ke-out-max-erhalt').textContent = fmt.eur(plan.max_entnahme_kapitalerhalt);

    renderKeKapitalChart(plan.jahre, kapital);

    if (!plan.jahre.length) {
      container.innerHTML = '<p class="form-hint">Keine gültige Entnahmerechnung möglich — die Entnahme deckt vermutlich nicht einmal die Zinsen und das Kapital wird nie verzehrt.</p>';
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Jahr</th><th class="right">Zinsertrag</th><th class="right">Entnahme</th>
            <th class="right">Kapital z. Jahresende</th>
          </tr>
        </thead>
        <tbody>
          ${plan.jahre.map(j => `
            <tr>
              <td class="mono">${planKalenderjahr(j.jahr)}<span class="jahr-nr">J. ${j.jahr}</span></td>
              <td class="right mono" style="color:#F0A030">${fmt.eur(j.zinsertrag)}</td>
              <td class="right mono">${fmt.eur(j.entnahme)}</td>
              <td class="right mono"><strong>${fmt.eur(j.kapital_ende)}</strong></td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    container.innerHTML = `<p class="form-hint">Fehler beim Laden: ${escapeHtml(e.message)}</p>`;
  }
}

// ── Rechner-Seite (Dispatcher) ────────────────────────────────────────────

function renderRechnerZinseszins() {
  document.querySelectorAll('#view-rechner-zinseszins .range-slider').forEach(syncRangeFill);
  zzLadeUndRender();
}

function renderRechnerDarlehen() {
  document.querySelectorAll('#view-rechner-darlehen .range-slider').forEach(syncRangeFill);
  drRecalc(true);
}

function renderRechnerKapitalentnahme() {
  keRecalc(true);
}

// ── Sparziele (Sparschwein) ──────────────────────────────────────────────────
// Fortschritt kommt ausschließlich aus manuellen Fütterungen (nie aus einem
// Kontostand) — s. Nutzerentscheidung im Chat. Die benötigte Sparrate läuft
// serverseitig über services/sparziel.py, dieselbe Annuitäten-Familie wie die
// Rechner-Seite, nur umgekehrt: hier ist das Endkapital vorgegeben.

const SPARZIEL_PIGGY_PATH = 'M11 17h3v2a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a3.16 3.16 0 0 0 2-2h1a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-1a5 5 0 0 0-2-4V3a4 4 0 0 0-3.2 1.6l-.3.4H11a6 6 0 0 0-6 6v1a5 5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1z';
// y-Bereich, den der Pfad im 24er viewBox tatsächlich einnimmt (empirisch) —
// der Füllstand soll am Bauch beginnen und an der Oberkante enden, nicht am
// Rand des vollen 0–24-Rahmens.
const SPARZIEL_PIGGY_TOP = 3;
const SPARZIEL_PIGGY_BOTTOM = 20;

function sparzielFuellY(fortschrittPct) {
  const p = Math.max(0, Math.min(100, fortschrittPct)) / 100;
  const spanne = SPARZIEL_PIGGY_BOTTOM - SPARZIEL_PIGGY_TOP;
  return { y: SPARZIEL_PIGGY_BOTTOM - spanne * p, h: spanne * p };
}

function renderSparziele() {
  const container = document.getElementById('sparziele-grid');
  if (!container) return;
  const liste = [...state.sparziele].filter(s => !s.archiviert);

  if (!liste.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="${SPARZIEL_PIGGY_PATH}"/><path d="M16 10h.01"/><path d="M2 8v1a2 2 0 0 0 2 2h1"/>
        </svg>
        <p>Noch kein Sparziel angelegt — leg dir eins an, z. B. für die nächste große Reise.</p>
        <button class="btn btn-primary btn-sm" onclick="openSparzielForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Erstes Sparziel hinzufügen
        </button>
      </div>`;
    return;
  }

  container.innerHTML = liste.map(sparzielKarteHtml).join('');
}

function sparzielKarteHtml(s) {
  const fortschrittPct = Math.min(s.fortschritt_pct, 100);
  const { y: fillY, h: fillH } = sparzielFuellY(fortschrittPct);
  const erreicht = s.aktueller_stand >= s.zielbetrag;
  const restTxt = s.monate_bis_ziel > 0 ? `noch ${formatRestlaufzeit(s.monate_bis_ziel)}` : 'Zieldatum erreicht';
  const clipId = `sparziel-clip-${s.id}`;

  return `
    <div class="sparziel-card" data-sparziel-id="${s.id}">
      <div class="sparziel-card-head">
        <div>
          <h3>${escapeHtml(s.name)}</h3>
          <p class="sparziel-sub">Ziel: ${fmt.date(s.zieldatum)} · ${restTxt}</p>
          ${s.aufbewahrungsort ? `<p class="sparziel-ort">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
            ${escapeHtml(s.aufbewahrungsort)}
          </p>` : ''}
        </div>
        <div class="sparziel-card-actions">
          <button class="btn-icon" onclick="openSparzielForm(${s.id})" title="Bearbeiten">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteSparziel(${s.id})" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      ${erreicht ? `<div class="sparziel-erreicht-banner">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg>
        Ziel erreicht — das Sparschwein ist voll!
      </div>` : ''}

      <div class="sparziel-piggy-wrap" id="sparziel-piggy-wrap-${s.id}">
        <svg class="sparziel-piggy" viewBox="0 0 24 24">
          <defs>
            <clipPath id="${clipId}">
              <rect id="sparziel-rect-${s.id}" class="sparziel-piggy-fill-rect" x="0" y="${fillY}" width="24" height="${fillH}"/>
            </clipPath>
          </defs>
          <path class="sparziel-piggy-fill" clip-path="url(#${clipId})" d="${SPARZIEL_PIGGY_PATH}"/>
          <path class="sparziel-piggy-outline" d="${SPARZIEL_PIGGY_PATH}"/>
          <path class="sparziel-piggy-outline" d="M16 10h.01"/>
          <path class="sparziel-piggy-coin-slot" d="M2 8v1a2 2 0 0 0 2 2h1"/>
        </svg>
      </div>

      <div class="sparziel-progress-numbers">
        <div class="stand mono">${fmt.eur(s.aktueller_stand)}<span class="ziel"> / ${fmt.eur(s.zielbetrag)}</span></div>
        <div class="pct mono" id="sparziel-pct-${s.id}">${fortschrittPct.toFixed(0)} %</div>
      </div>
      <div class="sparziel-milestones">
        ${[0, 25, 50, 75].map(start => {
          const anteil = Math.max(0, Math.min(1, (fortschrittPct - start) / 25));
          return `<div class="ms" style="--ms-fill:${anteil}"></div>`;
        }).join('')}
      </div>

      <div class="sparziel-stats">
        <div><span class="label">Benötigte Rate</span><span class="value">${s.benoetigte_monatsrate > 0 ? fmt.eur(s.benoetigte_monatsrate) + ' /Mon.' : '—'}</span></div>
        <div><span class="label">Restbetrag</span><span class="value">${fmt.eur(s.restbetrag)}</span></div>
      </div>

      <button class="btn btn-primary sparziel-feed-btn" onclick="openFuetternForm(${s.id})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
          <path d="M13.744 17.736a 6 6 0 1 1-7.48-7.48"/><path d="M15 6h1v4"/><path d="m6.134 14.768.866-.5 2 3.464"/><circle cx="16" cy="8" r="6"/>
        </svg>
        Füttern
      </button>

      <details class="sparziel-history">
        <summary>Fütterungen (${s.fuetterungen.length})</summary>
        <div class="sparziel-history-list">
          ${s.fuetterungen.length ? s.fuetterungen.map(f => `
            <div class="sparziel-history-row">
              <span class="datum">${fmt.date(f.datum)}</span>
              <span class="notiz">${escapeHtml(f.notiz ?? '')}</span>
              <span class="betrag">+ ${fmt.eur(f.betrag)}</span>
              <button class="btn-icon" onclick="deleteFuetterung(${s.id}, ${f.id})" title="Fütterung löschen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>`).join('') : '<p class="form-hint">Noch keine Fütterung erfasst.</p>'}
        </div>
      </details>
    </div>`;
}

window.openSparzielForm = function(id = null) {
  state.editingId = id;
  const s = id ? state.sparziele.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = id ? 'Sparziel bearbeiten' : 'Sparziel hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Name <span class="required">*</span></label>
      <input id="f-sz-name" class="form-input" placeholder="z. B. Weltreise" value="${escapeHtml(s?.name ?? '')}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Zielbetrag (€) <span class="required">*</span></label>
        <input id="f-sz-ziel" class="form-input mono" type="number" step="100" min="0" value="${s?.zielbetrag ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Zieldatum <span class="required">*</span></label>
        <input id="f-sz-datum" class="form-input" type="date" value="${fmt.dateISO(s?.zieldatum) || ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Zinssatz (% p. a.)</label>
      <input id="f-sz-zins" class="form-input mono" type="number" step="0.1" min="0" value="${s ? (s.zinssatz * 100) : 0}">
      <p class="form-hint">Nur relevant, falls das Ersparte z. B. auf einem verzinsten Tagesgeldkonto liegt.</p>
    </div>
    <div class="form-group">
      <label class="form-label">Wo liegt das Geld?</label>
      <input id="f-sz-ort" class="form-input" placeholder="z. B. Tagesgeldkonto ING, Extra-Sparbuch, Bargeld im Safe" value="${escapeHtml(s?.aufbewahrungsort ?? '')}">
      <p class="form-hint">Reiner Hinweistext — keine Kontoverknüpfung, das Sparziel bleibt unabhängig vom tatsächlichen Kontostand.</p>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <textarea id="f-sz-notiz" class="form-input" rows="2" style="resize:vertical">${escapeHtml(s?.notiz ?? '')}</textarea>
    </div>`;
  document.getElementById('modal-submit').onclick = submitSparzielForm;
  openModal();
};

async function submitSparzielForm() {
  const data = {
    name: document.getElementById('f-sz-name').value.trim(),
    zielbetrag: parseFloat(document.getElementById('f-sz-ziel').value) || 0,
    zieldatum: document.getElementById('f-sz-datum').value || null,
    zinssatz: (parseFloat(document.getElementById('f-sz-zins').value) || 0) / 100,
    aufbewahrungsort: document.getElementById('f-sz-ort').value.trim() || null,
    notiz: document.getElementById('f-sz-notiz').value.trim() || null,
  };
  if (!data.name) return toast('Bitte einen Namen fürs Sparziel eingeben.');
  if (data.zielbetrag <= 0) return toast('Bitte einen Zielbetrag über 0 € eingeben.');
  if (!data.zieldatum) return toast('Bitte ein Zieldatum eingeben.');
  try {
    if (state.editingId) {
      const upd = await api.sparziele.update(state.editingId, data);
      state.sparziele = state.sparziele.map(s => s.id === state.editingId ? upd : s);
      toast('Sparziel aktualisiert.');
    } else {
      const neu = await api.sparziele.create(data);
      state.sparziele.push(neu);
      toast('Sparziel angelegt.');
    }
    closeModal();
    renderSparziele();
  } catch (e) { toast(e.message); }
}

window.deleteSparziel = async function(id) {
  const name = state.sparziele.find(x => x.id === id)?.name ?? '';
  if (!confirm(`Sparziel „${name}" wirklich löschen? Alle Fütterungen gehen dabei mit verloren.`)) return;
  try {
    await api.sparziele.delete(id);
    state.sparziele = state.sparziele.filter(x => x.id !== id);
    renderSparziele();
    toast('Sparziel gelöscht.');
  } catch (e) { toast(e.message); }
};

window.openFuetternForm = function(id) {
  const s = state.sparziele.find(x => x.id === id);
  if (!s) return;
  state.editingId = id;
  document.getElementById('modal-title').textContent = `${s.name} füttern`;
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Betrag (€) <span class="required">*</span></label>
      <input id="f-szf-betrag" class="form-input mono" type="number" step="10" min="0" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Datum</label>
      <input id="f-szf-datum" class="form-input" type="date" value="${fmt.dateISO(new Date().toISOString())}">
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <input id="f-szf-notiz" class="form-input" placeholder="z. B. Geburtstagsgeld">
    </div>`;
  document.getElementById('modal-submit').onclick = () => submitFuetterung(id);
  openModal();
  // openModal() setzt den Button-Text auf den Standard "Speichern" zurück —
  // die eigene Beschriftung muss deshalb NACH dem Öffnen gesetzt werden.
  document.getElementById('modal-submit').textContent = 'Füttern';
};

async function submitFuetterung(sparzielId) {
  const betrag = parseFloat(document.getElementById('f-szf-betrag').value) || 0;
  if (betrag <= 0) return toast('Bitte einen Betrag über 0 € eingeben.');
  const data = {
    betrag,
    datum: document.getElementById('f-szf-datum').value || fmt.dateISO(new Date().toISOString()),
    notiz: document.getElementById('f-szf-notiz').value.trim() || null,
  };
  try {
    const upd = await api.sparziele.fuettern(sparzielId, data);
    closeModal();
    animateFuetterung(sparzielId, upd);
  } catch (e) { toast(e.message); }
}

// Lässt den Füllstand im bereits vorhandenen DOM-Element hochlaufen (CSS
// transition auf y/height greift nur, wenn dasselbe Element bestehen bleibt —
// ein sofortiges volles Re-Render würde ohne Übergang direkt zum Endwert
// springen) und spielt Bounce + Münzwurf ab. Der volle Re-Render danach holt
// Statistiken/Verlauf nach, ohne noch etwas sichtbar zu verändern.
function animateFuetterung(sparzielId, updatedSparziel) {
  state.sparziele = state.sparziele.map(s => s.id === sparzielId ? updatedSparziel : s);

  const rect = document.getElementById(`sparziel-rect-${sparzielId}`);
  const pctEl = document.getElementById(`sparziel-pct-${sparzielId}`);
  const wrap = document.getElementById(`sparziel-piggy-wrap-${sparzielId}`);
  if (!rect || !wrap) { renderSparziele(); return; }

  const { y, h } = sparzielFuellY(Math.min(updatedSparziel.fortschritt_pct, 100));
  rect.setAttribute('y', y);
  rect.setAttribute('height', h);
  if (pctEl) pctEl.textContent = `${Math.min(updatedSparziel.fortschritt_pct, 100).toFixed(0)} %`;

  wrap.classList.add('is-feeding');
  const coin = document.createElement('div');
  coin.className = 'sparziel-coin';
  wrap.appendChild(coin);

  toast('Gefüttert!');
  setTimeout(() => {
    wrap.classList.remove('is-feeding');
    coin.remove();
    renderSparziele();
  }, 700);
}

window.deleteFuetterung = async function(sparzielId, fuetterungId) {
  if (!confirm('Diese Fütterung wirklich löschen?')) return;
  try {
    const upd = await api.sparziele.fuetterungLoeschen(sparzielId, fuetterungId);
    state.sparziele = state.sparziele.map(s => s.id === sparzielId ? upd : s);
    renderSparziele();
    toast('Fütterung gelöscht.');
  } catch (e) { toast(e.message); }
};

window.openDarlehenForm = function(id = null) {
  state.editingId = id;
  const d = id ? state.darlehen.find(x => x.id === id) : null;

  const isTilgung = (d?.darlehen_typ ?? 'annuitaet') === 'tilgungsdarlehen';

  document.getElementById('modal-title').textContent = id ? 'Darlehen bearbeiten' : 'Darlehen hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Bezeichnung <span class="required">*</span></label>
        <input id="f-bez" class="form-input" value="${escapeHtml(d?.bezeichnung ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Gläubiger <span class="required">*</span></label>
        <input id="f-glaeubiger" class="form-input" value="${escapeHtml(d?.glaeubiger ?? '')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Ursprungsbetrag (€) <span class="required">*</span></label>
        <input id="f-urspr" class="form-input" type="number" step="0.01" value="${d?.urspr_betrag ?? 0}">
      </div>
      <div class="form-group">
        <label class="form-label">Restschuld (€) — Stand ${new Date().toLocaleDateString('de-DE')} <span class="required">*</span></label>
        <input id="f-restschuld" class="form-input" type="number" step="0.01" value="${d?.restschuld ?? 0}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Zinssatz (%) <span class="required">*</span></label>
        <input id="f-zinssatz" class="form-input" type="number" step="0.001" value="${d ? (d.zinssatz * 100).toFixed(3) : ''}">
        <p class="form-hint">z. B. 3.5 für 3,50 %</p>
      </div>
      <div class="form-group">
        <label class="form-label">Mein Anteil (%)</label>
        <input id="f-anteil" class="form-input mono" type="number" step="0.01" min="0" max="100" value="${d?.anteil_pct ?? 100}">
        <p class="form-hint">z. B. 50 bei GbR-Hälfte</p>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Darlehenstyp <span class="required">*</span></label>
        <select id="f-darlehen-typ" class="form-select"
          onchange="darlehenTypToggle(this.value)">
          <option value="annuitaet" ${!isTilgung ? 'selected' : ''}>Annuitätendarlehen (konstante Rate)</option>
          <option value="tilgungsdarlehen" ${isTilgung ? 'selected' : ''}>Tilgungsdarlehen (sinkende Rate)</option>
        </select>
      </div>
    </div>
    <div id="f-rate-row" class="form-group" style="display:${isTilgung ? 'none' : 'block'}">
      <label class="form-label">Monatliche Rate (€) <span class="required">*</span></label>
      <input id="f-rate" class="form-input" type="number" step="0.01" value="${d?.rate_monatlich ?? 0}">
    </div>
    <div id="f-tilgung-row" class="form-group" style="display:${isTilgung ? 'block' : 'none'}">
      <label class="form-label">Feste monatliche Tilgung (€) <span class="required">*</span></label>
      <input id="f-tilgungsrate" class="form-input" type="number" step="0.01"
        value="${d?.tilgungsrate_monatlich ?? ''}">
      <p class="form-hint">Der Zinsanteil sinkt mit der Restschuld — die Gesamtrate verringert sich monatlich.</p>
    </div>
    <div class="form-group">
      <label class="form-label">Zinsbindung bis</label>
      <input id="f-zinsbindung" class="form-input" type="date" value="${fmt.dateISO(d?.zinsbindung_bis)}">
    </div>
    <div class="form-group">
      <label class="form-label">Restlaufzeit bei aktuellen Konditionen</label>
      <div id="f-restlaufzeit-display" class="form-input" style="background:var(--input-bg,#f8f8f8);color:var(--wash-grey);cursor:default;min-height:42px;display:flex;align-items:center">
        — wird automatisch berechnet
      </div>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
        <input id="f-ust" type="checkbox" ${d?.hat_ust_auf_zinsen ? 'checked' : ''}>
        19 % Umsatzsteuer auf Zinsen (gewerbliches Darlehen)
      </label>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
        <input id="f-sonder" type="checkbox" ${d?.sondertilgung_moeglich ? 'checked' : ''}
          onchange="document.getElementById('f-sonder-betrag-row').style.display=this.checked?'block':'none'">
        Sondertilgung möglich
      </label>
    </div>
    <div id="f-sonder-betrag-row" class="form-group" style="display:${d?.sondertilgung_moeglich ? 'block' : 'none'}">
      <label class="form-label">Max. jährliche Sondertilgung (€)</label>
      <input id="f-sonder-betrag" class="form-input" type="number" step="0.01"
        value="${d?.sondertilgung_betrag ?? ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <textarea id="f-notiz" class="form-input" rows="3">${escapeHtml(d?.notiz ?? '')}</textarea>
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('darlehen', id)}
  `;

  window.darlehenTypToggle = function(typ) {
    const isTilg = typ === 'tilgungsdarlehen';
    document.getElementById('f-rate-row').style.display    = isTilg ? 'none' : 'block';
    document.getElementById('f-tilgung-row').style.display = isTilg ? 'block' : 'none';
    updateRestlaufzeit();
  };

  function updateRestlaufzeit() {
    const restschuld = parseFloat(document.getElementById('f-restschuld').value) || 0;
    const zinssatz   = (parseFloat(document.getElementById('f-zinssatz').value) || 0) / 100;
    const el         = document.getElementById('f-restlaufzeit-display');
    delete el.dataset.monate;
    const typ = document.getElementById('f-darlehen-typ')?.value ?? 'annuitaet';

    let res;
    if (typ === 'tilgungsdarlehen') {
      const tilgung = parseFloat(document.getElementById('f-tilgungsrate')?.value) || 0;
      if (!restschuld || !tilgung) { el.textContent = '— Restschuld und Tilgungsrate eingeben'; return; }
      res = { monate: Math.ceil(restschuld / tilgung) };
    } else {
      const rate = parseFloat(document.getElementById('f-rate').value) || 0;
      res = restlaufzeitMonate(restschuld, zinssatz, rate);
      if (res.fehler === 'unvollstaendig') { el.textContent = '— Restschuld und Rate eingeben'; return; }
      if (res.fehler === 'rate_zu_niedrig') { el.textContent = 'Rate deckt nicht die Zinsen'; return; }
    }

    const endDatum = new Date();
    endDatum.setMonth(endDatum.getMonth() + res.monate);
    const endLabel = endDatum.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    el.textContent = `${formatRestlaufzeit(res.monate)} (abbezahlt ${endLabel})`;
    el.dataset.monate = res.monate;
  }

  ['f-restschuld','f-zinssatz','f-rate','f-tilgungsrate'].forEach(fid =>
    document.getElementById(fid)?.addEventListener('input', updateRestlaufzeit)
  );
  updateRestlaufzeit();

  document.getElementById('modal-submit').onclick = submitDarlehenForm;
  openModal();
  if (id) loadAnhaenge('darlehen', id);
};

async function submitDarlehenForm() {
  const zinssatzInput = parseFloat(document.getElementById('f-zinssatz').value);
  const typ = document.getElementById('f-darlehen-typ')?.value ?? 'annuitaet';
  const isTilg = typ === 'tilgungsdarlehen';
  const data = {
    bezeichnung:            document.getElementById('f-bez').value.trim(),
    glaeubiger:             document.getElementById('f-glaeubiger').value.trim(),
    urspr_betrag:           parseFloat(document.getElementById('f-urspr').value) || 0,
    restschuld:             parseFloat(document.getElementById('f-restschuld').value) || 0,
    zinssatz:               zinssatzInput / 100,
    anteil_pct:             parseFloat(document.getElementById('f-anteil').value) || 100,
    darlehen_typ:           typ,
    rate_monatlich:         isTilg ? 0 : (parseFloat(document.getElementById('f-rate').value) || 0),
    tilgungsrate_monatlich: isTilg ? (parseFloat(document.getElementById('f-tilgungsrate')?.value) || null) : null,
    zinsbindung_bis:        document.getElementById('f-zinsbindung').value || null,
    restlaufzeit:           parseInt(document.getElementById('f-restlaufzeit-display').dataset.monate) || null,
    sondertilgung_moeglich: document.getElementById('f-sonder').checked,
    sondertilgung_betrag:   parseFloat(document.getElementById('f-sonder-betrag')?.value) || null,
    hat_ust_auf_zinsen:     document.getElementById('f-ust').checked,
    notiz:                  document.getElementById('f-notiz').value.trim() || null,
  };
  if (!data.bezeichnung || !data.glaeubiger) return toast('Bitte Bezeichnung und Gläubiger ausfüllen.');
  try {
    if (state.editingId) {
      await api.darlehen.update(state.editingId, data);
      toast('Darlehen aktualisiert.');
    } else {
      await api.darlehen.create(data);
      toast('Darlehen gespeichert.');
    }
    closeModal();
    await refresh();
  } catch (e) { toast(e.message); }
}

window.deleteDarlehen = async function(id) {
  const name = state.darlehen.find(x => x.id === id)?.bezeichnung ?? '';
  if (!confirm(`Darlehen „${name}" wirklich löschen?`)) return;
  try {
    await api.darlehen.delete(id);
    toast('Darlehen gelöscht.');
    await refresh();
  } catch (e) { toast(e.message); }
};

// ── Depots View ─────────────────────────────────────────────────────────────

function renderDepots() {
  const sumDep = state.depots.reduce((s, d) => s + (Number(d.wert_aktuell) || 0), 0);
  const elSum = document.getElementById('dep-sum-depots');
  if (elSum) elSum.textContent = fmt.eur(sumDep);

  const tbody = document.getElementById('depots-tbody');
  if (!tbody) return;

  if (!state.depots.length) {
    tbody.innerHTML = `<tr><td colspan="5">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        <p>Noch keine Depots erfasst.</p>
        <button class="btn btn-primary btn-sm" onclick="openDepotForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Erstes Depot hinzufügen
        </button>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = state.depots.map(dep => `
    <tr>
      <td>
        <strong>${escapeHtml(dep.name)}</strong>
        ${dep.depotinhaber ? `<br><span class="text-muted" style="font-size:0.75rem">${escapeHtml(dep.depotinhaber)}</span>` : ''}
        ${dep.bitwarden_name ? `<br><a href="https://vault.bitwarden.com" target="_blank" rel="noopener" class="bw-link" title="In Bitwarden öffnen: ${escapeHtml(dep.bitwarden_name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> ${escapeHtml(dep.bitwarden_name)}</a>` : ''}
      </td>
      <td class="mono text-muted" style="font-size:0.8rem">${dep.wertpapierdepot_nr ?? '—'}</td>
      <td class="mono text-muted" style="font-size:0.8rem">${dep.verrechnungskonto ?? '—'}</td>
      <td class="right mono">
        ${fmt.eur(dep.wert_aktuell)}
        ${aktualisiertHtml(dep.aktualisiert_am)}
      </td>
      <td class="right"><div class="action-cell">
        <button class="btn-icon" onclick="openDepotForm(${dep.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteDepot(${dep.id})" title="Löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div></td>
    </tr>
  `).join('');
}

window.openDepotForm = function(id = null) {
  state.editingId = id;
  const dep = id ? state.depots.find(x => x.id === id) : null;

  document.getElementById('modal-title').textContent = id ? 'Depot bearbeiten' : 'Depot hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-section-head">Depot</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Name / Broker <span class="required">*</span></label>
        <input id="f-name" class="form-input" value="${escapeHtml(dep?.name ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Depotinhaber</label>
        <input id="f-depotinhaber" class="form-input" value="${escapeHtml(dep?.depotinhaber ?? '')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Depotnummer</label>
        <input id="f-depot-nr" class="form-input mono" value="${escapeHtml(dep?.wertpapierdepot_nr ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">BIC</label>
        <input id="f-depot-bic" class="form-input mono" value="${escapeHtml(dep?.depot_bic ?? '')}">
      </div>
    </div>

    <div class="form-section-head">Verrechnungskonto</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">IBAN</label>
        <input id="f-verrechnungskonto" class="form-input mono" value="${escapeHtml(dep?.verrechnungskonto ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">BIC</label>
        <input id="f-verrechnungskonto-bic" class="form-input mono" value="${escapeHtml(dep?.verrechnungskonto_bic ?? '')}">
      </div>
    </div>

    <div class="form-section-head">Auszahlungskonto</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Name des Kontoinhabers</label>
        <input id="f-auszahlungskonto-name" class="form-input" value="${escapeHtml(dep?.auszahlungskonto_name ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Bank</label>
        <input id="f-auszahlungskonto-bank" class="form-input" value="${escapeHtml(dep?.auszahlungskonto_bank ?? '')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">IBAN</label>
        <input id="f-auszahlungskonto" class="form-input mono" value="${escapeHtml(dep?.auszahlungskonto ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">BIC</label>
        <input id="f-auszahlungskonto-bic" class="form-input mono" value="${escapeHtml(dep?.auszahlungskonto_bic ?? '')}">
      </div>
    </div>

    <div class="form-section-head">Bewertung & Sonstiges</div>
    <div class="form-group">
      <label class="form-label">Aktueller Gesamtwert (€) <span class="required">*</span></label>
      <input id="f-wert" class="form-input" type="number" step="0.01" value="${dep?.wert_aktuell ?? 0}">
      <p class="form-hint">Summe aller Positionen zum heutigen Kurs</p>
    </div>
    <div class="form-group">
      <label class="form-label">Passwortsafe-Eintrag</label>
      <input id="f-bitwarden" class="form-input" value="${escapeHtml(dep?.bitwarden_name ?? '')}">
      <p class="form-hint">Klick in der Tabelle öffnet vault.bitwarden.com</p>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <textarea id="f-notiz" class="form-input" rows="3">${escapeHtml(dep?.notiz ?? '')}</textarea>
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('depot', id)}
  `;
  document.getElementById('modal-submit').onclick = submitDepotForm;
  openModal();
  if (id) loadAnhaenge('depot', id);
};

async function submitDepotForm() {
  const data = {
    name:                   document.getElementById('f-name').value.trim(),
    depotinhaber:           document.getElementById('f-depotinhaber').value.trim() || null,
    wertpapierdepot_nr:     document.getElementById('f-depot-nr').value.trim() || null,
    depot_bic:              document.getElementById('f-depot-bic').value.trim() || null,
    verrechnungskonto:      document.getElementById('f-verrechnungskonto').value.trim() || null,
    verrechnungskonto_bic:  document.getElementById('f-verrechnungskonto-bic').value.trim() || null,
    auszahlungskonto:       document.getElementById('f-auszahlungskonto').value.trim() || null,
    auszahlungskonto_name:  document.getElementById('f-auszahlungskonto-name').value.trim() || null,
    auszahlungskonto_bank:  document.getElementById('f-auszahlungskonto-bank').value.trim() || null,
    auszahlungskonto_bic:   document.getElementById('f-auszahlungskonto-bic').value.trim() || null,
    wert_aktuell:           parseFloat(document.getElementById('f-wert').value) || 0,
    bitwarden_name:         document.getElementById('f-bitwarden').value.trim() || null,
    notiz:                  document.getElementById('f-notiz').value.trim() || null,
  };
  if (!data.name) return toast('Bitte einen Namen eingeben.');
  try {
    if (state.editingId) {
      await api.depots.update(state.editingId, data);
      toast('Depot aktualisiert.');
    } else {
      await api.depots.create(data);
      toast('Depot gespeichert.');
    }
    closeModal();
    await refresh();
  } catch (e) { toast(e.message); }
}

window.deleteDepot = async function(id) {
  const name = state.depots.find(x => x.id === id)?.name ?? '';
  if (!confirm(`Depot „${name}" wirklich löschen?`)) return;
  try {
    await api.depots.delete(id);
    toast('Depot gelöscht.');
    await refresh();
  } catch (e) { toast(e.message); }
};

// ── Sachwerte View ──────────────────────────────────────────────────────────

const SACHWERT_KATEGORIEN = [
  { value: 'immobilie', label: 'Immobilie' },
  { value: 'fahrzeug',  label: 'Fahrzeug' },
  { value: 'kunst',     label: 'Kunst / Sammlung' },
  { value: 'schmuck',   label: 'Schmuck / Uhren' },
  { value: 'elektronik',label: 'Elektronik' },
  { value: 'sonstiges', label: 'Sonstiges' },
];

function renderSachwerte() {
  const sumSw = state.sachwerte.reduce((s, w) => s + (Number(w.aktueller_wert) || 0) * (Number(w.anteil_pct ?? 100) / 100), 0);
  const elSum = document.getElementById('sw-sum-sachwerte');
  if (elSum) elSum.textContent = fmt.eur(sumSw);

  const tbody = document.getElementById('sachwerte-tbody');
  if (!tbody) return;

  if (!state.sachwerte.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <p>Noch keine Sachwerte erfasst.</p>
        <button class="btn btn-primary btn-sm" onclick="openSachwertForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
          Ersten Sachwert hinzufügen
        </button>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = state.sachwerte.map(s => {
    const katLabel = SACHWERT_KATEGORIEN.find(k => k.value === s.kategorie)?.label ?? s.kategorie;
    const wertEntwicklung = s.anschaffungswert
      ? ((s.aktueller_wert - s.anschaffungswert) / s.anschaffungswert * 100).toFixed(1)
      : null;

    // TÜV-Warnung: Tage bis zum TÜV berechnen
    let tuevHtml = '';
    if (s.kategorie === 'fahrzeug' && s.naechster_tuev) {
      const today = new Date(); today.setHours(0,0,0,0);
      const tuev  = new Date(s.naechster_tuev); tuev.setHours(0,0,0,0);
      const tage  = Math.ceil((tuev - today) / 86400000);
      const warn  = tage <= 30;
      const farbe = tage < 0 ? '#F87171' : warn ? '#F87171' : 'var(--wash-grey)';
      const text  = tage < 0  ? `TÜV überfällig (${Math.abs(tage)} Tage)`
                  : tage === 0 ? 'TÜV heute!'
                  : warn       ? `TÜV in ${tage} Tagen`
                  :              `TÜV ${fmt.date(s.naechster_tuev)}`;
      tuevHtml = `<br><span class="mono" style="font-size:0.7rem;color:${farbe}">${text}</span>`;
    }

    return `
    <tr>
      <td><strong>${s.bezeichnung}</strong>${tuevHtml}</td>
      <td><span class="badge badge-${s.kategorie}">${katLabel}</span></td>
      <td class="text-muted" style="font-size:0.8rem">${s.beschreibung ?? '—'}</td>
      <td class="mono" style="font-size:0.8rem">
        ${s.anschaffungsjahr ?? '—'}
        ${s.anschaffungswert ? `<br><span class="text-muted">${fmt.eur(s.anschaffungswert)}</span>` : ''}
        ${wertEntwicklung !== null ? `<br><span class="${parseFloat(wertEntwicklung) >= 0 ? 'text-green' : 'text-red'}" style="font-size:0.7rem">${wertEntwicklung >= 0 ? '+' : ''}${wertEntwicklung} %</span>` : ''}
      </td>
      <td class="right mono">
        ${(s.anteil_pct != null && Number(s.anteil_pct) < 100)
          ? `<strong>${fmt.eur(s.aktueller_wert * Number(s.anteil_pct) / 100)}</strong>
             <br><span class="text-muted" style="font-size:0.7rem">Gesamt: ${fmt.eur(s.aktueller_wert)}</span>`
          : fmt.eur(s.aktueller_wert)}
      </td>
      <td class="right"><div class="action-cell">
        <button class="btn-icon" onclick="openSachwertForm(${s.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteSachwert(${s.id})" title="Löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div></td>
    </tr>
  `}).join('');
}

window.openSachwertForm = function(id = null) {
  state.editingId = id;
  const s = id ? state.sachwerte.find(x => x.id === id) : null;

  document.getElementById('modal-title').textContent = id ? 'Sachwert bearbeiten' : 'Sachwert hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Bezeichnung <span class="required">*</span></label>
      <input id="f-bez" class="form-input" value="${escapeHtml(s?.bezeichnung ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Kategorie <span class="required">*</span></label>
      <select id="f-kat" class="form-select"
        onchange="document.getElementById('f-tuev-row').style.display=this.value==='fahrzeug'?'block':'none'">
        ${SACHWERT_KATEGORIEN.map(k =>
          `<option value="${k.value}" ${s?.kategorie === k.value ? 'selected' : ''}>${k.label}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Beschreibung</label>
      <input id="f-desc" class="form-input" value="${escapeHtml(s?.beschreibung ?? '')}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Aktueller Schätzwert (€) <span class="required">*</span></label>
        <input id="f-wert" class="form-input" type="number" step="0.01" value="${s?.aktueller_wert ?? 0}">
        <p class="form-hint">Gesamtwert des Objekts</p>
      </div>
      <div class="form-group">
        <label class="form-label">Mein Anteil (%)</label>
        <input id="f-anteil" class="form-input mono" type="number" step="0.01" min="0" max="100" value="${s?.anteil_pct ?? 100}">
        <p class="form-hint">z. B. 50 bei GbR-Hälfte</p>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Anschaffungswert (€)</label>
        <input id="f-anschaffwert" class="form-input" type="number" step="0.01" value="${s?.anschaffungswert ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Anschaffungsjahr</label>
        <input id="f-jahr" class="form-input" type="number" min="1900" max="2100" value="${s?.anschaffungsjahr ?? ''}">
      </div>
    </div>
    <div id="f-tuev-row" class="form-group" style="display:${s?.kategorie === 'fahrzeug' ? 'block' : 'none'}">
      <label class="form-label">Nächster TÜV</label>
      <input id="f-tuev" class="form-input" type="date" value="${fmt.dateISO(s?.naechster_tuev)}">
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('sachwert', id)}
  `;
  document.getElementById('modal-submit').onclick = submitSachwertForm;
  openModal();
  if (id) loadAnhaenge('sachwert', id);
};

async function submitSachwertForm() {
  const anschaffwert = document.getElementById('f-anschaffwert').value;
  const jahr = document.getElementById('f-jahr').value;
  const kategorie = document.getElementById('f-kat').value;
  const data = {
    bezeichnung:       document.getElementById('f-bez').value.trim(),
    kategorie:         kategorie,
    beschreibung:      document.getElementById('f-desc').value.trim() || null,
    aktueller_wert:    parseFloat(document.getElementById('f-wert').value) || 0,
    anteil_pct:        parseFloat(document.getElementById('f-anteil').value) || 100,
    anschaffungswert:  anschaffwert ? parseFloat(anschaffwert) : null,
    anschaffungsjahr:  jahr ? parseInt(jahr) : null,
    naechster_tuev:    kategorie === 'fahrzeug'
      ? (document.getElementById('f-tuev').value || null)
      : null,
  };
  if (!data.bezeichnung) return toast('Bitte Bezeichnung ausfüllen.');
  try {
    if (state.editingId) {
      await api.sachvermoegen.update(state.editingId, data);
      toast('Sachwert aktualisiert.');
    } else {
      await api.sachvermoegen.create(data);
      toast('Sachwert gespeichert.');
    }
    closeModal();
    await refresh();
  } catch (e) { toast(e.message); }
}

window.deleteSachwert = async function(id) {
  const name = state.sachwerte.find(x => x.id === id)?.bezeichnung ?? '';
  if (!confirm(`Sachwert „${name}" wirklich löschen?`)) return;
  try {
    await api.sachvermoegen.delete(id);
    toast('Sachwert gelöscht.');
    await refresh();
  } catch (e) { toast(e.message); }
};

// ── Snapshot ────────────────────────────────────────────────────────────────

window.createSnapshot = async function() {
  try {
    await api.networth.snapshot();
    toast('Snapshot gespeichert — Verlauf aktualisiert.');
    await refresh();
  } catch (e) { toast(e.message); }
};

// ── Modal ───────────────────────────────────────────────────────────────────

function openModal() {
  // Reset auf den Standard-Zustand — ein reiner Anzeige-Modal (z. B.
  // Tilgungsplan) blendet den Submit-Button danach gezielt wieder aus.
  const submitBtn = document.getElementById('modal-submit');
  submitBtn.textContent = 'Speichern';
  submitBtn.style.display = '';
  document.getElementById('modal-overlay').classList.add('open');
}

window.closeModal = function() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.querySelector('#modal-overlay .modal')?.classList.remove('modal--wide');
  state.editingId = null;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

async function refresh() {
  await loadAll();
  renderCurrentView();
  if (state.view !== 'dashboard') renderDashboard();
}

// ── Spending Plan ────────────────────────────────────────────────────────────

// IWT-Zielkorridore in % vom Nettoeinkommen
const IWT = {
  fixkosten:   { min: 0.50, max: 0.60, label: 'Ziel: 50–60 %', dot: 'dot-fix',  seg: 'sp-seg-fix'  },
  investments: { min: 0.10, max: 0.10, label: 'Ziel: 10 %',    dot: 'dot-inv',  seg: 'sp-seg-inv'  },
  sparziele:   { min: 0.05, max: 0.10, label: 'Ziel: 5–10 %',  dot: 'dot-spar', seg: 'sp-seg-spar' },
  gfs:         { min: 0.20, max: 0.35, label: 'Ziel: 20–35 %', dot: 'dot-gfs',  seg: 'sp-seg-gfs'  },
};

let spPlan = null;          // aktueller Plan (Objekt aus API)
let spSaveTimer = null;     // Debounce-Timer

function spGetPositionen(kat) {
  return (spPlan?.positionen ?? []).filter(p => p.kategorie === kat);
}

// Netto = Summe der Einnahme-Positionen. Solange keine erfasst sind,
// Fallback auf den manuell gespeicherten Wert (Rückwärtskompatibilität / Demo).
function spNetto() {
  const einnahmen = spGetPositionen('einnahmen');
  if (einnahmen.length) return einnahmen.reduce((s, p) => s + (Number(p.betrag) || 0), 0);
  return spPlan?.netto_monatlich ?? 0;
}

const SP_EMPF_LABEL = { ich: 'Ich', ehefrau: 'Ehefrau', beide: 'Beide' };

// Eine Einnahme-Zeile (modulweit, damit Voll-Render UND Append-in-place sie nutzen)
function einnahmeRowHtml(p) {
  return `
    <div class="sp-position sp-income-pos" data-pos-id="${p.id}">
      <input class="sp-pos-name" value="${escapeHtml(p.bezeichnung)}"
        placeholder="z. B. Gehalt"
        oninput="spQueueSaveName(${p.id}, this.value)"
        onblur="spSavePosName(${p.id}, this.value)"
        onkeydown="if(event.key==='Enter')this.blur()">
      <select class="sp-pos-empf" onchange="spSavePosEmpf(${p.id}, this.value)" title="Empfänger">
        ${['ich','ehefrau','beide'].map(e => `<option value="${e}"${(p.empfaenger??'ich')===e?' selected':''}>${SP_EMPF_LABEL[e]}</option>`).join('')}
      </select>
      <input class="sp-pos-amount" type="number" step="0.01" value="${p.betrag}"
        oninput="spRecalc(); spQueueSaveAmount(${p.id}, this.value)"
        onblur="spSavePosAmount(${p.id}, this.value)"
        onkeydown="if(event.key==='Enter')this.blur()">
      <span class="sp-pos-unit">€</span>
      <button class="sp-pos-delete" onclick="spDeletePos(${p.id})" title="Löschen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>`;
}

function spKatSumme(kat) {
  return spGetPositionen(kat).reduce((s, p) => s + (p.betrag || 0), 0);
}

// Automatisch aus anderen Modulen abgeleitete Fixkosten (monatlich).
// Darlehen → Monatsrate · Versicherungen/Verträge → Jahresbeitrag / 12.
function spAutoPositionen() {
  const items = [];
  for (const d of (state.darlehen ?? [])) {
    const betrag = (Number(d.rate_monatlich) || 0) * (Number(d.anteil_pct ?? 100) / 100);
    if (betrag > 0) items.push({ quelle: 'darlehen', view: 'darlehen', bezeichnung: d.bezeichnung, betrag });
  }
  for (const v of (state.versicherungen ?? [])) {
    const betrag = vsJahresbeitrag(v, 'beitrag') / 12;
    if (betrag > 0) items.push({ quelle: 'versicherung', view: 'versicherungen', bezeichnung: v.bezeichnung, betrag });
  }
  for (const v of (state.vertraege ?? [])) {
    const betrag = vsJahresbeitrag(v, 'kosten') / 12;
    if (betrag > 0) items.push({ quelle: 'vertrag', view: 'vertraege', bezeichnung: v.bezeichnung, betrag });
  }
  return items;
}

function spAutoTotal() {
  return spAutoPositionen().reduce((s, p) => s + p.betrag, 0);
}

function spSonstiges() {
  const sub = spKatSumme('fixkosten') + spAutoTotal();
  return sub * (spPlan?.sonstiges_puffer_pct ?? 0.05);
}

function spFixTotal()  { return spKatSumme('fixkosten') + spAutoTotal() + spSonstiges(); }
function spInvTotal()  { return spKatSumme('investments'); }
function spSparTotal() { return spKatSumme('sparziele'); }
function spGFS()       {
  const n = spNetto();
  return Math.max(0, n - spFixTotal() - spInvTotal() - spSparTotal());
}

function spPct(val) {
  const n = spNetto() || 1;
  return n ? val / n : 0;
}

function spPctColor(pct, min, max) {
  if (pct >= min - 0.005 && pct <= max + 0.005) return 'var(--ink-black)';
  if (pct > max + 0.05 || pct < min - 0.05) return '#F87171';
  return '#D97706';
}

async function renderSpendinPlan() {
  const el = document.getElementById('sp-content');
  if (!el) return;

  if (!spPlan) {
    el.innerHTML = `
      <div class="sp-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8M12 17v4"/>
          <path d="M7 8h10M7 12h6"/>
        </svg>
        <h3>Kein Spending Plan vorhanden</h3>
        <p>Erstelle deinen persönlichen Conscious Spending Plan nach der IWT-Methode — einmal eingerichtet, zeigt er dir auf einen Blick, ob deine Ausgaben im grünen Bereich liegen.</p>
        <button class="btn btn-primary" onclick="spCreateNew()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M12 5v14M5 12h14"/></svg>
          Neuen Plan erstellen
        </button>
      </div>`;
    return;
  }

  const netto    = spNetto();
  const fixT     = spFixTotal();
  const invT     = spInvTotal();
  const sparT    = spSparTotal();
  const gfs      = spGFS();
  const sonstT   = spSonstiges();
  const pctFix   = spPct(fixT);
  const pctInv   = spPct(invT);
  const pctSpar  = spPct(sparT);
  const pctGFS   = spPct(gfs);

  const fmtPct = v => (v * 100).toFixed(1) + ' %';
  const allocLabel = (key, pct, total, conf) => `
    <div class="sp-alloc-label">
      <div class="al-name">${{fixkosten:'Fixkosten',investments:'Investments',sparziele:'Spar-Ziele',gfs:'Guilt-Free'}[key]}</div>
      <div id="sp-al-pct-${key}" class="al-pct" style="color:${spPctColor(pct, conf.min, conf.max)}">
        <span id="sp-al-pct-val-${key}">${fmtPct(pct)}</span>
        <span id="sp-al-status-${key}" class="al-status ${conf.dot}"></span>
      </div>
      <div id="sp-al-target-${key}" class="al-target">${conf.label} · ${fmt.eur(total)}</div>
    </div>`;

  const renderPositionen = (kat) => spGetPositionen(kat).map(p => `
    <div class="sp-position" data-pos-id="${p.id}">
      <input class="sp-pos-name" value="${escapeHtml(p.bezeichnung)}"
        onblur="spSavePosName(${p.id}, this.value)"
        onkeydown="if(event.key==='Enter')this.blur()">
      <input class="sp-pos-amount" type="number" step="0.01" value="${p.betrag}"
        onblur="spSavePosAmount(${p.id}, this.value)"
        oninput="spRecalc()"
        onkeydown="if(event.key==='Enter')this.blur()">
      <span class="sp-pos-unit">€</span>
      <button class="sp-pos-delete" onclick="spDeletePos(${p.id})" title="Löschen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>`).join('');

  const renderEinnahmen = () => spGetPositionen('einnahmen').map(einnahmeRowHtml).join('');

  const QUELLE_LABEL = { darlehen: 'Darlehen', versicherung: 'Versicherung', vertrag: 'Vertrag' };
  const hatAuto = spAutoPositionen().length > 0;

  const renderAutoPositionen = () => {
    const auto = spAutoPositionen();
    if (!auto.length) return '';
    return `
      <div class="sp-group sp-group-auto">
        <div class="sp-group-head" title="Aktualisiert sich automatisch, sobald sich die Werte dort ändern.">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/></svg>
          Aus Darlehen, Versicherungen &amp; Verträgen
        </div>
        ${auto.map(p => `
        <div class="sp-position sp-position-auto" onclick="navigate('${p.view}')" title="Aus ${QUELLE_LABEL[p.quelle]} — zum Bearbeiten klicken">
          <span class="sp-pos-name-auto">
            ${escapeHtml(p.bezeichnung)}
            <span class="sp-pos-quelle">${QUELLE_LABEL[p.quelle]}</span>
          </span>
          <span class="sp-pos-amount-auto mono">${fmt.eur(p.betrag)}</span>
        </div>`).join('')}
      </div>`;
  };

  // Manuelle Fixkosten — nur mit Überschrift versehen, wenn auch Auto-Positionen existieren
  const renderManuelleFixkosten = () => {
    const rows = renderPositionen('fixkosten');
    if (!hatAuto) return rows;
    return `
      <div class="sp-group sp-group-manual">
        <div class="sp-group-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          Manuell eingetragen
        </div>
        ${rows}
      </div>`;
  };

  el.innerHTML = `
    <div class="page-header">
      <div style="flex:1">
        <input class="sp-plan-name" value="${escapeHtml(spPlan.name)}"
          onblur="spSavePlanField('name', this.value)"
          onkeydown="if(event.key==='Enter')this.blur()">
        <p style="font-size:var(--text-sm);color:var(--wash-grey);margin-top:0.25rem;display:flex;align-items:center;gap:0.35rem">
          <span>Stand:</span>
          <input type="date" class="sp-stand-input mono" value="${fmt.dateISO(spPlan.stand)}"
            onchange="spSavePlanField('stand', this.value || null)"
            title="Datum anpassen — z. B. auf den aktuellen Monat">
        </p>
      </div>
    </div>

    <!-- Allokations-Balken -->
    <div class="sp-alloc-bar">
      <div class="sp-alloc-segments" id="sp-alloc-segs">
        <div class="sp-seg sp-seg-fix"  style="width:${(pctFix*100).toFixed(1)}%"></div>
        <div class="sp-seg sp-seg-inv"  style="width:${(pctInv*100).toFixed(1)}%"></div>
        <div class="sp-seg sp-seg-spar" style="width:${(pctSpar*100).toFixed(1)}%"></div>
        <div class="sp-seg sp-seg-gfs"  style="width:${(pctGFS*100).toFixed(1)}%"></div>
      </div>
      <div class="sp-alloc-labels" id="sp-alloc-labels">
        ${allocLabel('fixkosten',   pctFix,  fixT,  IWT.fixkosten)}
        ${allocLabel('investments', pctInv,  invT,  IWT.investments)}
        ${allocLabel('sparziele',   pctSpar, sparT, IWT.sparziele)}
        ${allocLabel('gfs',         pctGFS,  gfs,   IWT.gfs)}
      </div>
    </div>

    <!-- Kategorien-Karten -->
    <div class="sp-grid">

      <!-- Fixkosten -->
      <div class="sp-card">
        <div class="sp-card-header">
          <div class="sp-card-dot dot-fix"></div>
          <div class="sp-card-title">Fixe Kosten</div>
          <div class="sp-card-target">${IWT.fixkosten.label}</div>
          <div class="sp-card-pct" id="sp-fix-pct"
            style="color:${spPctColor(pctFix,0.50,0.60)}">${fmtPct(pctFix)}</div>
        </div>
        <div class="sp-position-list" id="sp-fix-list">
          ${renderAutoPositionen()}
          ${renderManuelleFixkosten()}
        </div>
        <div class="sp-sonstiges-row">
          <svg class="sp-sonstiges-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="16" height="16"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/></svg>
          <span class="sp-sonstiges-label">Sonstiges-Puffer <input id="sp-puffer-input"
            class="sp-sonstiges-input"
            type="number" step="1" min="0" max="30"
            value="${Math.round((spPlan.sonstiges_puffer_pct ?? 0.05) * 100)}"
            onblur="spSavePlanField('sonstiges_puffer_pct', this.value/100)"
            oninput="spRecalc()"
            onkeydown="if(event.key==='Enter')this.blur()"> % auf Fixkosten</span>
          <span id="sp-sonstiges-val" class="sp-sonstiges-val mono">${fmt.eur(sonstT)}</span>
        </div>
        <button class="sp-add-btn" onclick="spAddPos('fixkosten')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
          Position hinzufügen
        </button>
        <div class="sp-total-row">
          <span class="sp-total-label">Gesamt Fixkosten</span>
          <span class="sp-total-value" id="sp-fix-total">${fmt.eur(fixT)}</span>
        </div>
      </div>

      <!-- Rechte Spalte: Einnahmen, Investments, Spar-Ziele, Guilt-Free gestapelt -->
      <div class="sp-col-right">
      <!-- Einnahmen-Karte -->
      <div class="sp-card sp-card-income">
        <div class="sp-card-header">
          <div class="sp-card-dot dot-income"></div>
          <div class="sp-card-title">Einnahmen</div>
          <div class="sp-card-target">Woraus sich das Netto-Einkommen zusammensetzt</div>
          <div class="sp-card-pct mono" id="sp-income-total-head">${fmt.eur(spNetto())}</div>
        </div>
        <div class="sp-position-list" id="sp-einnahmen-list">
          ${renderEinnahmen() || '<p class="sp-income-empty">Noch keine Einnahmen erfasst — füge deine Einkommensquellen hinzu.</p>'}
        </div>
        <button class="sp-add-btn" onclick="spAddPos('einnahmen')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
          Einnahme hinzufügen
        </button>
        <div class="sp-total-row">
          <span class="sp-total-label">Summe Einnahmen (Netto)</span>
          <span class="sp-total-value" id="sp-income-total">${fmt.eur(spNetto())}</span>
        </div>
      </div>

      <!-- Investments -->
      <div class="sp-card">
        <div class="sp-card-header">
          <div class="sp-card-dot dot-inv"></div>
          <div class="sp-card-title">Investments</div>
          <div class="sp-card-target">${IWT.investments.label}</div>
          <div class="sp-card-pct" id="sp-inv-pct"
            style="color:${spPctColor(pctInv,0.10,0.10)}">${fmtPct(pctInv)}</div>
        </div>
        <div class="sp-position-list" id="sp-inv-list">
          ${renderPositionen('investments')}
        </div>
        <button class="sp-add-btn" onclick="spAddPos('investments')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
          Position hinzufügen
        </button>
        <div class="sp-total-row">
          <span class="sp-total-label">Gesamt Investments</span>
          <span class="sp-total-value" id="sp-inv-total">${fmt.eur(invT)}</span>
        </div>
      </div>

      <!-- Spar-Ziele -->
      <div class="sp-card">
        <div class="sp-card-header">
          <div class="sp-card-dot dot-spar"></div>
          <div class="sp-card-title">Spar-Ziele</div>
          <div class="sp-card-target">${IWT.sparziele.label}</div>
          <div class="sp-card-pct" id="sp-spar-pct"
            style="color:${spPctColor(pctSpar,0.05,0.10)}">${fmtPct(pctSpar)}</div>
        </div>
        <div class="sp-position-list" id="sp-spar-list">
          ${renderPositionen('sparziele')}
        </div>
        <button class="sp-add-btn" onclick="spAddPos('sparziele')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
          Ziel hinzufügen
        </button>
        <div class="sp-total-row">
          <span class="sp-total-label">Gesamt Spar-Ziele</span>
          <span class="sp-total-value" id="sp-spar-total">${fmt.eur(sparT)}</span>
        </div>
      </div>

      <!-- Guilt-Free Spending -->
      <div class="sp-card">
        <div class="sp-card-header">
          <div class="sp-card-dot dot-gfs"></div>
          <div class="sp-card-title">Guilt-Free Spending</div>
          <div class="sp-card-target">${IWT.gfs.label}</div>
          <div class="sp-card-pct" id="sp-gfs-pct"
            style="color:${spPctColor(pctGFS,0.20,0.35)}">${fmtPct(pctGFS)}</div>
        </div>
        <div class="sp-gfs-card">
          <div class="sp-alloc-label" style="text-align:center">
            <div class="al-name">Verbleibendes Budget</div>
          </div>
          <div class="sp-gfs-amount" id="sp-gfs-amount"
            style="color:${spPctColor(pctGFS,0.20,0.35)}">${fmt.eur(gfs)}</div>
          <div class="sp-gfs-hint">
            Ausgeben ohne schlechtes Gewissen — Essen gehen, Ausflüge, Hobbies.
          </div>
        </div>
      </div>
      </div><!-- /sp-col-right -->

    </div>

    <!-- Jahres-Übersicht -->
    <div class="sp-summary-footer">
      <div>
        <strong class="mono">${fmt.eur(fixT * 12)} / Jahr</strong>
        Fixkosten
      </div>
      <div>
        <strong class="mono">${fmt.eur(invT * 12)} / Jahr</strong>
        Investments
      </div>
      <div>
        <strong class="mono">${fmt.eur(sparT * 12)} / Jahr</strong>
        Spar-Ziele
      </div>
      <div>
        <strong class="mono">${fmt.eur(gfs * 12)} / Jahr</strong>
        Guilt-Free
      </div>
      <div style="margin-left:auto">
        <strong class="mono">${fmt.eur(netto * 12)} / Jahr</strong>
        Nettoeinkommen
      </div>
    </div>
  `;
}

// Echtzeit-Neuberechnung der Zahlen ohne vollständiges Re-Render
function spRecalc() {
  if (!spPlan) return;

  // Beträge aus amount-Inputs in spPlan.positionen spiegeln (auch Einnahmen)
  document.querySelectorAll('.sp-position[data-pos-id]').forEach(row => {
    const posId = parseInt(row.dataset.posId);
    const amtInput = row.querySelector('.sp-pos-amount');
    if (!amtInput) return;
    const pos = spPlan.positionen.find(p => p.id === posId);
    if (pos) pos.betrag = parseFloat(amtInput.value) || 0;
  });

  const puffInput = document.getElementById('sp-puffer-input');
  if (puffInput) spPlan.sonstiges_puffer_pct = parseFloat(puffInput.value) / 100 || 0.05;

  // Netto live DIREKT aus den sichtbaren Einnahme-Feldern summieren —
  // garantiert, dass die angezeigte Summe immer mit den Zeilen übereinstimmt.
  let nettoLive = 0, hatEinnahmen = false;
  document.querySelectorAll('#sp-einnahmen-list .sp-income-pos').forEach(row => {
    hatEinnahmen = true;
    nettoLive += parseFloat(row.querySelector('.sp-pos-amount')?.value) || 0;
  });
  if (!hatEinnahmen) nettoLive = Number(spPlan.netto_monatlich) || 0;

  const setN = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setN('sp-netto-display',     fmt.eur(nettoLive));
  setN('sp-income-total',      fmt.eur(nettoLive));
  setN('sp-income-total-head', fmt.eur(nettoLive));

  const n = nettoLive || 1;
  const fixT  = spFixTotal();
  const invT  = spInvTotal();
  const sparT = spSparTotal();
  const gfs   = spGFS();
  const sonstT = spSonstiges();
  const pctFix  = fixT / n;
  const pctInv  = invT / n;
  const pctSpar = sparT / n;
  const pctGFS  = gfs / n;
  const fmtPct  = v => (v * 100).toFixed(1) + ' %';
  const pc = (el, v, mn, mx) => {
    if (!el) return;
    el.textContent = fmtPct(v);
    el.style.color = spPctColor(v, mn, mx);
  };

  pc(document.getElementById('sp-fix-pct'),  pctFix,  0.50, 0.60);
  pc(document.getElementById('sp-inv-pct'),  pctInv,  0.10, 0.10);
  pc(document.getElementById('sp-spar-pct'), pctSpar, 0.05, 0.10);
  pc(document.getElementById('sp-gfs-pct'),  pctGFS,  0.20, 0.35);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sp-fix-total',     fmt.eur(fixT));
  set('sp-inv-total',     fmt.eur(invT));
  set('sp-spar-total',    fmt.eur(sparT));
  set('sp-gfs-amount',    fmt.eur(gfs));
  set('sp-sonstiges-val', fmt.eur(sonstT));

  const gfsEl = document.getElementById('sp-gfs-amount');
  if (gfsEl) gfsEl.style.color = spPctColor(pctGFS, 0.20, 0.35);

  // Alloc-Segmente
  const segs = document.getElementById('sp-alloc-segs');
  if (segs) {
    const children = segs.children;
    if (children[0]) children[0].style.width = (pctFix * 100).toFixed(1) + '%';
    if (children[1]) children[1].style.width = (pctInv * 100).toFixed(1) + '%';
    if (children[2]) children[2].style.width = (pctSpar * 100).toFixed(1) + '%';
    if (children[3]) children[3].style.width = (pctGFS * 100).toFixed(1) + '%';
  }

  // Alloc-Bar-Labels
  const updateAlLabel = (key, pct, total, mn, mx) => {
    const pctEl = document.getElementById(`sp-al-pct-${key}`);
    const valEl = document.getElementById(`sp-al-pct-val-${key}`);
    const targetEl = document.getElementById(`sp-al-target-${key}`);
    if (pctEl) pctEl.style.color = spPctColor(pct, mn, mx);
    if (valEl) valEl.textContent = fmtPct(pct);
    if (targetEl) targetEl.textContent = IWT[key].label + ' · ' + fmt.eur(total);
    // Der Status-Dot bleibt unverändert die Kategorie-Farbe (dot-fix/-inv/-spar/-gfs,
    // gesetzt beim Erstrender) — sie soll dieselbe Legende sein wie der Balken direkt
    // darüber, nicht den Ziel-Status doppeln (den zeigt schon die Prozent-Textfarbe).
  };
  updateAlLabel('fixkosten',   pctFix,  fixT,  0.50, 0.60);
  updateAlLabel('investments', pctInv,  invT,  0.10, 0.10);
  updateAlLabel('sparziele',   pctSpar, sparT, 0.05, 0.10);
  updateAlLabel('gfs',         pctGFS,  gfs,   0.20, 0.35);
}

async function spSavePlanField(field, value) {
  if (!spPlan) return;
  try {
    const updated = await api.spending.update(spPlan.id, { [field]: value });
    spPlan[field] = updated[field];
    spRecalc();
  } catch (e) { toast(e.message); }
}

async function spSavePosName(posId, value) {
  if (!spPlan) return;
  clearTimeout(spSaveTimers['n' + posId]);
  if (!value.trim()) return;
  try {
    await api.spending.updatePosition(spPlan.id, posId, { bezeichnung: value.trim() });
    const pos = spPlan.positionen.find(p => p.id === posId);
    if (pos) pos.bezeichnung = value.trim();
  } catch (e) { toast(e.message); }
}

async function spSavePosAmount(posId, value) {
  if (!spPlan) return;
  clearTimeout(spSaveTimers['a' + posId]);
  const betrag = parseFloat(value) || 0;
  try {
    await api.spending.updatePosition(spPlan.id, posId, { betrag });
    const pos = spPlan.positionen.find(p => p.id === posId);
    if (pos) pos.betrag = betrag;
    if (pos?.kategorie === 'einnahmen') await spSyncNetto();
  } catch (e) { toast(e.message); }
}

// Debounced Persistierung beim Tippen — schützt vor Datenverlust, falls
// kein sauberes blur erfolgt (z. B. schnelles Klicken auf „Hinzufügen").
const spSaveTimers = {};
function spQueueSaveAmount(posId, value) {
  clearTimeout(spSaveTimers['a' + posId]);
  spSaveTimers['a' + posId] = setTimeout(() => spSavePosAmount(posId, value), 600);
}
function spQueueSaveName(posId, value) {
  clearTimeout(spSaveTimers['n' + posId]);
  spSaveTimers['n' + posId] = setTimeout(() => spSavePosName(posId, value), 600);
}

async function spSavePosEmpf(posId, value) {
  if (!spPlan) return;
  try {
    await api.spending.updatePosition(spPlan.id, posId, { empfaenger: value });
    const pos = spPlan.positionen.find(p => p.id === posId);
    if (pos) pos.empfaenger = value;
  } catch (e) { toast(e.message); }
}

// Hält spPlan.netto_monatlich = Summe der Einnahmen (persistiert, falls erfasst)
async function spSyncNetto() {
  if (!spPlan) return;
  const einnahmen = spGetPositionen('einnahmen');
  if (!einnahmen.length) return;
  const netto = einnahmen.reduce((s, p) => s + (Number(p.betrag) || 0), 0);
  if (Number(spPlan.netto_monatlich) === netto) return;
  spPlan.netto_monatlich = netto;
  try { await api.spending.update(spPlan.id, { netto_monatlich: netto }); } catch {}
}

const SP_LIST_ID = { einnahmen: 'sp-einnahmen-list', fixkosten: 'sp-fix-list', investments: 'sp-inv-list', sparziele: 'sp-spar-list' };

window.spAddPos = async function(kat) {
  if (!spPlan) return;
  const maxOrder = Math.max(0, ...spGetPositionen(kat).map(p => p.sort_order));
  const bezeichnung = kat === 'einnahmen' ? '' : 'Neue Position';
  try {
    const pos = await api.spending.addPosition(spPlan.id, {
      kategorie: kat, bezeichnung, betrag: 0, sort_order: maxOrder + 1,
    });
    spPlan.positionen.push(pos);

    if (kat === 'einnahmen') {
      // Zeile in-place anhängen — zerstört keine laufenden Eingaben in anderen Zeilen
      const list = document.getElementById('sp-einnahmen-list');
      if (list) {
        const empty = list.querySelector('.sp-income-empty');
        if (empty) empty.remove();
        list.insertAdjacentHTML('beforeend', einnahmeRowHtml(pos));
        const newRow = list.lastElementChild;
        newRow?.querySelector('.sp-pos-name')?.focus();
        spRecalc();
        return;
      }
    }

    await renderSpendinPlan();
    // Fokus auf neue Zeile
    const rows = document.querySelectorAll(`#${SP_LIST_ID[kat] ?? 'sp-fix-list'} .sp-pos-name`);
    if (rows.length) rows[rows.length - 1].focus();
  } catch (e) { toast(e.message); }
};

window.spDeletePos = async function(posId) {
  if (!spPlan) return;
  const wasEinnahme = spPlan.positionen.find(p => p.id === posId)?.kategorie === 'einnahmen';
  try {
    await api.spending.deletePosition(spPlan.id, posId);
    spPlan.positionen = spPlan.positionen.filter(p => p.id !== posId);
    if (wasEinnahme) {
      // Zeile in-place entfernen, Totals neu rechnen — kein Voll-Neurender
      const row = document.querySelector(`#sp-einnahmen-list .sp-income-pos[data-pos-id="${posId}"]`);
      row?.remove();
      await spSyncNetto();
      spRecalc();
      return;
    }
    await renderSpendinPlan();
  } catch (e) { toast(e.message); }
};

window.spCreateNew = async function() {
  document.getElementById('modal-title').textContent = 'Neuer Spending Plan';
  const today = new Date().toISOString().substring(0, 10);
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Plan-Name</label>
      <input id="f-spname" class="form-input" value="Conscious Spending Plan ${new Date().getFullYear()}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Brutto / Monat (€) <span class="required">*</span></label>
        <input id="f-brutto" class="form-input" type="number" step="50">
      </div>
      <div class="form-group">
        <label class="form-label">Netto / Monat (€) <span class="required">*</span></label>
        <input id="f-netto" class="form-input" type="number" step="50">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Stand (Datum)</label>
        <input id="f-stand" class="form-input" type="date" value="${today}">
      </div>
      <div class="form-group">
        <label class="form-label">Sonstiges-Puffer (%)</label>
        <input id="f-puffer" class="form-input" type="number" step="1" value="5" min="0" max="30">
        <p class="form-hint">Automatischer Buffer auf Fixkosten</p>
      </div>
    </div>
  `;
  document.getElementById('modal-submit').onclick = async () => {
    const data = {
      name: document.getElementById('f-spname').value.trim() || 'Spending Plan',
      brutto_monatlich: parseFloat(document.getElementById('f-brutto').value) || 0,
      netto_monatlich:  parseFloat(document.getElementById('f-netto').value) || 0,
      stand: document.getElementById('f-stand').value || today,
      sonstiges_puffer_pct: (parseFloat(document.getElementById('f-puffer').value) || 5) / 100,
    };
    if (!data.netto_monatlich) return toast('Bitte Netto-Einkommen eingeben.');
    try {
      spPlan = await api.spending.create(data);
      closeModal();
      await renderSpendinPlan();
      toast('Spending Plan erstellt.');
    } catch (e) { toast(e.message); }
  };
  openModal();
};

async function renderSpending() {
  if (state.demoMode) {
    spPlan = DEMO.spending;
    await renderSpendinPlan();
    return;
  }
  try {
    spPlan = await api.spending.aktiv();
  } catch {
    spPlan = null;
  }
  await renderSpendinPlan();
}

// ── Versicherungen & Verträge ─────────────────────────────────────────────────

const VS_ART_LABEL = {
  haftpflicht: 'Haftpflicht', kfz: 'KFZ', kranken: 'Kranken', leben: 'Leben',
  haus: 'Haus', unfall: 'Unfall', rechtsschutz: 'Rechtsschutz', sonstiges: 'Sonstiges',
};
const VT_ART_LABEL = {
  strom: 'Strom', gas: 'Wärme/Wasser', internet: 'Internet', handy: 'Handy',
  streaming: 'Streaming', gym: 'Fitness', sonstiges: 'Sonstiges',
};
const ZAHLWEISE_FAKTOR = { monatlich: 12, quartalsweise: 4, 'halbjährlich': 2, jährlich: 1 };

function vsJahresbeitrag(item, feld = 'beitrag') {
  return (item[feld] || 0) * (ZAHLWEISE_FAKTOR[item.zahlweise] ?? 12);
}

function vsDaysTillKuendigung(item) {
  if (!item.laufzeit_bis || !item.kuendigungsfrist_tage) return null;
  const laufzeit = new Date(item.laufzeit_bis);
  const deadline = new Date(laufzeit);
  deadline.setDate(deadline.getDate() - item.kuendigungsfrist_tage);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((deadline - today) / 86400000);
}

function vsLaufzeitCell(item) {
  if (!item.laufzeit_bis) return '<span class="vs-laufzeit-cell unbefristet">unbefristet</span>';
  const d = new Date(item.laufzeit_bis);
  const daysToDeadline = vsDaysTillKuendigung(item);
  const fmt_date = d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  if (daysToDeadline !== null && daysToDeadline <= 30) {
    return `<span class="vs-laufzeit-cell urgent">${fmt_date}</span>`;
  }
  if (daysToDeadline !== null && daysToDeadline <= 90) {
    return `<span class="vs-laufzeit-cell soon">${fmt_date}</span>`;
  }
  return `<span class="vs-laufzeit-cell">${fmt_date}</span>`;
}

function vsFristCell(item) {
  if (!item.kuendigungsfrist_tage) return '<span style="color:var(--wash-grey)">—</span>';
  const days = vsDaysTillKuendigung(item);
  const txt = `${item.kuendigungsfrist_tage} Tage`;
  if (days !== null && days <= 30) return `<span class="vs-frist-cell urgent">${txt} ⚠ noch ${days}d</span>`;
  if (days !== null && days <= 90) return `<span class="vs-frist-cell soon">${txt} · noch ${days}d</span>`;
  return `<span class="vs-frist-cell">${txt}</span>`;
}

function renderFristenBanner(items, bannerId) {
  const urgent = [];
  for (const item of items) {
    const days = vsDaysTillKuendigung(item);
    if (days !== null && days <= 90) urgent.push({ ...item, _days: days });
  }
  urgent.sort((a, b) => a._days - b._days);
  const banner = document.getElementById(bannerId);
  if (!banner) return;
  if (!urgent.length) { banner.innerHTML = ''; return; }
  banner.innerHTML = `<div class="vs-fristen-banner">${urgent.map(item => {
    const cls = item._days <= 30 ? 'urgent' : 'warn';
    const name = item.bezeichnung || item.art;
    const deadline = new Date(new Date(item.laufzeit_bis).setDate(
      new Date(item.laufzeit_bis).getDate() - item.kuendigungsfrist_tage
    )).toLocaleDateString('de-DE');
    return `<div class="vs-frist-item ${cls}">
      <div class="vs-frist-stamp">${item._days}d</div>
      <div class="vs-frist-text">
        <strong>${escapeHtml(name)}</strong> (${escapeHtml(item.anbieter ?? '')}) —
        Kündigung bis <strong>${deadline}</strong> möglich
        ${item._days <= 0 ? ' — <em>Frist abgelaufen!</em>' : ''}
      </div>
      <span class="vs-frist-days">${item._days <= 0 ? 'abgelaufen' : `${item._days} Tage`}</span>
    </div>`;
  }).join('')}</div>`;
}

function renderVersicherungen() {
  const vs = state.versicherungen ?? [];
  renderFristenBanner(vs, 'vs-fristen-banner');
  const sumVs = vs.reduce((s, v) => s + vsJahresbeitrag(v, 'beitrag'), 0);
  const elSum = document.getElementById('vs-sum-versicherungen');
  if (elSum) elSum.textContent = fmt.eur(sumVs);

  const vstb = document.getElementById('versicherungen-tbody');
  if (!vstb) return;
  if (!vs.length) {
    vstb.innerHTML = `<tr><td colspan="7" class="empty-row">Noch keine Versicherungen erfasst</td></tr>`;
    return;
  }
  vstb.innerHTML = vs.map(v => {
    const artKey = v.art?.toLowerCase().replace(/\s+/g,'') || 'sonstiges';
    const artLabel = VS_ART_LABEL[artKey] ?? v.art;
    const jahres = vsJahresbeitrag(v, 'beitrag');
    return `<tr>
      <td><span class="vs-art-badge vs-badge-${artKey}">${escapeHtml(artLabel)}</span></td>
      <td>
        <strong>${escapeHtml(v.bezeichnung)}</strong>
        <br><span style="font-size:var(--text-xs);color:var(--wash-grey)">${escapeHtml(v.anbieter)}</span>
      </td>
      <td class="mono" style="font-size:var(--text-xs)">${v.vertragsnummer ? escapeHtml(v.vertragsnummer) : '—'}</td>
      <td class="mono">
        ${fmt.eur(jahres)}
        <br><span style="font-size:var(--text-xs);color:var(--wash-grey)">${fmt.eur(v.beitrag)} / ${v.zahlweise}</span>
      </td>
      <td>${vsLaufzeitCell(v)}</td>
      <td>${vsFristCell(v)}</td>
      <td class="right">
        <div class="action-cell">
          <button class="btn-icon" onclick="openVersicherungForm(${v.id})" title="Bearbeiten">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteVersicherung(${v.id})" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderVertraege() {
  const vt = state.vertraege ?? [];
  renderFristenBanner(vt, 'vt-fristen-banner');
  const sumVt = vt.reduce((s, v) => s + vsJahresbeitrag(v, 'kosten'), 0);
  const elSum = document.getElementById('vt-sum-vertraege');
  if (elSum) elSum.textContent = fmt.eur(sumVt);

  const vttb = document.getElementById('vertraege-tbody');
  if (!vttb) return;
  if (!vt.length) {
    vttb.innerHTML = `<tr><td colspan="7" class="empty-row">Noch keine Verträge erfasst</td></tr>`;
    return;
  }
  vttb.innerHTML = vt.map(v => {
    const artKey = v.art?.toLowerCase().replace(/\s+/g,'') || 'sonstiges';
    const artLabel = VT_ART_LABEL[artKey] ?? v.art;
    const jahres = vsJahresbeitrag(v, 'kosten');
    return `<tr>
      <td><span class="vs-art-badge vs-badge-${artKey}">${escapeHtml(artLabel)}</span></td>
      <td>
        <strong>${escapeHtml(v.bezeichnung)}</strong>
        <br><span style="font-size:var(--text-xs);color:var(--wash-grey)">${escapeHtml(v.anbieter)}</span>
      </td>
      <td class="mono" style="font-size:var(--text-xs)">${v.vertragsnummer ? escapeHtml(v.vertragsnummer) : '—'}</td>
      <td class="mono">
        ${fmt.eur(jahres)}
        <br><span style="font-size:var(--text-xs);color:var(--wash-grey)">${fmt.eur(v.kosten)} / ${v.zahlweise}</span>
      </td>
      <td>${vsLaufzeitCell(v)}</td>
      <td>${vsFristCell(v)}</td>
      <td class="right">
        <div class="action-cell">
          <button class="btn-icon" onclick="openVertragForm(${v.id})" title="Bearbeiten">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteVertrag(${v.id})" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Steuern (Steuerbescheide) ─────────────────────────────────────────────────

// Gesamtbelastung = was tatsächlich an Fiskus und Gemeinde fließt. Die
// festgesetzte ESt ist bereits um die § 35-Anrechnung gemindert, deshalb darf
// die Gewerbesteuer hier voll dazu — das ist kein Doppelansatz.
function sbGesamtbelastung(b) {
  return (b.einkommensteuer ?? 0) + (b.soli ?? 0) + (b.kirchensteuer ?? 0) + (b.gewerbesteuer ?? 0);
}

// Belastungsquote auf den Gesamtbetrag der Einkünfte — also auf das, was
// tatsächlich verdient wurde. Das zvE taugt als Nenner nicht: es ist um
// Kinderfreibeträge gemindert und treibt die Quote dadurch künstlich hoch
// (im Bescheid 2023: 32,4 % statt 23,8 %). Fehlt der Gesamtbetrag der
// Einkünfte, fällt die Anzeige auf das zvE zurück und weist das aus.
function sbBezugsgroesse(b) {
  const gde = b.gesamtbetrag_einkuenfte ?? 0;
  if (gde > 0) return { wert: gde, basis: 'GdE' };
  return { wert: b.zu_versteuerndes_einkommen ?? 0, basis: 'zvE' };
}

function sbEffektiverSatz(b) {
  const { wert } = sbBezugsgroesse(b);
  return wert > 0 ? (sbGesamtbelastung(b) / wert) * 100 : 0;
}

// Durchschnittssteuersatz der reinen Einkommensteuer auf das zvE — die
// klassische Kennzahl aus dem Bescheid, ergänzend zur Gesamtquote oben.
function sbDurchschnittssatzEst(b) {
  const zve = b.zu_versteuerndes_einkommen ?? 0;
  return zve > 0 ? ((b.einkommensteuer ?? 0) / zve) * 100 : 0;
}

// Was unterm Strich zu zahlen war, inkl. Nachzahlungszinsen (§ 233a AO).
function sbZahlbetrag(b) {
  return (b.nachzahlung_erstattung ?? 0) + (b.nachzahlungszinsen ?? 0);
}

function renderSteuerbelastungChart() {
  const bescheide = [...(state.steuerbescheide ?? [])].sort((a, b) => a.jahr - b.jahr);

  if (!chartEmptyState('chart-steuerbelastung', bescheide.length === 0, 'Noch keine Steuerbescheide erfasst.')) {
    if (state.charts.steuerbelastung) { state.charts.steuerbelastung.destroy(); state.charts.steuerbelastung = null; }
    return;
  }
  const ctx = document.getElementById('chart-steuerbelastung').getContext('2d');
  const theme = chartTheme();

  const gesamt = bescheide.map(sbGesamtbelastung);
  const effSatz = bescheide.map(sbEffektiverSatz);

  if (state.charts.steuerbelastung) state.charts.steuerbelastung.destroy();

  state.charts.steuerbelastung = new Chart(ctx, {
    data: {
      labels: bescheide.map(b => String(b.jahr)),
      datasets: [
        {
          type: 'bar',
          label: 'Gesamtbelastung',
          data: gesamt,
          backgroundColor: theme.accent,
          borderRadius: 4,
          yAxisID: 'y',
        },
        {
          type: 'line',
          label: 'Belastungsquote',
          data: effSatz,
          borderColor: theme.grey,
          backgroundColor: theme.grey,
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 4,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          display: true,
          labels: { font: { family: "'JetBrains Mono', monospace", size: 10 }, color: theme.grey },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => ctx.dataset.yAxisID === 'y1' ? ` ${ctx.raw.toFixed(1)} %` : ` ${fmt.eur(ctx.raw)}`,
          },
          bodyFont: { family: "'JetBrains Mono', monospace" },
        },
      },
      scales: {
        y: {
          position: 'left',
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: theme.grey,
            callback: (v) => (v === 0 ? '€0' : '€' + (v / 1000).toFixed(0) + 'k'),
          },
          grid: { color: theme.grid },
        },
        y1: {
          position: 'right',
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: theme.grey,
            callback: (v) => v.toFixed(0) + ' %',
          },
          grid: { drawOnChartArea: false },
        },
        x: {
          ticks: { font: { family: "'JetBrains Mono', monospace", size: 10 }, color: theme.grey },
          grid: { display: false },
        },
      },
    },
  });
}

// Der Vergleich läuft über die Jahre, also stehen die Jahre als SPALTEN und die
// Kennzahlen als Zeilen — so liest man "was hat sich verändert" in einer Zeile
// ab, und die Tabelle wächst mit jedem Jahr in die Breite statt in unlesbar
// viele Spalten pro Zeile. Die Zeilenfolge ist die Rechenkette des Bescheids.
// erklaerung: nur bei Posten gesetzt, deren Bedeutung sich nicht von selbst
// erschließt — erscheint als Tooltip am Label. Selbsterklärende Zeilen (z. B.
// "Kirchensteuer", "Gesamtbelastung") bekommen bewusst keine, sonst verliert
// sich der Hinweis unter zu vielen unterstrichenen Wörtern.
// Der Gewerbesteuermessbetrag ist bewusst NICHT mehr in dieser Übersicht —
// er ist nur eine Zwischen-Rechengröße für die Gewerbesteuer der Gemeinde
// (Messbetrag × Hebesatz), keine Zahl, die für sich genommen etwas übers
// eigene Geld aussagt. Wer ihn braucht, findet ihn in der Gewerbesteuer-
// Zerlegung je Gemeinde weiter unten.
const SB_ZEILEN = [
  { gruppenkopf: 'Einkünfte' },
  { label: 'Gewinn Gewerbebetrieb (Ehemann)', feld: 'einkuenfte_gewerbebetrieb' },
  { label: 'Gewinn Gewerbebetrieb (Ehefrau)', feld: 'einkuenfte_gewerbebetrieb_ehefrau' },
  { label: 'Nichtselbstständige Arbeit (Ehefrau, netto)', feld: 'einkuenfte_nichtselbststaendig_ehefrau',
    erklaerung: 'Bruttolohn abzüglich Werbungskosten (mindestens der Arbeitnehmer-Pauschbetrag von 1.230 €).' },
  { label: 'Vermietung und Verpachtung (netto)', feld: 'einkuenfte_vermietung',
    erklaerung: 'Mieteinnahmen abzüglich Werbungskosten und Abschreibung (AfA) — nicht die Kaltmiete selbst.' },
  { label: 'Sonstige Einkünfte', feld: 'einkuenfte_sonstige' },
  { label: 'Gesamtbetrag der Einkünfte', feld: 'gesamtbetrag_einkuenfte', stark: true, hervor: true },
  { label: '− Kinderfreibeträge', feld: 'kinderfreibetraege', vorzeichen: '−',
    erklaerung: 'Wird nur für die Steuerberechnung abgezogen. Das Finanzamt prüft automatisch, ob der Freibetrag oder das bereits erhaltene Kindergeld günstiger ist — war der Freibetrag günstiger, wird das Kindergeld weiter unten wieder hinzugerechnet (§ 31 EStG).' },
  { label: 'zu versteuerndes Einkommen', feld: 'zu_versteuerndes_einkommen', stark: true, hervor: true,
    erklaerung: 'Dazwischen liegen noch abgezogene Sonderausgaben (Vorsorgeaufwendungen, Kirchensteuer, Kinderbetreuung u. ä.) — die stehen hier nicht als eigene Zeile, nur ihr Ergebnis fließt in diese Zahl ein.' },

  { gruppenkopf: 'Steuerlast' },
  { label: 'Tarifliche Einkommensteuer', feld: 'est_tariflich' },
  { label: '− Anrechnung Gewerbesteuer (§ 35)', feld: 'anrechnung_35', vorzeichen: '−', farbe: '#4ADE80',
    erklaerung: 'Rechnet die bereits gezahlte Gewerbesteuer pauschal auf die Einkommensteuer an — verhindert, dass derselbe Gewinn doppelt belastet wird (Gewerbe- und Einkommensteuer).' },
  { label: '+ Kindergeld-Hinzurechnung (§ 31)', feld: 'kindergeld_hinzurechnung', farbe: '#F0A030',
    erklaerung: 'War oben der Kinderfreibetrag günstiger als das Kindergeld, wird das bereits monatlich ausgezahlte Kindergeld hier wieder hinzugerechnet — sonst hätte man beides zugleich.' },
  { label: 'Festgesetzte Einkommensteuer', feld: 'einkommensteuer', stark: true, hervor: true },
  { label: 'Solidaritätszuschlag', feld: 'soli',
    erklaerung: '5,5 % auf die Einkommensteuer — entfällt seit der 2021 stark angehobenen Freigrenze für die meisten Haushalte komplett.' },
  { label: 'Kirchensteuer', feld: 'kirchensteuer' },
  { label: 'Gewerbesteuer', feld: 'gewerbesteuer' },
  { label: 'Gesamtbelastung', fn: sbGesamtbelastung, stark: true, hervor: true },

  { gruppenkopf: 'Kennzahlen' },
  { label: 'Belastungsquote', fn: sbEffektiverSatz, prozent: true, quelle: true },
  { label: 'Ø-Steuersatz ESt (auf zvE)', fn: sbDurchschnittssatzEst, prozent: true },

  { gruppenkopf: 'Abrechnung' },
  { label: '− Steuerabzugsbeträge', feld: 'steuerabzugsbetraege', vorzeichen: '−',
    erklaerung: 'Steuern, die während des Jahres schon einbehalten wurden und jetzt gegengerechnet werden — z. B. abgeführte Kapitalertragsteuer auf Zinsen oder Dividenden.' },
  { label: '− Vorauszahlungen', feld: 'vorauszahlungen_gesamt', vorzeichen: '−' },
  { label: '+ Nachzahlungszinsen (§ 233a)', feld: 'nachzahlungszinsen', farbe: '#F0A030',
    erklaerung: 'Zinsen, die das Finanzamt für die Zeit zwischen Ende des Steuerjahres und dem Bescheid auf eine Nachzahlung erhebt (§ 233a AO) — unabhängig vom eigenen Verschulden.' },
  { label: 'Nachzahlung / Erstattung', fn: sbZahlbetrag, stark: true, hervor: true, nachErstattung: true },
];

function sbZelle(b, zeile) {
  if (zeile.fn) {
    const wert = zeile.fn(b);
    if (zeile.prozent) return fmt.pct(wert);
    // Nachzahlung/Erstattung: das Wort sagt schon, was gemeint ist — kein
    // Vorzeichen mehr nötig. Nur die Zahl selbst trägt die Farbe, das Wort
    // bleibt in normaler Textfarbe (analog zu den "Erwartete
    // Nachzahlung/Erstattung"-Stat-Cards in der Prognose).
    if (zeile.nachErstattung) {
      const istNachzahlung = wert > 0;
      const farbe = istNachzahlung ? '#F87171' : '#4ADE80';
      return `${istNachzahlung ? 'Nachzahlung' : 'Erstattung'} <span style="color:${farbe}">${fmt.eur(Math.abs(wert))}</span>`;
    }
    return fmt.eur(wert);
  }
  const roh = b[zeile.feld];
  if (roh == null) return '—';
  return `${zeile.vorzeichen ?? ''}${zeile.vorzeichen ? ' ' : ''}${fmt.eur(roh)}`;
}

function renderSteuern() {
  renderSteuerbelastungChart();

  const container = document.getElementById('steuerbescheide-vergleich');
  if (!container) return;

  const bescheide = [...(state.steuerbescheide ?? [])].sort((a, b) => b.jahr - a.jahr);
  if (!bescheide.length) {
    container.innerHTML = `<p class="form-hint" style="padding:1.5rem">Noch keine Steuerbescheide erfasst.</p>`;
    return;
  }

  const kopf = bescheide.map(b => `
    <th class="right">
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:0.4rem">
        <span class="mono">${b.jahr}</span>
        ${b.vorlaeufig ? `<span class="vs-art-badge" title="§ 165 AO — Festsetzung teilweise vorläufig, kann sich noch ändern">vorläufig</span>` : ''}
        <button class="btn-icon" onclick="openSteuerbescheidForm(${b.jahr})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteSteuerbescheid(${b.jahr})" title="Löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div style="font-size:var(--text-xs);color:var(--wash-grey);font-weight:400;margin-top:0.15rem">
        ${b.bescheiddatum ? fmt.date(b.bescheiddatum) : '—'}
      </div>
    </th>`).join('');

  const zeilen = SB_ZEILEN.map(z => {
    if (z.gruppenkopf) {
      return `<tr class="sb-gruppe-row"><td colspan="${bescheide.length + 1}" class="sb-gruppe-kopf">${z.gruppenkopf}</td></tr>`;
    }
    const zellen = bescheide.map(b => {
      const inhalt = sbZelle(b, z);
      const farbe = z.farbe ?? '';
      const stil = [farbe ? `color:${farbe}` : '', z.hervor ? 'font-size:var(--text-sm)' : ''].filter(Boolean).join(';');
      return `<td class="right mono" style="${stil}">${z.stark ? `<strong>${inhalt}</strong>` : inhalt}</td>`;
    }).join('');
    const zusatz = z.quelle
      ? ` <span style="font-size:var(--text-xs);color:var(--wash-grey)">(auf ${sbBezugsgroesse(bescheide[0]).basis})</span>`
      : '';
    const labelHtml = z.erklaerung
      ? `<span class="sb-hilfe" title="${escapeHtml(z.erklaerung)}">${z.label}</span>`
      : z.label;
    return `<tr${z.hervor ? ' style="background:rgba(255,255,255,0.03)"' : ''}>
      <td${z.stark ? ' style="font-weight:600"' : ''}>${labelHtml}${zusatz}</td>${zellen}
    </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Kennzahl</th>${kopf}</tr></thead>
      <tbody>${zeilen}</tbody>
    </table>
    ${renderSbZerlegung(bescheide)}`;
}

// Gewerbesteuer nach Gemeinden — der eigentliche Treiber hinter der GewSt-Zeile.
function renderSbZerlegung(bescheide) {
  const mitGemeinden = bescheide.filter(b => (b.gemeinden ?? []).length);
  if (!mitGemeinden.length) return '';

  const bloecke = mitGemeinden.map(b => {
    const zeilen = b.gemeinden.map(g => `
      <tr>
        <td>${escapeHtml(g.gemeinde)}</td>
        <td class="right mono">${fmt.eur(g.arbeitsloehne)}</td>
        <td class="right mono">${fmt.eur(g.zerlegungsanteil)}</td>
        <td class="right mono">${Number(g.hebesatz ?? 0).toFixed(0)} %</td>
        <td class="right mono">${fmt.eur(g.gewerbesteuer)}</td>
      </tr>`).join('');
    const summeLohn = b.gemeinden.reduce((s, g) => s + (g.arbeitsloehne ?? 0), 0);
    const summeAnteil = b.gemeinden.reduce((s, g) => s + (g.zerlegungsanteil ?? 0), 0);
    const summeGewSt = b.gemeinden.reduce((s, g) => s + (g.gewerbesteuer ?? 0), 0);
    return `
      <div style="margin-top:1.25rem">
        <div class="form-section-head">Gewerbesteuer-Zerlegung ${b.jahr}</div>
        <table class="data-table">
          <thead><tr>
            <th>Gemeinde</th><th class="right">Arbeitslöhne</th><th class="right">Zerlegungsanteil</th>
            <th class="right">Hebesatz</th><th class="right">Gewerbesteuer</th>
          </tr></thead>
          <tbody>
            ${zeilen}
            <tr style="border-top:1px solid var(--ink-wash)">
              <td style="font-weight:600">Summe</td>
              <td class="right mono"><strong>${fmt.eur(summeLohn)}</strong></td>
              <td class="right mono"><strong>${fmt.eur(summeAnteil)}</strong></td>
              <td></td>
              <td class="right mono"><strong>${fmt.eur(summeGewSt)}</strong></td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }).join('');

  return `<div style="padding:0 1.5rem 1.5rem">${bloecke}</div>`;
}

// Zerlegungszeilen des gerade offenen Formulars. Wie bei den Betriebsstätten
// der Prognose lokal gehalten und erst beim Speichern mitgeschickt.
let sbGemeinden = [];

window.sbAddGemeinde = function() {
  sbGemeinden.push({ gemeinde: '', arbeitsloehne: 0, zerlegungsanteil: 0, hebesatz: 400, gewerbesteuer: 0 });
  sbRenderGemeinden();
};

window.sbRemoveGemeinde = function(i) {
  sbGemeinden.splice(i, 1);
  sbRenderGemeinden();
};

window.sbSetGemeindeField = function(i, key, value, isNumber = true) {
  sbGemeinden[i][key] = isNumber ? (parseFloat(value) || 0) : value;
};

function sbRenderGemeinden() {
  const el = document.getElementById('sb-gemeinden-container');
  if (!el) return;
  if (!sbGemeinden.length) {
    el.innerHTML = `<p class="form-hint">Noch keine Gemeinde erfasst.</p>`;
    return;
  }
  el.innerHTML = sbGemeinden.map((g, i) => `
    <div class="form-row" style="align-items:flex-end;gap:0.5rem;margin-bottom:0.5rem">
      <div class="form-group" style="flex:1;margin-bottom:0">
        <label class="form-label">Gemeinde</label>
        <input class="form-input" value="${escapeHtml(g.gemeinde ?? '')}" onblur="sbSetGemeindeField(${i},'gemeinde',this.value,false)">
      </div>
      <div class="form-group" style="width:7.5rem;margin-bottom:0">
        <label class="form-label">Arbeitslöhne €</label>
        <input class="form-input mono" type="number" step="500" value="${g.arbeitsloehne ?? 0}" onblur="sbSetGemeindeField(${i},'arbeitsloehne',this.value)">
      </div>
      <div class="form-group" style="width:7.5rem;margin-bottom:0">
        <label class="form-label">Zerlegungsanteil</label>
        <input class="form-input mono" type="number" step="0.01" value="${g.zerlegungsanteil ?? 0}" onblur="sbSetGemeindeField(${i},'zerlegungsanteil',this.value)">
      </div>
      <div class="form-group" style="width:5.5rem;margin-bottom:0">
        <label class="form-label">Hebesatz %</label>
        <input class="form-input mono" type="number" step="1" value="${g.hebesatz ?? 0}" onblur="sbSetGemeindeField(${i},'hebesatz',this.value)">
      </div>
      <div class="form-group" style="width:7rem;margin-bottom:0">
        <label class="form-label">GewSt €</label>
        <input class="form-input mono" type="number" step="1" value="${g.gewerbesteuer ?? 0}" onblur="sbSetGemeindeField(${i},'gewerbesteuer',this.value)">
      </div>
      <button class="btn btn-ghost btn-sm" onclick="sbRemoveGemeinde(${i})" title="Gemeinde entfernen" style="margin-bottom:0.1rem">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
}

window.openSteuerbescheidForm = async function(jahr = null) {
  let b = null;
  if (jahr) {
    try { b = await api.steuerbescheide.get(jahr); } catch { toast('Steuerbescheid nicht gefunden.'); return; }
  }
  sbGemeinden = (b?.gemeinden ?? []).map(g => ({ ...g }));

  document.getElementById('modal-title').textContent = b ? `Steuerbescheid ${b.jahr} bearbeiten` : 'Steuerbescheid hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <p class="form-hint" style="margin-top:0">Die Reihenfolge folgt dem Bescheid — von oben nach unten abtippbar. Nicht zutreffende Felder bleiben leer.</p>

    <div class="form-section-head">Eckdaten</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Steuerjahr <span class="required">*</span></label>
        <input id="f-sb-jahr" class="form-input mono" type="number" step="1" value="${b?.jahr ?? new Date().getFullYear() - 1}" ${b ? 'disabled' : ''}>
      </div>
      <div class="form-group">
        <label class="form-label">Bescheiddatum</label>
        <input id="f-sb-datum" class="form-input" type="date" value="${fmt.dateISO(b?.bescheiddatum)}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Veranlagung</label>
        <select id="f-sb-veranlagung" class="form-select">
          <option value="zusammen" ${(b?.veranlagung ?? 'zusammen') === 'zusammen' ? 'selected' : ''}>Zusammenveranlagung (Splitting)</option>
          <option value="einzeln" ${b?.veranlagung === 'einzeln' ? 'selected' : ''}>Einzelveranlagung (Grundtarif)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;font-size:var(--text-sm)">
          <input id="f-sb-vorlaeufig" type="checkbox" ${b?.vorlaeufig ? 'checked' : ''}>
          <span>Vorläufig (§ 165 AO)</span>
        </label>
      </div>
    </div>

    <div class="form-section-head">Einkünfte</div>
    <p class="form-hint" style="margin-top:0">Die einzelnen Quellen — für den Jahresvergleich, damit sich eine Veränderung des Gesamtbetrags auf ihre Ursache zurückführen lässt.</p>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Gewinn Gewerbebetrieb, Ehemann (€)</label>
        <input id="f-sb-ek-gewerbe" class="form-input" type="number" step="1" value="${b?.einkuenfte_gewerbebetrieb ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Gewinn Gewerbebetrieb, Ehefrau (€)</label>
        <input id="f-sb-ek-gewerbe-ehefrau" class="form-input" type="number" step="1" value="${b?.einkuenfte_gewerbebetrieb_ehefrau ?? ''}">
        <p class="form-hint">Eigenes Einzelunternehmen, falls vorhanden.</p>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nichtselbstständige Arbeit, Ehefrau (€)</label>
        <input id="f-sb-ek-lohn" class="form-input" type="number" step="1" value="${b?.einkuenfte_nichtselbststaendig_ehefrau ?? ''}">
        <p class="form-hint">Netto, nach Werbungskosten.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Vermietung und Verpachtung (€)</label>
        <input id="f-sb-ek-vermietung" class="form-input" type="number" step="1" value="${b?.einkuenfte_vermietung ?? ''}">
        <p class="form-hint">Netto, nach Werbungskosten und AfA.</p>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Sonstige Einkünfte (€)</label>
      <input id="f-sb-ek-sonstige" class="form-input" type="number" step="1" value="${b?.einkuenfte_sonstige ?? ''}">
    </div>

    <div class="form-section-head">Einkommensteuer</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Gesamtbetrag der Einkünfte (€)</label>
        <input id="f-sb-gde" class="form-input" type="number" step="1" value="${b?.gesamtbetrag_einkuenfte ?? ''}">
        <p class="form-hint">Bezugsgröße der Belastungsquote — das tatsächlich Verdiente. Steht im Bescheid als eigene Summenzeile, deshalb hier weiterhin frei eintragbar statt aus den Quellen oben berechnet.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Freibeträge für Kinder (€)</label>
        <input id="f-sb-kfb" class="form-input" type="number" step="1" value="${b?.kinderfreibetraege ?? ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Zu versteuerndes Einkommen (€)</label>
        <input id="f-sb-zve" class="form-input" type="number" step="1" value="${b?.zu_versteuerndes_einkommen ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Tarifliche Einkommensteuer (€)</label>
        <input id="f-sb-esttarif" class="form-input" type="number" step="1" value="${b?.est_tariflich ?? ''}">
        <p class="form-hint">Vor Anrechnungen — im Bescheid „zu versteuern nach dem …tarif".</p>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">− Anrechnung Gewerbesteuer § 35 (€)</label>
        <input id="f-sb-anr35" class="form-input" type="number" step="1" value="${b?.anrechnung_35 ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">+ Kindergeld-Hinzurechnung § 31 (€)</label>
        <input id="f-sb-kghinz" class="form-input" type="number" step="1" value="${b?.kindergeld_hinzurechnung ?? ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Festgesetzte Einkommensteuer (€)</label>
        <input id="f-sb-est" class="form-input" type="number" step="1" value="${b?.einkommensteuer ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Solidaritätszuschlag (€)</label>
        <input id="f-sb-soli" class="form-input" type="number" step="1" value="${b?.soli ?? ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Kirchensteuer (€)</label>
      <input id="f-sb-kist" class="form-input" type="number" step="1" value="${b?.kirchensteuer ?? ''}">
    </div>

    <div class="form-section-head">Gewerbesteuer</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Gewerbesteuermessbetrag (€)</label>
        <input id="f-sb-gewstmb" class="form-input" type="number" step="1" value="${b?.gewerbesteuermessbetrag ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Gewerbesteuer gesamt (€)</label>
        <input id="f-sb-gewst" class="form-input" type="number" step="1" value="${b?.gewerbesteuer ?? ''}">
      </div>
    </div>
    <p class="form-hint">Zerlegung laut Zerlegungsbescheid — je Gemeinde eine Zeile. Ohne sie lässt sich später nicht unterscheiden, ob ein Anstieg vom Gewinn oder vom Hebesatz kommt.</p>
    <div id="sb-gemeinden-container"></div>
    <button class="sp-add-btn" onclick="sbAddGemeinde()" style="margin-bottom:0.5rem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg>
      Gemeinde hinzufügen
    </button>

    <div class="form-section-head">Abrechnung</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">− Steuerabzugsbeträge (€)</label>
        <input id="f-sb-abzug" class="form-input" type="number" step="1" value="${b?.steuerabzugsbetraege ?? ''}">
        <p class="form-hint">z. B. angerechnete Kapitalertragsteuer.</p>
      </div>
      <div class="form-group">
        <label class="form-label">− Vorauszahlungen / bereits getilgt (€)</label>
        <input id="f-sb-vz" class="form-input" type="number" step="1" value="${b?.vorauszahlungen_gesamt ?? ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nachzahlung (+) / Erstattung (−) (€)</label>
        <input id="f-sb-nz" class="form-input" type="number" step="1" value="${b?.nachzahlung_erstattung ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">+ Nachzahlungszinsen § 233a (€)</label>
        <input id="f-sb-zinsen" class="form-input" type="number" step="1" value="${b?.nachzahlungszinsen ?? ''}">
      </div>
    </div>

    <div class="form-section-head">Ausblick</div>
    <div class="form-group">
      <label class="form-label">Neu festgesetzte Vorauszahlung je Quartal (€)</label>
      <input id="f-sb-vzfolge" class="form-input" type="number" step="1" value="${b?.vz_folgejahr_quartal ?? ''}">
      <p class="form-hint">Der Betrag, den der Bescheid für die Folgejahre festsetzt — Grundlage für die Rücklage.</p>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <input id="f-sb-notiz" class="form-input" value="${escapeHtml(b?.notiz ?? '')}">
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('steuerbescheid', b?.id)}
  `;
  sbRenderGemeinden();
  document.getElementById('modal-submit').onclick = async () => {
    const jahrVal = parseInt(document.getElementById('f-sb-jahr').value);
    const zahl = (id) => parseFloat(document.getElementById(id).value) || 0;
    const optZahl = (id) => {
      const v = document.getElementById(id).value;
      return v !== '' ? parseFloat(v) : null;
    };
    const data = {
      jahr: jahrVal,
      bescheiddatum: document.getElementById('f-sb-datum').value || null,
      veranlagung: document.getElementById('f-sb-veranlagung').value,
      vorlaeufig: document.getElementById('f-sb-vorlaeufig').checked,
      einkuenfte_gewerbebetrieb: zahl('f-sb-ek-gewerbe'),
      einkuenfte_gewerbebetrieb_ehefrau: zahl('f-sb-ek-gewerbe-ehefrau'),
      einkuenfte_nichtselbststaendig_ehefrau: zahl('f-sb-ek-lohn'),
      einkuenfte_vermietung: zahl('f-sb-ek-vermietung'),
      einkuenfte_sonstige: zahl('f-sb-ek-sonstige'),
      gesamtbetrag_einkuenfte: zahl('f-sb-gde'),
      zu_versteuerndes_einkommen: zahl('f-sb-zve'),
      kinderfreibetraege: zahl('f-sb-kfb'),
      est_tariflich: zahl('f-sb-esttarif'),
      anrechnung_35: zahl('f-sb-anr35'),
      kindergeld_hinzurechnung: zahl('f-sb-kghinz'),
      einkommensteuer: zahl('f-sb-est'),
      soli: zahl('f-sb-soli'),
      kirchensteuer: zahl('f-sb-kist'),
      gewerbesteuermessbetrag: optZahl('f-sb-gewstmb'),
      gewerbesteuer: optZahl('f-sb-gewst'),
      steuerabzugsbetraege: zahl('f-sb-abzug'),
      vorauszahlungen_gesamt: zahl('f-sb-vz'),
      nachzahlungszinsen: zahl('f-sb-zinsen'),
      nachzahlung_erstattung: zahl('f-sb-nz'),
      vz_folgejahr_quartal: zahl('f-sb-vzfolge'),
      notiz: document.getElementById('f-sb-notiz').value.trim() || null,
      gemeinden: sbGemeinden.filter(g => (g.gemeinde ?? '').trim()),
    };
    if (!jahrVal) return toast('Steuerjahr erforderlich.');
    try {
      if (b) {
        const upd = await api.steuerbescheide.update(b.jahr, data);
        state.steuerbescheide = state.steuerbescheide.map(x => x.jahr === b.jahr ? upd : x);
        toast('Steuerbescheid aktualisiert.');
      } else {
        const neu = await api.steuerbescheide.create(data);
        state.steuerbescheide.push(neu);
        toast('Steuerbescheid hinzugefügt.');
      }
      closeModal();
      renderSteuern();
    } catch (e) { toast(e.message); }
  };
  openModal();
  if (b) loadAnhaenge('steuerbescheid', b.id);
};

window.deleteSteuerbescheid = async function(jahr) {
  if (!confirm(`Steuerbescheid ${jahr} wirklich löschen?`)) return;
  try {
    await api.steuerbescheide.delete(jahr);
    state.steuerbescheide = state.steuerbescheide.filter(x => x.jahr !== jahr);
    renderSteuern();
    toast('Steuerbescheid gelöscht.');
  } catch (e) { toast(e.message); }
};

// ── Versicherung Form ─────────────────────────────────────────────────────────

window.openVersicherungForm = async function(id = null) {
  const v = id ? state.versicherungen.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = v ? 'Versicherung bearbeiten' : 'Versicherung hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Art <span class="required">*</span></label>
        <select id="f-art" class="form-input">
          ${Object.entries(VS_ART_LABEL).map(([k,l]) =>
            `<option value="${k}"${v?.art===k?' selected':''}>${l}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Bezeichnung <span class="required">*</span></label>
        <input id="f-bez" class="form-input" value="${escapeHtml(v?.bezeichnung??'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Anbieter <span class="required">*</span></label>
        <input id="f-anbieter" class="form-input" value="${escapeHtml(v?.anbieter??'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Vertragsnummer</label>
        <input id="f-vnr" class="form-input mono" value="${escapeHtml(v?.vertragsnummer??'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Beitrag (€) <span class="required">*</span></label>
        <input id="f-beitrag" class="form-input" type="number" step="1" value="${v?.beitrag??''}">
      </div>
      <div class="form-group">
        <label class="form-label">Zahlweise</label>
        <select id="f-zahlweise" class="form-input">
          ${['monatlich','quartalsweise','halbjährlich','jährlich'].map(z =>
            `<option value="${z}"${v?.zahlweise===z?' selected':''}>${z}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Läuft bis</label>
        <input id="f-laufzeit" class="form-input" type="date" value="${v?.laufzeit_bis??''}">
      </div>
      <div class="form-group">
        <label class="form-label">Kündigungsfrist (Tage)</label>
        <div class="frist-input-row">
          <input id="f-frist" class="form-input" type="number" step="1" value="${v?.kuendigungsfrist_tage??0}">
          ${fristBellHtml(v?.frist_erinnerung)}
        </div>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Kontakt Telefon</label>
        <input id="f-tel" class="form-input" value="${escapeHtml(v?.kontakt_telefon??'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Kontakt E-Mail</label>
        <input id="f-email" class="form-input" value="${escapeHtml(v?.kontakt_email??'')}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <input id="f-notiz" class="form-input" value="${escapeHtml(v?.notiz??'')}">
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('versicherung', id)}
  `;
  document.getElementById('modal-submit').onclick = async () => {
    const data = {
      art:                  document.getElementById('f-art').value,
      bezeichnung:          document.getElementById('f-bez').value.trim(),
      anbieter:             document.getElementById('f-anbieter').value.trim(),
      vertragsnummer:       document.getElementById('f-vnr').value.trim() || null,
      beitrag:              parseFloat(document.getElementById('f-beitrag').value) || 0,
      zahlweise:            document.getElementById('f-zahlweise').value,
      laufzeit_bis:         document.getElementById('f-laufzeit').value || null,
      kuendigungsfrist_tage: parseInt(document.getElementById('f-frist').value) || 0,
      frist_erinnerung:     document.getElementById('f-frist-bell').dataset.active === 'true',
      kontakt_telefon:      document.getElementById('f-tel').value.trim() || null,
      kontakt_email:        document.getElementById('f-email').value.trim() || null,
      notiz:                document.getElementById('f-notiz').value.trim() || null,
    };
    if (!data.bezeichnung || !data.anbieter) return toast('Bezeichnung und Anbieter erforderlich.');
    try {
      if (id) {
        const upd = await api.versicherungen.update(id, data);
        state.versicherungen = state.versicherungen.map(x => x.id === id ? upd : x);
        toast('Versicherung aktualisiert.');
      } else {
        const neu = await api.versicherungen.create(data);
        state.versicherungen.push(neu);
        toast('Versicherung hinzugefügt.');
      }
      closeModal();
      renderVersicherungen();
    } catch (e) { toast(e.message); }
  };
  openModal();
  if (id) loadAnhaenge('versicherung', id);
};

window.deleteVersicherung = async function(id) {
  const name = state.versicherungen.find(x => x.id === id)?.bezeichnung ?? '';
  if (!confirm(`„${name}" wirklich löschen?`)) return;
  try {
    await api.versicherungen.delete(id);
    state.versicherungen = state.versicherungen.filter(x => x.id !== id);
    renderVersicherungen();
    toast('Versicherung gelöscht.');
  } catch (e) { toast(e.message); }
};

// ── Vertrag Form ──────────────────────────────────────────────────────────────

window.openVertragForm = async function(id = null) {
  const v = id ? state.vertraege.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = v ? 'Vertrag bearbeiten' : 'Vertrag hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Art <span class="required">*</span></label>
        <select id="f-art" class="form-input">
          ${Object.entries(VT_ART_LABEL).map(([k,l]) =>
            `<option value="${k}"${v?.art===k?' selected':''}>${l}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Bezeichnung <span class="required">*</span></label>
        <input id="f-bez" class="form-input" value="${escapeHtml(v?.bezeichnung??'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Anbieter <span class="required">*</span></label>
        <input id="f-anbieter" class="form-input" value="${escapeHtml(v?.anbieter??'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Vertragsnummer</label>
        <input id="f-vnr" class="form-input mono" value="${escapeHtml(v?.vertragsnummer??'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Kosten (€) <span class="required">*</span></label>
        <input id="f-kosten" class="form-input" type="number" step="1" value="${v?.kosten??''}">
      </div>
      <div class="form-group">
        <label class="form-label">Zahlweise</label>
        <select id="f-zahlweise" class="form-input">
          ${['monatlich','quartalsweise','halbjährlich','jährlich'].map(z =>
            `<option value="${z}"${v?.zahlweise===z?' selected':''}>${z}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Läuft bis</label>
        <input id="f-laufzeit" class="form-input" type="date" value="${v?.laufzeit_bis??''}">
      </div>
      <div class="form-group">
        <label class="form-label">Kündigungsfrist (Tage)</label>
        <div class="frist-input-row">
          <input id="f-frist" class="form-input" type="number" step="1" value="${v?.kuendigungsfrist_tage??0}">
          ${fristBellHtml(v?.frist_erinnerung)}
        </div>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <input id="f-notiz" class="form-input" value="${escapeHtml(v?.notiz??'')}">
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('vertrag', id)}
  `;
  document.getElementById('modal-submit').onclick = async () => {
    const data = {
      art:                  document.getElementById('f-art').value,
      bezeichnung:          document.getElementById('f-bez').value.trim(),
      anbieter:             document.getElementById('f-anbieter').value.trim(),
      vertragsnummer:       document.getElementById('f-vnr').value.trim() || null,
      kosten:               parseFloat(document.getElementById('f-kosten').value) || 0,
      zahlweise:            document.getElementById('f-zahlweise').value,
      laufzeit_bis:         document.getElementById('f-laufzeit').value || null,
      kuendigungsfrist_tage: parseInt(document.getElementById('f-frist').value) || 0,
      frist_erinnerung:     document.getElementById('f-frist-bell').dataset.active === 'true',
      notiz:                document.getElementById('f-notiz').value.trim() || null,
    };
    if (!data.bezeichnung || !data.anbieter) return toast('Bezeichnung und Anbieter erforderlich.');
    try {
      if (id) {
        const upd = await api.vertraege.update(id, data);
        state.vertraege = state.vertraege.map(x => x.id === id ? upd : x);
        toast('Vertrag aktualisiert.');
      } else {
        const neu = await api.vertraege.create(data);
        state.vertraege.push(neu);
        toast('Vertrag hinzugefügt.');
      }
      closeModal();
      renderVertraege();
    } catch (e) { toast(e.message); }
  };
  openModal();
  if (id) loadAnhaenge('vertrag', id);
};

window.deleteVertrag = async function(id) {
  const name = state.vertraege.find(x => x.id === id)?.bezeichnung ?? '';
  if (!confirm(`„${name}" wirklich löschen?`)) return;
  try {
    await api.vertraege.delete(id);
    state.vertraege = state.vertraege.filter(x => x.id !== id);
    renderVertraege();
    toast('Vertrag gelöscht.');
  } catch (e) { toast(e.message); }
};

// ── Notfall ─────────────────────────────────────────────────────────────────

const NF_KAT_LABEL = {
  zugaenge:        'Zugänge & Passwörter',
  dokumente:       'Dokumente & Aufbewahrung',
  finanzen:        'Finanzielles',
  digital:         'Digitales Erbe',
  sofortmassnahme: 'Sofortmaßnahmen-Checkliste',
  sonstiges:       'Sonstiges',
};

const NF_KAT_ORDER = ['sofortmassnahme','zugaenge','dokumente','finanzen','digital','sonstiges'];

const NF_ROLLE_LABEL = {
  bank:            'Bank',
  versicherung:    'Versicherung',
  steuerberater:   'Steuerberater',
  anwalt:          'Anwalt',
  notar:           'Notar',
  arzt:            'Arzt',
  sonstiges:       'Sonstiges',
};

function nfRolleBadge(rolle) {
  // Feste, helle Textfarbe je Sparte + eigener dunkler Hintergrundton (statt
  // derselben Farbe nur transparent abgesetzt) — sonst verschwindet die
  // Badge im dunklen Theme (tokens.css: --surface #242424) fast vollständig,
  // weil Text und Hintergrund dieselbe dunkle Ausgangsfarbe teilen.
  const colors = {
    bank:          { bg: 'rgba(59, 74, 107, 0.35)',  fg: '#9DB4E0' },
    versicherung:  { bg: 'rgba(74, 82, 37, 0.35)',   fg: '#C3D17A' },
    steuerberater: { bg: 'rgba(107, 21, 16, 0.35)',  fg: '#F0958A' },
    anwalt:        { bg: 'rgba(92, 63, 26, 0.35)',   fg: '#E0B685' },
    notar:         { bg: 'rgba(61, 50, 96, 0.35)',   fg: '#C4B5F0' },
    arzt:          { bg: 'rgba(29, 77, 56, 0.35)',   fg: '#7FDBB0' },
    sonstiges:     { bg: 'rgba(255, 255, 255, 0.08)', fg: 'var(--wash-grey)' },
  };
  const c = colors[rolle] ?? colors.sonstiges;
  return `<span class="nf-rolle-badge" style="background:${c.bg};color:${c.fg};border:1px solid ${c.bg}">${NF_ROLLE_LABEL[rolle] ?? rolle}</span>`;
}

function renderNotfall() {
  const kontakte = state.kontakte ?? [];
  const eintraege = state.notfall ?? [];
  const sofort = eintraege.filter(e => e.kategorie === 'sofortmassnahme');
  const offenCount = sofort.filter(e => !e.erledigt).length;

  // Stats
  document.getElementById('nf-stat-kontakte').textContent   = kontakte.length;
  document.getElementById('nf-stat-eintraege').textContent  = eintraege.filter(e => e.kategorie !== 'sofortmassnahme').length;
  document.getElementById('nf-stat-offen').textContent      = offenCount;

  // Sofortmaßnahmen-Banner
  const banner = document.getElementById('notfall-checkliste-banner');
  if (offenCount > 0) {
    banner.innerHTML = `<div class="nf-alert-banner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span><strong>${offenCount} Sofortmaßnahme${offenCount !== 1 ? 'n' : ''}</strong> noch offen — bitte baldmöglichst abarbeiten.</span>
    </div>`;
  } else {
    banner.innerHTML = '';
  }

  // Kontakte-Tabelle
  const tbody = document.getElementById('notfall-kontakte-tbody');
  if (!kontakte.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Noch keine Kontakte erfasst.</td></tr>`;
  } else {
    tbody.innerHTML = kontakte.map(k => {
      const name = escHtml(k.name);
      const firma = k.firma ? `<br><small style="color:var(--wash-grey)">${escHtml(k.firma)}</small>` : '';
      const tel = k.telefon ? `<a href="tel:${escHtml(k.telefon)}" class="nf-link">${escHtml(k.telefon)}</a>` : '—';
      const mail = k.email ? `<a href="mailto:${escHtml(k.email)}" class="nf-link">${escHtml(k.email)}</a>` : '—';
      return `<tr>
        <td>${nfRolleBadge(k.rolle)}</td>
        <td><strong>${name}</strong>${firma}</td>
        <td class="mono">${tel}</td>
        <td>${mail}</td>
        <td style="color:var(--wash-grey);font-style:italic">${k.notiz ? escHtml(k.notiz) : '—'}</td>
        <td class="right"><div class="action-cell">
          <button class="btn-icon" onclick="openKontaktForm(${k.id})" title="Bearbeiten">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteKontakt(${k.id})" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div></td>
      </tr>`;
    }).join('');
  }

  // Einträge nach Kategorie
  const container = document.getElementById('notfall-eintraege-container');
  const byKat = {};
  eintraege.forEach(e => {
    if (!byKat[e.kategorie]) byKat[e.kategorie] = [];
    byKat[e.kategorie].push(e);
  });

  const sections = NF_KAT_ORDER.filter(k => byKat[k]?.length).map(kat => {
    const items = byKat[kat];
    const isSofort = kat === 'sofortmassnahme';

    const rows = items.map(e => {
      const titel = escHtml(e.titel);
      if (isSofort) {
        const done = e.erledigt;
        return `<tr class="${done ? 'nf-row-done' : ''}">
          <td style="width:36px">
            <button class="nf-check-btn ${done ? 'done' : ''}" onclick="nfToggleErledigt(${e.id},${!done})" title="${done ? 'Als offen markieren' : 'Als erledigt markieren'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </td>
          <td><span class="${done ? 'nf-done-text' : ''}">${titel}</span></td>
          <td style="color:var(--wash-grey)">${e.verweis ? escHtml(e.verweis) : '—'}</td>
          <td style="color:var(--wash-grey);font-style:italic">${e.hinweis ? escHtml(e.hinweis) : ''}</td>
          <td class="right"><div class="action-cell">
            <button class="btn-icon" onclick="openNotfallForm(${e.id})" title="Bearbeiten">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="btn-icon danger" onclick="deleteNotfallEintrag(${e.id})" title="Löschen">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div></td>
        </tr>`;
      }

      const prioBadge = e.prioritaet === 1
        ? '<span class="nf-prio prio-1">Sofort</span>'
        : e.prioritaet === 3
          ? '<span class="nf-prio prio-3">Irgendwann</span>'
          : '';

      return `<tr>
        <td><strong>${titel}</strong> ${prioBadge}</td>
        <td class="mono" style="color:var(--ink-black)">${e.verweis ? escHtml(e.verweis) : '—'}</td>
        <td style="color:var(--wash-grey);font-style:italic">${e.hinweis ? escHtml(e.hinweis) : ''}</td>
        <td>${nfGueltigBisCell(e.gueltig_bis)}</td>
        <td class="right"><div class="action-cell">
          <button class="btn-icon" onclick="openNotfallForm(${e.id})" title="Bearbeiten">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteNotfallEintrag(${e.id})" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div></td>
      </tr>`;
    }).join('');

    const headers = isSofort
      ? '<th style="width:36px"></th><th>Aufgabe</th><th>Wo / Was</th><th>Hinweis</th><th class="right">Aktionen</th>'
      : '<th>Titel</th><th>Wo liegt es / Verweis</th><th>Hinweis</th><th>Gültig bis</th><th class="right">Aktionen</th>';

    return `
      <div class="section-heading" style="margin-top:var(--space-6)">
        <span>${NF_KAT_LABEL[kat] ?? kat}</span>
      </div>
      <div class="card" style="padding:0;margin-bottom:var(--space-6)">
        <table class="data-table">
          <thead><tr>${headers}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  container.innerHTML = sections || `<div style="color:var(--wash-grey);font-style:italic;padding:var(--space-4) 0">Noch keine Einträge. Klicke "+ Eintrag" um zu beginnen.</div>`;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function nfGueltigBisCell(gueltigBis) {
  if (!gueltigBis) return '<span style="color:var(--wash-grey)">—</span>';
  const d = new Date(gueltigBis);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const fmtDate = d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const abgelaufen = d < today;
  const bald = !abgelaufen && (d - today) / 86400000 <= 90;
  const cls = abgelaufen ? 'urgent' : bald ? 'soon' : '';
  return `<span class="vs-laufzeit-cell ${cls}">${fmtDate}${abgelaufen ? ' ⚠' : ''}</span>`;
}

window.nfToggleErledigt = async (id, erledigt) => {
  try {
    await api.notfall.update(id, { erledigt });
    state.notfall = await api.notfall.list();
    renderNotfall();
  } catch (e) { toast(e.message); }
};

window.openKontaktForm = (id = null) => {
  state.editingId = id;
  const k = id ? state.kontakte.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = id ? 'Kontakt bearbeiten' : 'Kontakt hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Name <span class="required">*</span></label>
        <input id="f-name" class="form-input" type="text" value="${k?.name ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Rolle <span class="required">*</span></label>
        <select id="f-rolle" class="form-input">
          ${Object.entries(NF_ROLLE_LABEL).map(([v,l]) =>
            `<option value="${v}" ${k?.rolle===v?'selected':''}>${l}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Firma / Institut</label>
      <input id="f-firma" class="form-input" type="text" value="${k?.firma ?? ''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Telefon</label>
        <input id="f-telefon" class="form-input" type="text" value="${k?.telefon ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">E-Mail</label>
        <input id="f-email" class="form-input" type="email" value="${k?.email ?? ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Adresse</label>
      <input id="f-adresse" class="form-input" type="text" value="${k?.adresse ?? ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <textarea id="f-notiz" class="form-input" rows="2">${k?.notiz ?? ''}</textarea>
    </div>`;
  document.getElementById('modal-submit').onclick = saveKontakt;
  openModal();
};

async function saveKontakt() {
  const data = {
    name:    document.getElementById('f-name').value.trim(),
    rolle:   document.getElementById('f-rolle').value,
    firma:   document.getElementById('f-firma').value.trim() || null,
    telefon: document.getElementById('f-telefon').value.trim() || null,
    email:   document.getElementById('f-email').value.trim() || null,
    adresse: document.getElementById('f-adresse').value.trim() || null,
    notiz:   document.getElementById('f-notiz').value.trim() || null,
  };
  if (!data.name) { toast('Name ist Pflichtfeld.'); return; }
  try {
    if (state.editingId) {
      await api.kontakte.update(state.editingId, data);
      toast('Kontakt aktualisiert.');
    } else {
      await api.kontakte.create(data);
      toast('Kontakt gespeichert.');
    }
    closeModal();
    state.kontakte = await api.kontakte.list();
    renderNotfall();
  } catch (e) { toast(e.message); }
}

window.deleteKontakt = async (id) => {
  const name = state.kontakte.find(x => x.id === id)?.name ?? '';
  if (!confirm(`Kontakt „${name}" wirklich löschen?`)) return;
  try {
    await api.kontakte.delete(id);
    toast('Kontakt gelöscht.');
    state.kontakte = await api.kontakte.list();
    renderNotfall();
  } catch (e) { toast(e.message); }
};

window.openNotfallForm = (id = null) => {
  state.editingId = id;
  const e = id ? state.notfall.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = id ? 'Eintrag bearbeiten' : 'Notfall-Eintrag hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Titel <span class="required">*</span></label>
      <input id="f-titel" class="form-input" type="text" value="${e?.titel ?? ''}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Kategorie <span class="required">*</span></label>
        <select id="f-kategorie" class="form-input">
          ${Object.entries(NF_KAT_LABEL).map(([v,l]) =>
            `<option value="${v}" ${e?.kategorie===v?'selected':''}>${l}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Priorität</label>
        <select id="f-prioritaet" class="form-input">
          <option value="1" ${e?.prioritaet===1?'selected':''}>Sofort</option>
          <option value="2" ${(!e||e.prioritaet===2)?'selected':''}>Normal</option>
          <option value="3" ${e?.prioritaet===3?'selected':''}>Irgendwann</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Wo liegt es / Verweis</label>
      <input id="f-verweis" class="form-input" type="text" value="${e?.verweis ?? ''}">
    </div>
    <div class="form-group">
      <label class="form-label">Hinweis <span style="color:var(--wash-grey);font-weight:400">(kein Klartext-Passwort!)</span></label>
      <textarea id="f-hinweis" class="form-input" rows="3">${e?.hinweis ?? ''}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">Gültig bis <span style="color:var(--wash-grey);font-weight:400">(optional, z. B. bei Vollmachten/Verfügungen)</span></label>
      <input id="f-gueltig-bis" class="form-input" type="date" value="${fmt.dateISO(e?.gueltig_bis)}">
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('notfall', id)}
  `;
  document.getElementById('modal-submit').onclick = saveNotfallEintrag;
  openModal();
  if (id) loadAnhaenge('notfall', id);
};

async function saveNotfallEintrag() {
  const data = {
    titel:      document.getElementById('f-titel').value.trim(),
    kategorie:  document.getElementById('f-kategorie').value,
    prioritaet: parseInt(document.getElementById('f-prioritaet').value),
    verweis:    document.getElementById('f-verweis').value.trim() || null,
    hinweis:    document.getElementById('f-hinweis').value.trim() || null,
    gueltig_bis: document.getElementById('f-gueltig-bis').value || null,
  };
  if (!data.titel) { toast('Titel ist Pflichtfeld.'); return; }
  try {
    if (state.editingId) {
      await api.notfall.update(state.editingId, data);
      toast('Eintrag aktualisiert.');
    } else {
      await api.notfall.create(data);
      toast('Eintrag gespeichert.');
    }
    closeModal();
    state.notfall = await api.notfall.list();
    renderNotfall();
  } catch (e) { toast(e.message); }
}

window.deleteNotfallEintrag = async (id) => {
  const titel = state.notfall.find(x => x.id === id)?.titel ?? '';
  if (!confirm(`Eintrag „${titel}" wirklich löschen?`)) return;
  try {
    await api.notfall.delete(id);
    toast('Eintrag gelöscht.');
    state.notfall = await api.notfall.list();
    renderNotfall();
  } catch (e) { toast(e.message); }
};

// ── Update ──────────────────────────────────────────────────────────────────

window.triggerUpdate = async () => {
  const modal = document.getElementById('update-modal');
  const body  = document.getElementById('update-modal-body');
  const btn   = document.getElementById('update-btn');

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('open'), 10);
  body.innerHTML = `
    <div class="update-spinner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="spin">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      <span>Update wird geladen…</span>
    </div>`;
  btn.classList.add('loading');

  try {
    const res = await fetch('/api/v1/system/update', { method: 'POST' });
    const data = await res.json();
    const msgClass = data.success ? 'success' : 'error';
    const reloadBtn = (data.success && data.detail)
      ? `<button class="update-reload-btn" onclick="location.reload()">Seite neu laden</button>`
      : '';
    body.innerHTML = `
      <p class="update-result-msg ${msgClass}">${escHtml(data.message)}</p>
      ${data.detail ? `<p class="update-detail">${escHtml(data.detail)}</p>` : ''}
      ${reloadBtn}`;
  } catch (e) {
    body.innerHTML = `<p class="update-result-msg error">Keine Verbindung zur App. Bitte Seite neu laden.</p>`;
  } finally {
    btn.classList.remove('loading');
  }
};

window.triggerPublish = async () => {
  const modal = document.getElementById('update-modal');
  const body  = document.getElementById('update-modal-body');
  const btn   = document.getElementById('publish-btn');

  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('open'), 10);
  body.innerHTML = `
    <div class="update-spinner">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28" class="spin">
        <path d="M21 12a9 9 0 11-6.219-8.56"/>
      </svg>
      <span>Wird veröffentlicht…</span>
    </div>`;
  btn.classList.add('loading');

  try {
    const res  = await fetch('/api/v1/system/publish', { method: 'POST' });
    const data = await res.json();
    const msgClass = data.success ? 'success' : 'error';
    body.innerHTML = `
      <p class="update-result-msg ${msgClass}">${escHtml(data.message)}</p>
      ${data.detail ? `<p class="update-detail">${escHtml(data.detail)}</p>` : ''}`;
  } catch (e) {
    body.innerHTML = `<p class="update-result-msg error">Keine Verbindung zur App. Bitte Seite neu laden.</p>`;
  } finally {
    btn.classList.remove('loading');
  }
};

window.closeUpdateModal = () => {
  const modal = document.getElementById('update-modal');
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
};

// ── ToDo-Liste ───────────────────────────────────────────────────────────────

// Ampelfarben für Priorität / Dringlichkeit
const AMPEL_COLOR = { hoch: '#C0392B', mittel: '#D9A40B', niedrig: '#3E9C5F' };
const PRIO_LABEL  = { hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig' };

function ampelBadge(prio) {
  const c = AMPEL_COLOR[prio] ?? 'var(--wash-grey)';
  return `<span class="badge ampel-badge" style="color:${c};border-color:${c}">
    <span class="ampel-dot" style="background:${c}"></span>${PRIO_LABEL[prio] ?? prio}</span>`;
}

const TODO_PRIO_LABEL = PRIO_LABEL;
const TODO_ZUSTAEND_LABEL = { ich: 'Ich', ehefrau: 'Ehefrau', beide: 'Beide' };

function renderTodos() {
  const todos = state.todos ?? [];
  const host = document.getElementById('todos-container');
  if (!host) return;

  if (!todos.length) {
    host.innerHTML = '<p class="empty-state">Noch keine Aufgaben erfasst.</p>';
    return;
  }

  const offen    = todos.filter(t => !t.erledigt);
  const erledigt = todos.filter(t => t.erledigt);

  const renderItem = (t) => {
    const overdue = t.faelligkeit && !t.erledigt && new Date(t.faelligkeit) < new Date();
    const fällig  = t.faelligkeit
      ? `<span class="todo-date mono${overdue ? ' overdue' : ''}">${fmt.date(t.faelligkeit)}${overdue ? ' ⚠' : ''}</span>`
      : '';
    return `
      <div class="todo-item${t.erledigt ? ' done' : ''}">
        <button class="todo-check" onclick="toggleTodo(${t.id}, ${!t.erledigt})" title="${t.erledigt ? 'Als offen markieren' : 'Erledigt'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
            ${t.erledigt ? '<polyline points="20 6 9 17 4 12"/>' : '<rect x="3" y="3" width="18" height="18" rx="2"/>'}
          </svg>
        </button>
        <div class="todo-body">
          <span class="todo-titel">${escapeHtml(t.titel)}</span>
          ${t.notiz ? `<span class="todo-notiz">${escapeHtml(t.notiz)}</span>` : ''}
        </div>
        <div class="todo-meta">
          ${fällig}
          ${ampelBadge(t.prioritaet)}
          <span class="badge">${TODO_ZUSTAEND_LABEL[t.zustaendigkeit] ?? t.zustaendigkeit}</span>
        </div>
        <div class="todo-actions">
          <button class="btn-icon" onclick="openTodoForm(${t.id})" title="Bearbeiten">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteTodo(${t.id})" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>`;
  };

  host.innerHTML = `
    <div class="card todo-card">
      <div class="todo-section-head">Offen (${offen.length})</div>
      ${offen.length ? offen.map(renderItem).join('') : '<p class="todo-empty">Alles erledigt!</p>'}
    </div>
    ${erledigt.length ? `
    <div class="card todo-card" style="margin-top:var(--space-6)">
      <div class="todo-section-head muted">Erledigt (${erledigt.length})</div>
      ${erledigt.map(renderItem).join('')}
    </div>` : ''}`;
}

window.toggleTodo = async function(id, erledigt) {
  try {
    const upd = await api.todos.update(id, { erledigt });
    state.todos = state.todos.map(t => t.id === id ? upd : t);
    renderTodos();
  } catch (e) { toast(e.message); }
};

window.openTodoForm = function(id = null) {
  state.editingId = id;
  const t = id ? state.todos.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = id ? 'Aufgabe bearbeiten' : 'Aufgabe hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Titel <span class="required">*</span></label>
      <input id="f-titel" class="form-input" value="${escapeHtml(t?.titel ?? '')}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Priorität</label>
        <select id="f-prio" class="form-input">
          ${['hoch','mittel','niedrig'].map(p => `<option value="${p}"${t?.prioritaet===p?' selected':''}>${TODO_PRIO_LABEL[p]}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Zuständigkeit</label>
        <select id="f-zustaend" class="form-input">
          ${['ich','ehefrau','beide'].map(z => `<option value="${z}"${t?.zustaendigkeit===z?' selected':''}>${TODO_ZUSTAEND_LABEL[z]}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Fälligkeitsdatum</label>
      <input id="f-faellig" class="form-input" type="date" value="${fmt.dateISO(t?.faelligkeit)}">
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <textarea id="f-notiz" class="form-input" rows="3" style="resize:vertical">${escapeHtml(t?.notiz ?? '')}</textarea>
    </div>`;
  document.getElementById('modal-submit').onclick = submitTodoForm;
  openModal();
};

async function submitTodoForm() {
  const data = {
    titel:          document.getElementById('f-titel').value.trim(),
    prioritaet:     document.getElementById('f-prio').value,
    zustaendigkeit: document.getElementById('f-zustaend').value,
    faelligkeit:    document.getElementById('f-faellig').value || null,
    notiz:          document.getElementById('f-notiz').value.trim() || null,
  };
  if (!data.titel) return toast('Bitte Titel ausfüllen.');
  try {
    if (state.editingId) {
      const upd = await api.todos.update(state.editingId, data);
      state.todos = state.todos.map(t => t.id === state.editingId ? upd : t);
      toast('Aufgabe aktualisiert.');
    } else {
      const neu = await api.todos.create(data);
      state.todos.unshift(neu);
      toast('Aufgabe gespeichert.');
    }
    closeModal();
    renderTodos();
  } catch (e) { toast(e.message); }
}

window.deleteTodo = async function(id) {
  const name = state.todos.find(x => x.id === id)?.titel ?? '';
  if (!confirm(`Aufgabe „${name}" wirklich löschen?`)) return;
  try {
    await api.todos.delete(id);
    state.todos = state.todos.filter(x => x.id !== id);
    renderTodos();
    toast('Aufgabe gelöscht.');
  } catch (e) { toast(e.message); }
};




// ── Globale Exports (für onclick-Handler in HTML) ───────────────────────────

window.navigate         = navigate;
window.openKontaktForm  = window.openKontaktForm;
window.openNotfallForm  = window.openNotfallForm;
window.spRecalc         = spRecalc;
window.spSavePlanField  = spSavePlanField;
window.spSavePosName    = spSavePosName;
window.spSavePosAmount  = spSavePosAmount;
window.spSavePosEmpf    = spSavePosEmpf;
window.spQueueSaveName  = spQueueSaveName;
window.spQueueSaveAmount = spQueueSaveAmount;

// ── Init ────────────────────────────────────────────────────────────────────

// ── Demo-Modus ──────────────────────────────────────────────────────────────

function applyDemoMode() {
  document.body.classList.toggle('demo-mode', state.demoMode);
  const btn    = document.getElementById('demo-toggle-btn');
  const banner = document.getElementById('demo-banner');
  if (btn) btn.classList.toggle('active', state.demoMode);
  if (banner) banner.style.display = state.demoMode ? 'flex' : 'none';
}

window.toggleDemoMode = async function() {
  state.demoMode = !state.demoMode;
  sessionStorage.setItem('mfb-demo', state.demoMode ? '1' : '0');
  applyDemoMode();
  spPlan = null;
  await refresh();
  toast(state.demoMode ? 'Demo-Modus aktiv — es werden Musterdaten angezeigt.' : 'Demo-Modus deaktiviert — echte Daten werden geladen.');
};

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation
  document.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.classList.contains('disabled')) return;
      navigate(el.dataset.view);
    });
  });

  // Modal Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  // mousedown statt click: schließt das Modal nur wenn der Klick auf dem
  // Overlay *beginnt* — verhindert unbeabsichtigtes Schließen beim Textarea-
  // Resize, falls die Maus dabei über den Rand des Modals hinausgleitet.
  document.getElementById('modal-overlay')?.addEventListener('mousedown', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Snapshot-Popup bei Klick außerhalb oder Escape schließen
  document.addEventListener('mousedown', e => {
    const popup = document.getElementById('snapshot-popup');
    if (popup && !popup.contains(e.target)) closeSnapshotPopup();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSnapshotPopup();
  });

  // Demo-Modus aus sessionStorage wiederherstellen
  applyDemoMode();

  try {
    await loadAll();
    await autoSnapshotWennNeuerMonat();
    navigate('dashboard');
  } catch (e) {
    console.error('Init-Fehler:', e);
  }
});

// Setzt beim ersten App-Start eines Kalendermonats automatisch einen
// Nettovermögens-Snapshot — vorher entstand der Verlauf nur, wenn man aktiv
// auf "Snapshot speichern" klickte, wodurch die Kurve über Monate lückenhaft
// blieb. Läuft nur einmal pro Monat (nicht bei jedem Öffnen der App).
async function autoSnapshotWennNeuerMonat() {
  if (state.demoMode) return;
  const verlauf = state.networth?.verlauf ?? [];
  const letzter = verlauf[verlauf.length - 1];
  const aktMonat = new Date().toISOString().substring(0, 7);
  if (letzter && letzter.datum.substring(0, 7) === aktMonat) return;
  try {
    await api.networth.snapshot();
    state.networth = await api.networth.get();
  } catch (e) {
    console.warn('Automatischer Monats-Snapshot fehlgeschlagen:', e.message);
  }
}

// ── Steuerprognose ───────────────────────────────────────────────────────────
// Reine Planungsrechnung (Einkommen-, Gewerbesteuer, Vorauszahlungs-Abgleich).
// Die eigentliche Steuermathematik liegt ausschließlich im Backend
// (backend/services/steuer.py) — hier wird nur der Eingabe-Zustand gehalten,
// gespeichert und das fertige Ergebnis dargestellt. Keine Duplikation der
// Rechenlogik in JS, um Drift zwischen Frontend und der getesteten
// Backend-Quelle der Wahrheit zu vermeiden (vgl. tilgung.py-Konvention).

let stState = null;
let stErgebnis = null;
let stExists = false;

function stDefaultState(jahr) {
  return {
    jahr, veranlagung: 'zusammen', kirchensteuerpflicht: 'niemand', zerlegungsmodus: 'arbeitsloehne',
    gewinn_gewerbebetrieb: 0, gewinn_gewerbebetrieb_ehefrau: 0, sonstige_einkuenfte: 0,
    bruttolohn_ehefrau: 0, werbungskosten_ehefrau: 0,
    vermietung_einnahmen: 0, vermietung_werbungskosten: 0, vermietung_afa: 0,
    kv_pv_beitraege_gesamt: 0, basisrente_beitrag: 0,
    uebrige_vorsorge_ich: 0, uebrige_vorsorge_ehefrau: 0,
    spenden: 0, kinderbetreuungskosten: 0, handwerkerleistungen: 0,
    gewst_hinzurechnung_zinsen_mieten: 0, gewst_kuerzung_grundbesitz: 0,
    est_vz_q1: 0, est_vz_q2: 0, est_vz_q3: 0, est_vz_q4: 0,
    lohnsteuer_ehefrau: 0, soli_ehefrau: 0, kirchensteuer_ehefrau: 0,
    notiz: '',
    kinder: [],
    betriebsstaetten: [
      { gemeinde: 'Böblingen', hebesatz: 380, arbeitsloehne: 0, taetigkeitsanteil_pct: 0,   prozent_manuell: 33 },
      { gemeinde: 'Nürtingen', hebesatz: 390, arbeitsloehne: 0, taetigkeitsanteil_pct: 100,  prozent_manuell: 67 },
    ],
  };
}

function stFromApi(obj) {
  const felder = [
    'jahr', 'veranlagung', 'kirchensteuerpflicht', 'zerlegungsmodus',
    'gewinn_gewerbebetrieb', 'gewinn_gewerbebetrieb_ehefrau', 'sonstige_einkuenfte', 'bruttolohn_ehefrau', 'werbungskosten_ehefrau',
    'vermietung_einnahmen', 'vermietung_werbungskosten', 'vermietung_afa',
    'kv_pv_beitraege_gesamt', 'basisrente_beitrag', 'uebrige_vorsorge_ich', 'uebrige_vorsorge_ehefrau',
    'spenden', 'kinderbetreuungskosten', 'handwerkerleistungen',
    'gewst_hinzurechnung_zinsen_mieten', 'gewst_kuerzung_grundbesitz',
    'est_vz_q1', 'est_vz_q2', 'est_vz_q3', 'est_vz_q4',
    'lohnsteuer_ehefrau', 'soli_ehefrau', 'kirchensteuer_ehefrau',
  ];
  const out = {};
  felder.forEach(f => { out[f] = obj[f]; });
  out.notiz = obj.notiz || '';
  out.kinder = (obj.kinder || []).map(k => ({
    name: k.name || '', geburtsdatum: fmt.dateISO(k.geburtsdatum), in_ausbildung_18_25: !!k.in_ausbildung_18_25,
  }));
  out.betriebsstaetten = (obj.betriebsstaetten || []).map(b => ({
    gemeinde: b.gemeinde, hebesatz: b.hebesatz, arbeitsloehne: b.arbeitsloehne,
    taetigkeitsanteil_pct: b.taetigkeitsanteil_pct, prozent_manuell: b.prozent_manuell ?? 0,
  }));
  return out;
}

function stNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

let stIstNaeherung = false;

// Wählbare Jahre im Formular: zwei zurück, eins voraus ab dem aktuellen Jahr.
function stJahresliste() {
  const aktuell = new Date().getFullYear();
  return [aktuell - 2, aktuell - 1, aktuell, aktuell + 1];
}

async function stLadeJahr(jahr) {
  stErgebnis = null;

  try {
    const existing = await api.steuer.get(jahr);
    stState = stFromApi(existing);
    stExists = true;
  } catch {
    stState = stDefaultState(jahr);
    stExists = false;
    try {
      const heb = await api.steuer.hebesatzDefaults(jahr);
      stState.betriebsstaetten.forEach(b => { if (heb[b.gemeinde] != null) b.hebesatz = heb[b.gemeinde]; });
    } catch { /* Defaults bleiben hart im Formular hinterlegt */ }
  }

  try { stIstNaeherung = (await api.steuer.meta(jahr)).ist_naeherung; } catch { stIstNaeherung = false; }

  document.getElementById('modal-title').textContent = `Steuerprognose ${jahr}`;
  stRender();

  if (stExists) {
    try { stErgebnis = await api.steuer.berechnung(jahr); } catch { /* Formular bleibt trotzdem nutzbar */ }
    stRender();
  }
}

window.stSwitchJahr = function(jahr) {
  stLadeJahr(parseInt(jahr, 10));
};

window.openSteuerprognose = async function() {
  openModal();
  document.querySelector('#modal-overlay .modal')?.classList.add('modal--wide');
  const submitBtn = document.getElementById('modal-submit');
  submitBtn.textContent = 'Speichern & berechnen';
  submitBtn.onclick = stSaveUndBerechnen;

  await stLadeJahr(new Date().getFullYear());
};

window.stSetField = function(key, value, isNumber = true) {
  stState[key] = isNumber ? stNum(value) : value;
};

window.stSetFieldRerender = function(key, value) {
  stState[key] = value;
  stRender();
};

// ── Kinder ───────────────────────────────────────────────────────────────────

window.stAddKind = function() {
  stState.kinder.push({ name: '', geburtsdatum: '', in_ausbildung_18_25: false });
  stRenderKinderListe();
};
window.stRemoveKind = function(i) {
  stState.kinder.splice(i, 1);
  stRenderKinderListe();
};
window.stSetKindField = function(i, key, value) {
  stState.kinder[i][key] = value;
};
window.stSetKindCheckbox = function(i, key, checked) {
  stState.kinder[i][key] = checked;
};

function stKinderListeHtml() {
  if (stState.kinder.length === 0) {
    return `<p class="form-hint">Noch keine Kinder erfasst — Kindergeld/-freibetrag bleiben dann unberücksichtigt.</p>`;
  }
  return stState.kinder.map((k, i) => `
    <div class="st-kind-card">
      <button class="st-kind-remove" onclick="stRemoveKind(${i})" title="Kind entfernen">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="form-row">
        <div class="form-group" style="flex:1.2;margin-bottom:0">
          <label class="form-label">Name (optional)</label>
          <input class="form-input" value="${escapeHtml(k.name)}" onblur="stSetKindField(${i},'name',this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Geburtsdatum</label>
          <input class="form-input" type="date" value="${k.geburtsdatum}" onchange="stSetKindField(${i},'geburtsdatum',this.value)">
        </div>
      </div>
      <label class="st-kind-checkbox">
        <input type="checkbox" ${k.in_ausbildung_18_25 ? 'checked' : ''} onchange="stSetKindCheckbox(${i},'in_ausbildung_18_25',this.checked)">
        18–25, in Ausbildung
      </label>
    </div>`).join('');
}

function stRenderKinderListe() {
  const el = document.getElementById('st-kinder-liste');
  if (el) el.innerHTML = stKinderListeHtml();
}

// ── Betriebsstätten ──────────────────────────────────────────────────────────

window.stAddBetriebsstaette = function() {
  stState.betriebsstaetten.push({ gemeinde: '', hebesatz: 400, arbeitsloehne: 0, taetigkeitsanteil_pct: 0, prozent_manuell: 0, vorauszahlung: 0 });
  stRenderBetriebsstaettenTabelle();
};
window.stRemoveBetriebsstaette = function(i) {
  stState.betriebsstaetten.splice(i, 1);
  stRenderBetriebsstaettenTabelle();
};
window.stSetBetriebsstaetteField = function(i, key, value, isNumber = true) {
  stState.betriebsstaetten[i][key] = isNumber ? stNum(value) : value;
};

function stBetriebsstaettenTabelleHtml() {
  const arbeitsloehneModus = stState.zerlegungsmodus === 'arbeitsloehne';
  const rows = stState.betriebsstaetten.map((b, i) => `
    <div class="form-row" style="align-items:flex-end;gap:0.5rem;margin-bottom:0.5rem">
      <div class="form-group" style="flex:1;margin-bottom:0">
        <label class="form-label">Gemeinde</label>
        <input class="form-input" value="${escapeHtml(b.gemeinde)}" onblur="stSetBetriebsstaetteField(${i},'gemeinde',this.value,false)">
      </div>
      <div class="form-group" style="width:6rem;margin-bottom:0">
        <label class="form-label">Hebesatz %</label>
        <input class="form-input mono" type="number" step="1" value="${b.hebesatz}" onblur="stSetBetriebsstaetteField(${i},'hebesatz',this.value)">
      </div>
      ${arbeitsloehneModus ? `
      <div class="form-group" style="width:8rem;margin-bottom:0">
        <label class="form-label">Arbeitslöhne €</label>
        <input class="form-input mono" type="number" step="500" value="${b.arbeitsloehne}" onblur="stSetBetriebsstaetteField(${i},'arbeitsloehne',this.value)"
          title="Bereits je Arbeitnehmer auf 50.000 € gedeckelt eintragen (§ 31 Abs. 4 GewStG)">
      </div>
      <div class="form-group" style="width:7rem;margin-bottom:0">
        <label class="form-label">Inhaber tätig %</label>
        <input class="form-input mono" type="number" step="5" min="0" max="100" value="${b.taetigkeitsanteil_pct}" onblur="stSetBetriebsstaetteField(${i},'taetigkeitsanteil_pct',this.value)"
          title="Anteil deiner Arbeitszeit an diesem Standort — verteilt den fiktiven Unternehmerlohn (25.000 €, § 31 Abs. 5 GewStG)">
      </div>` : `
      <div class="form-group" style="width:7rem;margin-bottom:0">
        <label class="form-label">Anteil %</label>
        <input class="form-input mono" type="number" step="1" min="0" max="100" value="${b.prozent_manuell}" onblur="stSetBetriebsstaetteField(${i},'prozent_manuell',this.value)">
      </div>`}
      <div class="form-group" style="width:8rem;margin-bottom:0">
        <label class="form-label">GewSt-VZ €</label>
        <input class="form-input mono" type="number" step="100" value="${b.vorauszahlung ?? 0}" onblur="stSetBetriebsstaetteField(${i},'vorauszahlung',this.value)"
          title="Bereits geleistete Gewerbesteuer-Vorauszahlung an diese Gemeinde">
      </div>
      <button class="btn btn-ghost btn-sm" onclick="stRemoveBetriebsstaette(${i})" title="Betriebsstätte entfernen" style="margin-bottom:0.1rem">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');
  return rows || `<p class="form-hint">Mindestens eine Betriebsstätte wird für die Gewerbesteuer benötigt.</p>`;
}

function stRenderBetriebsstaettenTabelle() {
  const el = document.getElementById('st-betriebsstaetten-tabelle');
  if (el) el.innerHTML = stBetriebsstaettenTabelleHtml();
}

// ── Speichern & Berechnen ────────────────────────────────────────────────────

async function stSaveUndBerechnen() {
  const payload = { ...stState };
  delete payload.jahr; // Jahr wird über den URL-Pfad adressiert, nicht im Body geändert
  payload.jahr = stState.jahr;
  try {
    if (stExists) {
      await api.steuer.update(stState.jahr, payload);
    } else {
      await api.steuer.create(payload);
      stExists = true;
    }
    stErgebnis = await api.steuer.berechnung(stState.jahr);
    toast('Steuerprognose gespeichert');
    stRender();
  } catch (e) {
    toast(e.message);
  }
}

// ── Ergebnis-Darstellung ─────────────────────────────────────────────────────

// Listet die einzelnen Einkunftsquellen auf, bevor sie zur "Summe der
// Einkünfte" addiert werden — sonst verschwindet die Herkunft einer
// Veränderung (z. B. Fotostudio-Gewinn gestiegen vs. Vermietung geschrumpft)
// hinter einer einzigen Zahl. Quellen ohne Wert werden ausgeblendet, damit die
// Liste nicht mit Nullzeilen (z. B. keine Vermietung) vollläuft.
function stEinkuenfteZeilenHtml(ek) {
  if (!ek) return '';
  const zeilen = [
    ['Gewinn Gewerbebetrieb (Ehemann)', ek.gewerbebetrieb],
    ['Gewinn Gewerbebetrieb (Ehefrau)', ek.gewerbebetrieb_ehefrau],
    ['Nichtselbstständige Arbeit (Ehefrau, netto)', ek.nichtselbststaendig_ehefrau],
    ['Vermietung und Verpachtung (netto)', ek.vermietung],
    ['Sonstige Einkünfte', ek.sonstige],
  ].filter(([, wert]) => wert !== 0);
  if (!zeilen.length) return '';
  return zeilen.map(([label, wert]) => `
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0;color:var(--wash-grey)">
        <span>${label}</span><span class="mono">${fmt.eur(wert)}</span>
      </div>`).join('');
}

function stErgebnisHtml() {
  if (!stErgebnis) return '';
  const e = stErgebnis;
  const nachzahlungFarbe = e.nachzahlung_gesamt > 0 ? 'stat-card--red' : 'stat-card--green';
  const nachzahlungLabel = e.nachzahlung_gesamt > 0 ? 'Erwartete Nachzahlung' : 'Erwartete Erstattung';

  return `
    <div class="form-section-head" style="margin-top:1.5rem">Ergebnis</div>
    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
      <div class="stat-card stat-card--gold">
        <div class="label">Gesamtbelastung</div>
        <div class="value mono">${fmt.eur(e.gesamtbelastung)}</div>
      </div>
      <div class="stat-card ${nachzahlungFarbe}">
        <div class="label">${nachzahlungLabel}</div>
        <div class="value mono">${fmt.eur(Math.abs(e.nachzahlung_gesamt))}</div>
      </div>
      <div class="stat-card stat-card--amber">
        <div class="label">Monatliche Rücklage</div>
        <div class="value mono">${fmt.eur(e.monatliche_ruecklage_empfehlung)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Gewerbesteuer gesamt</div>
        <div class="value mono">${fmt.eur(e.gewerbesteuer_gesamt)}</div>
      </div>
    </div>

    <div class="card" style="padding:1rem 1.25rem;margin-top:1rem">
      ${stEinkuenfteZeilenHtml(e.einkuenfte)}
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0;font-weight:600;border-top:1px dashed var(--ink-wash);margin-top:0.35rem;padding-top:0.6rem">
        <span>Summe der Einkünfte</span><span class="mono">${fmt.eur(e.summe_einkuenfte)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0">
        <span>zu versteuerndes Einkommen (vor Kinderfreibetrag)</span><span class="mono">${fmt.eur(e.zve_vor_kinderfreibetrag)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0;border-top:1px dashed var(--ink-wash);margin-top:0.35rem;padding-top:0.6rem">
        <span>Tarifliche Einkommensteuer</span><span class="mono">${fmt.eur(e.est_tariflich)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0;color:var(--wash-grey)">
        <span>− Anrechnung Gewerbesteuer (§ 35 EStG)</span><span class="mono">− ${fmt.eur(e.anrechnung_35a)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0;font-weight:600">
        <span>ESt nach Anrechnung</span><span class="mono">${fmt.eur(e.est_nach_anrechnung)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0">
        <span>+ Solidaritätszuschlag</span><span class="mono">${fmt.eur(e.soli)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0">
        <span>+ Kirchensteuer</span><span class="mono">${fmt.eur(e.kirchensteuer)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.25rem 0">
        <span>+ Gewerbesteuer (nach Zerlegung)</span><span class="mono">${fmt.eur(e.gewerbesteuer_gesamt)}</span>
      </div>
    </div>

    <div class="card" style="padding:1rem 1.25rem;margin-top:0.75rem">
      <div class="form-section-head" style="margin:0 0 0.5rem">Günstigerprüfung Kinder</div>
      <p style="font-size:var(--text-sm)">
        ${e.kinder.anzahl_anspruchsberechtigt} anspruchsberechtigte(s) Kind(er) —
        ${e.kinder.kinderfreibetrag_guenstiger
          ? `Kinderfreibetrag ist günstiger. Ersparnis ${fmt.eur(e.kinder.steuerersparnis_kfb)}, davon wird das erhaltene Kindergeld (${fmt.eur(e.kinder.kindergeld_gesamt)}) der Steuer wieder hinzugerechnet.`
          : `Kindergeld (${fmt.eur(e.kinder.kindergeld_gesamt)}) bleibt günstiger als der Kinderfreibetrag.`}
      </p>
    </div>

    <div class="card" style="padding:0;margin-top:0.75rem">
      <table class="data-table">
        <thead><tr><th>Gemeinde</th><th>Hebesatz</th><th class="right">Anteil</th><th class="right">Messbetrag-Anteil</th><th class="right">Gewerbesteuer</th></tr></thead>
        <tbody>
          ${e.zerlegung.map(z => `
            <tr>
              <td>${escapeHtml(z.gemeinde)}</td>
              <td class="mono">${z.hebesatz.toFixed(0)} %</td>
              <td class="right mono">${z.anteil_pct.toFixed(1)} %</td>
              <td class="right mono">${fmt.eur(z.messbetrag_anteil)}</td>
              <td class="right mono">${fmt.eur(z.gewerbesteuer)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <p class="form-hint" style="margin-top:0.75rem">${escapeHtml(e.hinweis)}</p>
  `;
}

function stRender() {
  const s = stState;
  document.getElementById('modal-body').innerHTML = `
    <p class="form-hint">Planungsrechnung zur eigenen Vorsorge — ersetzt keine Steuerberatung. Werte einmal im Monat nachpflegen, um die Prognose aktuell zu halten.</p>

    <div class="form-section-head">Grunddaten</div>
    <div class="form-group" style="max-width:12rem">
      <label class="form-label">Steuerjahr</label>
      <select class="form-select mono" onchange="stSwitchJahr(this.value)">
        ${stJahresliste().map(j => `<option value="${j}" ${j === s.jahr ? 'selected' : ''}>${j}</option>`).join('')}
      </select>
    </div>
    ${stIstNaeherung ? `<p class="form-hint" style="color:#F87171">Für ${s.jahr} liegt noch kein eigens recherchierter Tarif vor — die Berechnung nähert sich mit den Werten des jüngsten bekannten Jahres an.</p>` : ''}
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Veranlagung</label>
        <select class="form-select" onchange="stSetFieldRerender('veranlagung', this.value)">
          <option value="zusammen" ${s.veranlagung === 'zusammen' ? 'selected' : ''}>Zusammenveranlagung (Splitting)</option>
          <option value="einzeln" ${s.veranlagung === 'einzeln' ? 'selected' : ''}>Einzelveranlagung</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Kirchensteuerpflicht</label>
        <select class="form-select" onchange="stSetField('kirchensteuerpflicht', this.value, false)">
          <option value="niemand" ${s.kirchensteuerpflicht === 'niemand' ? 'selected' : ''}>Niemand</option>
          <option value="beide" ${s.kirchensteuerpflicht === 'beide' ? 'selected' : ''}>Beide</option>
          <option value="ich" ${s.kirchensteuerpflicht === 'ich' ? 'selected' : ''}>Nur ich</option>
          <option value="ehefrau" ${s.kirchensteuerpflicht === 'ehefrau' ? 'selected' : ''}>Nur meine Frau</option>
        </select>
      </div>
    </div>

    <div class="form-section-head">Einkünfte</div>
    <div class="st-person-cols">
      <div class="st-person-card">
        <div class="st-person-card-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="15" height="15"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/></svg>
          Ich
        </div>
        <div class="form-group">
          <label class="form-label">Gewinn aus Gewerbebetrieb (€)</label>
          <input class="form-input mono" type="number" step="500" value="${s.gewinn_gewerbebetrieb}" onblur="stSetField('gewinn_gewerbebetrieb', this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Sonstige Einkünfte (€)</label>
          <input class="form-input mono" type="number" step="100" value="${s.sonstige_einkuenfte}" onblur="stSetField('sonstige_einkuenfte', this.value)">
        </div>
      </div>
      <div class="st-person-card">
        <div class="st-person-card-head">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="15" height="15"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0116 0v1"/></svg>
          Ehefrau
        </div>
        <div class="form-group">
          <label class="form-label">Gewinn aus Gewerbebetrieb (€)</label>
          <input class="form-input mono" type="number" step="500" value="${s.gewinn_gewerbebetrieb_ehefrau}" onblur="stSetField('gewinn_gewerbebetrieb_ehefrau', this.value)">
        </div>
        <div class="form-group">
          <label class="form-label">Bruttolohn (€)</label>
          <input class="form-input mono" type="number" step="500" value="${s.bruttolohn_ehefrau}" onblur="stSetField('bruttolohn_ehefrau', this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Werbungskosten (€)</label>
          <input class="form-input mono" type="number" step="50" value="${s.werbungskosten_ehefrau}" onblur="stSetField('werbungskosten_ehefrau', this.value)">
          <p class="form-hint">Mindestens der Arbeitnehmer-Pauschbetrag wird automatisch angesetzt.</p>
        </div>
      </div>
    </div>
    <div class="st-person-card" style="margin-top:0.75rem">
      <div class="st-person-card-head">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" width="15" height="15"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
        Gemeinsam — Vermietung
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Einnahmen (€)</label>
          <input class="form-input mono" type="number" step="100" value="${s.vermietung_einnahmen}" onblur="stSetField('vermietung_einnahmen', this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Werbungskosten (€)</label>
          <input class="form-input mono" type="number" step="100" value="${s.vermietung_werbungskosten}" onblur="stSetField('vermietung_werbungskosten', this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">AfA (€)</label>
          <input class="form-input mono" type="number" step="50" value="${s.vermietung_afa}" onblur="stSetField('vermietung_afa', this.value)">
        </div>
      </div>
    </div>

    <div class="form-section-head">Abzüge / Sonderausgaben</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Kranken-/Pflegeversicherung gesamt (€)</label>
        <input class="form-input mono" type="number" step="100" value="${s.kv_pv_beitraege_gesamt}" onblur="stSetField('kv_pv_beitraege_gesamt', this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Basisrente / Rürup (€)</label>
        <input class="form-input mono" type="number" step="100" value="${s.basisrente_beitrag}" onblur="stSetField('basisrente_beitrag', this.value)">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Übrige Vorsorge — ich (€)</label>
        <input class="form-input mono" type="number" step="50" value="${s.uebrige_vorsorge_ich}" onblur="stSetField('uebrige_vorsorge_ich', this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Übrige Vorsorge — Ehefrau (€)</label>
        <input class="form-input mono" type="number" step="50" value="${s.uebrige_vorsorge_ehefrau}" onblur="stSetField('uebrige_vorsorge_ehefrau', this.value)">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Spenden (€)</label>
        <input class="form-input mono" type="number" step="50" value="${s.spenden}" onblur="stSetField('spenden', this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Kinderbetreuungskosten (€)</label>
        <input class="form-input mono" type="number" step="50" value="${s.kinderbetreuungskosten}" onblur="stSetField('kinderbetreuungskosten', this.value)">
      </div>
      <div class="form-group">
        <label class="form-label">Handwerkerleistungen — Lohnanteil (€)</label>
        <input class="form-input mono" type="number" step="50" value="${s.handwerkerleistungen}" onblur="stSetField('handwerkerleistungen', this.value)">
      </div>
    </div>

    <div class="form-section-head">Kinder</div>
    <div id="st-kinder-liste">${stKinderListeHtml()}</div>
    <button class="sp-add-btn" onclick="stAddKind()" style="margin-bottom:0.5rem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
      Kind hinzufügen
    </button>

    <div class="form-section-head">Gewerbesteuer — Zerlegung</div>
    <div class="form-group">
      <label class="form-label">Zerlegungsmaßstab</label>
      <select class="form-select" onchange="stSetFieldRerender('zerlegungsmodus', this.value)">
        <option value="arbeitsloehne" ${s.zerlegungsmodus === 'arbeitsloehne' ? 'selected' : ''}>Arbeitslöhne (gesetzeskonform, § 29 GewStG)</option>
        <option value="prozent" ${s.zerlegungsmodus === 'prozent' ? 'selected' : ''}>Fester Prozentsatz (eigene Schätzung)</option>
      </select>
    </div>
    <div id="st-betriebsstaetten-tabelle">${stBetriebsstaettenTabelleHtml()}</div>
    <button class="sp-add-btn" onclick="stAddBetriebsstaette()" style="margin-bottom:0.5rem">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M12 5v14M5 12h14"/></svg>
      Betriebsstätte hinzufügen
    </button>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Finanzierungsanteile § 8 Nr. 1 GewStG (€)</label>
        <input class="form-input mono" type="number" step="1000" value="${s.gewst_hinzurechnung_zinsen_mieten}" onblur="stSetField('gewst_hinzurechnung_zinsen_mieten', this.value)">
        <p class="form-hint">Bereits gewichtete Summe wie im Bescheid: Zinsen voll, Miete bewegliche WG ⅕, unbewegliche ⅟₂, Lizenzen ¼. Der Freibetrag von 200.000 € wird automatisch abgezogen.</p>
      </div>
      <div class="form-group">
        <label class="form-label">Kürzung Grundbesitz (§ 9 GewStG, €)</label>
        <input class="form-input mono" type="number" step="100" value="${s.gewst_kuerzung_grundbesitz}" onblur="stSetField('gewst_kuerzung_grundbesitz', this.value)">
      </div>
    </div>

    <div class="form-section-head">Vorauszahlungen &amp; Abgleich</div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">ESt-VZ Q1 (€)</label><input class="form-input mono" type="number" step="100" value="${s.est_vz_q1}" onblur="stSetField('est_vz_q1', this.value)"></div>
      <div class="form-group"><label class="form-label">ESt-VZ Q2 (€)</label><input class="form-input mono" type="number" step="100" value="${s.est_vz_q2}" onblur="stSetField('est_vz_q2', this.value)"></div>
      <div class="form-group"><label class="form-label">ESt-VZ Q3 (€)</label><input class="form-input mono" type="number" step="100" value="${s.est_vz_q3}" onblur="stSetField('est_vz_q3', this.value)"></div>
      <div class="form-group"><label class="form-label">ESt-VZ Q4 (€)</label><input class="form-input mono" type="number" step="100" value="${s.est_vz_q4}" onblur="stSetField('est_vz_q4', this.value)"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Lohnsteuer Ehefrau (€)</label><input class="form-input mono" type="number" step="100" value="${s.lohnsteuer_ehefrau}" onblur="stSetField('lohnsteuer_ehefrau', this.value)"></div>
      <div class="form-group"><label class="form-label">Soli Ehefrau (€)</label><input class="form-input mono" type="number" step="10" value="${s.soli_ehefrau}" onblur="stSetField('soli_ehefrau', this.value)"></div>
      <div class="form-group"><label class="form-label">Kirchensteuer Ehefrau (€)</label><input class="form-input mono" type="number" step="10" value="${s.kirchensteuer_ehefrau}" onblur="stSetField('kirchensteuer_ehefrau', this.value)"></div>
    </div>
    <div class="form-row">
    </div>

    ${stErgebnisHtml()}
  `;
}
