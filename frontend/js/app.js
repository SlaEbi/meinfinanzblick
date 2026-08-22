import { api } from './api.js?v=6';
import { DEMO } from './demo.js?v=1';

// ── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id === 'fintech' ? 'fintech' : '');
  localStorage.setItem('mfb-theme', id);
  if (state.view === 'dashboard') renderDashboard();
}

window.setTheme = applyTheme;

// ── Formatierung ────────────────────────────────────────────────────────────

const fmt = {
  // Zeigt Cent nur, wenn welche vorhanden sind ("43,49 €", aber "18.138 €" bleibt
  // glatt) — rundet also nie echte Cent-Beträge unsichtbar weg. Für Tabellen,
  // Summenzeilen und alles, wo ein Betrag exakt stimmen muss.
  eur: (v) => new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(v ?? 0),

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

function isFintech() {
  return document.documentElement.getAttribute('data-theme') === 'fintech';
}

// Liest eine CSS-Variable aus dem aktiven Theme
function cssVar(name, fallback) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

// Theme-abhängige Achsen-/Linienfarben
function chartTheme() {
  return {
    accent:  cssVar('--seal-red', '#8A1C15'),
    grey:    cssVar('--wash-grey', '#808080'),
    text:    cssVar('--ink-black', '#0D0D0D'),
    grid:    isFintech() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    font:    cssVar('--font-serif', 'sans-serif'),
  };
}

// Theme-abhängige Farbpaletten für Donut-/Schulden-Charts.
// Hue-divers statt monochrom — klare Unterscheidbarkeit in hell und dunkel.
const CHART_PALETTES = {
  // Sumi (hell): mittlere Sättigung, gut auf #F4F1E8
  default: {
    donut:    ['#2D6A9F', '#4A7F35', '#C17A1E'],
    schulden: ['#8A1C15', '#2D6A9F', '#4A7F35', '#C17A1E', '#7A5EA0', '#8A6040'],
  },
  // Fintech (dunkel): hellere, gesättigtere Varianten für #242424
  fintech: {
    donut:    ['#4DA8E0', '#6DC44E', '#F0A030'],
    schulden: ['#E04848', '#4DA8E0', '#6DC44E', '#F0A030', '#A880D8', '#C09060'],
  },
};
function palette() {
  return isFintech() ? CHART_PALETTES.fintech : CHART_PALETTES.default;
}
// Trenn-Farbe zwischen Segmenten (= Hintergrundsfarbe der Chart-Karte)
function segmentBorder() {
  return cssVar('--surface', '#FDFBF5');
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
  dokumente: [],
  todos: [],
  bugIdeen: [],
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
    el.classList.toggle('active', el.dataset.view === view);
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
    state.dokumente      = DEMO.dokumente;
    state.notfall        = DEMO.notfall;
    state.networth       = DEMO.networth;
    return;
  }
  const [konten, darlehen, depots, sachwerte, versicherungen, vertraege, kontakte, notfall, dokumente, networth, todos, bugIdeen] = await Promise.all([
    api.konten.list(),
    api.darlehen.list(),
    api.depots.list(),
    api.sachvermoegen.list(),
    api.versicherungen.list(),
    api.vertraege.list(),
    api.kontakte.list(),
    api.notfall.list(),
    api.dokumente.list(),
    api.networth.get(),
    api.todos.list(),
    api.bugIdeen.list(),
  ]);
  state.konten         = konten;
  state.darlehen       = darlehen;
  state.depots         = depots;
  state.sachwerte      = sachwerte;
  state.versicherungen = versicherungen;
  state.vertraege      = vertraege;
  state.kontakte       = kontakte;
  state.dokumente      = dokumente;
  state.notfall        = notfall;
  state.networth       = networth;
  state.todos          = todos;
  state.bugIdeen       = bugIdeen;
}

function renderCurrentView() {
  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'konten')    renderKonten();
  if (state.view === 'darlehen')  renderDarlehen();
  if (state.view === 'depots')    renderDepots();
  if (state.view === 'sachwerte')      renderSachwerte();
  if (state.view === 'spending')       renderSpending();
  if (state.view === 'versicherungen') renderVersicherungen();
  if (state.view === 'vertraege')      renderVertraege();
  if (state.view === 'dokumente')      renderDokumente();
  if (state.view === 'notfall')        renderNotfall();
  if (state.view === 'todos')          renderTodos();
  if (state.view === 'bug-ideen')      renderBugIdeen();
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
    ? `color:var(--seal-red);font-weight:500`
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
        backgroundColor: palette().donut,
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

  const SCHULDEN_COLORS = palette().schulden;
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
        backgroundColor: isFintech() ? 'rgba(201,168,76,0.08)' : 'rgba(138,28,21,0.06)',
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
            callback: (v) => '€' + (v / 1000).toFixed(0) + 'k',
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
        <span class="mono" style="font-size:0.75rem ${zinsbindungWarning ? ';color:var(--seal-red)' : ''}">
          ${d.zinsbindung_bis ? fmt.date(d.zinsbindung_bis) : '—'}
          ${zinsbindungWarning ? ' ⚠' : ''}
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
      const farbe = tage < 0 ? 'var(--seal-red)' : warn ? 'var(--seal-red)' : 'var(--wash-grey)';
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

function spStatusClass(pct, min, max) {
  if (pct <= max + 0.005) return 'status-ok';
  if (pct <= max + 0.05)  return 'status-warn';
  return 'status-over';
}

function spPctColor(pct, min, max) {
  if (pct >= min - 0.005 && pct <= max + 0.005) return 'var(--ink-black)';
  if (pct > max + 0.05 || pct < min - 0.05) return 'var(--seal-red)';
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
        <span id="sp-al-status-${key}" class="al-status ${spStatusClass(pct, conf.min, conf.max)}"></span>
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
        <div class="sp-group-head" title="Diese Beträge stammen aus Darlehen, Versicherungen und Verträgen und aktualisieren sich automatisch.">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0115-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 01-15 6.7L3 16"/></svg>
          Automatisch übernommen
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
          ${renderPositionen('fixkosten')}
        </div>
        <div class="sp-sonstiges-row">
          <span>Sonstiges-Puffer (<input id="sp-puffer-input"
            style="width:42px;font-family:var(--font-mono);color:var(--ink-black);border:none;border-bottom:1px solid var(--ink-wash);background:transparent;text-align:right"
            type="number" step="1" min="0" max="30"
            value="${Math.round((spPlan.sonstiges_puffer_pct ?? 0.05) * 100)}"
            onblur="spSavePlanField('sonstiges_puffer_pct', this.value/100)"
            oninput="spRecalc()"
            onkeydown="if(event.key==='Enter')this.blur()"> % auf Fixkosten)</span>
          <span id="sp-sonstiges-val" class="mono">${fmt.eur(sonstT)}</span>
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
            Ziel laut IWT: <strong>${IWT.gfs.label}</strong>
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
    const statusEl = document.getElementById(`sp-al-status-${key}`);
    const targetEl = document.getElementById(`sp-al-target-${key}`);
    if (pctEl) pctEl.style.color = spPctColor(pct, mn, mx);
    if (valEl) valEl.textContent = fmtPct(pct);
    if (statusEl) { statusEl.className = 'al-status ' + spStatusClass(pct, mn, mx); }
    if (targetEl) targetEl.textContent = IWT[key].label + ' · ' + fmt.eur(total);
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
  strom: 'Strom', gas: 'Gas', internet: 'Internet', handy: 'Handy',
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

// ── Dokumente ────────────────────────────────────────────────────────────────

const DOK_KAT_LABEL = {
  testament:           'Testament',
  vollmacht:           'Vollmacht',
  patientenverfuegung: 'Patientenverfügung',
  sorgerechtsverfuegung: 'Sorgerechtsverfügung',
  immobilien:          'Immobilien',
  rente:               'Rente / Pension',
  steuer:              'Steuer',
  versicherung:        'Versicherungspolice',
  sonstiges:           'Sonstiges',
};

function renderDokumente() {
  const docs = state.dokumente ?? [];
  const tbody = document.getElementById('dokumente-tbody');
  if (!tbody) return;
  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-row">Noch keine Dokumente erfasst</td></tr>`;
    return;
  }
  const fmtDate = s => s ? new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const today = new Date(); today.setHours(0,0,0,0);
  tbody.innerHTML = docs.map(d => {
    const katLabel = DOK_KAT_LABEL[d.kategorie] ?? d.kategorie;
    const abgelaufen = d.gueltig_bis && new Date(d.gueltig_bis) < today;
    const bald = d.gueltig_bis && !abgelaufen && (new Date(d.gueltig_bis) - today) / 86400000 <= 90;
    const gueltigCell = d.gueltig_bis
      ? `<span class="vs-laufzeit-cell${abgelaufen ? ' urgent' : bald ? ' soon' : ''}">${fmtDate(d.gueltig_bis)}${abgelaufen ? ' ⚠' : ''}</span>`
      : '<span style="color:var(--wash-grey)">unbefristet</span>';
    return `<tr>
      <td><span class="vs-art-badge vs-badge-${d.kategorie}">${escapeHtml(katLabel)}</span></td>
      <td><strong>${escapeHtml(d.titel)}</strong></td>
      <td>${d.aufbewahrungsort ? escapeHtml(d.aufbewahrungsort) : '<span style="color:var(--wash-grey)">—</span>'}</td>
      <td>${d.aussteller ? escapeHtml(d.aussteller) : '<span style="color:var(--wash-grey)">—</span>'}</td>
      <td class="mono" style="font-size:var(--text-xs)">${fmtDate(d.datum)}</td>
      <td>${gueltigCell}</td>
      <td class="right">
        <div class="action-cell">
          <button class="btn-icon" onclick="openDokumentForm(${d.id})" title="Bearbeiten">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-icon danger" onclick="deleteDokument(${d.id})" title="Löschen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

window.openDokumentForm = (id = null) => {
  state.editingId = id;
  const d = id ? state.dokumente.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = id ? 'Dokument bearbeiten' : 'Dokument hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Kategorie <span class="required">*</span></label>
        <select id="f-kategorie" class="form-input">
          ${Object.entries(DOK_KAT_LABEL).map(([v,l]) =>
            `<option value="${v}" ${d?.kategorie===v?'selected':''}>${l}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Titel <span class="required">*</span></label>
        <input id="f-titel" class="form-input" type="text" value="${d?.titel ?? ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Aufbewahrungsort</label>
        <input id="f-aufbew" class="form-input" type="text" value="${d?.aufbewahrungsort ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Aussteller</label>
        <input id="f-aussteller" class="form-input" type="text" value="${d?.aussteller ?? ''}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Datum des Dokuments</label>
        <input id="f-datum" class="form-input" type="date" value="${d?.datum ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Gültig bis</label>
        <input id="f-gueltig" class="form-input" type="date" value="${d?.gueltig_bis ?? ''}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <textarea id="f-notiz" class="form-input" rows="2">${d?.notiz ?? ''}</textarea>
    </div>
    <div class="form-section-head">Anhänge</div>
    ${anhangPlaceholderHtml('dokument', id)}
  `;
  document.getElementById('modal-submit').onclick = async () => {
    const data = {
      titel:            document.getElementById('f-titel').value.trim(),
      kategorie:        document.getElementById('f-kategorie').value,
      aufbewahrungsort: document.getElementById('f-aufbew').value.trim() || null,
      aussteller:       document.getElementById('f-aussteller').value.trim() || null,
      datum:            document.getElementById('f-datum').value || null,
      gueltig_bis:      document.getElementById('f-gueltig').value || null,
      notiz:            document.getElementById('f-notiz').value.trim() || null,
    };
    if (!data.titel) return toast('Titel ist Pflichtfeld.');
    try {
      if (id) {
        const upd = await api.dokumente.update(id, data);
        state.dokumente = state.dokumente.map(x => x.id === id ? upd : x);
        toast('Dokument aktualisiert.');
      } else {
        const neu = await api.dokumente.create(data);
        state.dokumente.push(neu);
        toast('Dokument gespeichert.');
      }
      closeModal();
      renderDokumente();
    } catch (e) { toast(e.message); }
  };
  openModal();
  if (id) loadAnhaenge('dokument', id);
};

window.deleteDokument = async (id) => {
  const titel = state.dokumente.find(x => x.id === id)?.titel ?? '';
  if (!confirm(`„${titel}" wirklich löschen?`)) return;
  try {
    await api.dokumente.delete(id);
    state.dokumente = state.dokumente.filter(x => x.id !== id);
    renderDokumente();
    toast('Dokument gelöscht.');
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
  const colors = {
    bank:'#4A5568', versicherung:'#6B7532', steuerberater:'#8A1C15',
    anwalt:'#805A28', notar:'#5A4A8A', arzt:'#2A7A5A', sonstiges:'#808080',
  };
  const bg = colors[rolle] ?? '#808080';
  return `<span class="nf-rolle-badge" style="background:${bg}20;color:${bg};border:1px solid ${bg}40">${NF_ROLLE_LABEL[rolle] ?? rolle}</span>`;
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
      : '<th>Titel</th><th>Wo liegt es / Verweis</th><th>Hinweis</th><th class="right">Aktionen</th>';

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


// ── Bugs & Ideen ─────────────────────────────────────────────────────────────

const BI_TYP_LABEL  = { bug: 'Bug', idee: 'Idee', verbesserung: 'Verbesserung' };
const BI_TYP_COLOR  = { bug: 'var(--seal-red)', idee: '#4A90D9', verbesserung: '#5C9E6A' };
const BI_STATUS_LABEL = { offen: 'Offen', in_arbeit: 'In Arbeit', erledigt: 'Erledigt' };
const BI_PRIO_LABEL = { hoch: 'Hoch', mittel: 'Mittel', niedrig: 'Niedrig' };

function renderBugIdeen() {
  const items = state.bugIdeen ?? [];
  const host = document.getElementById('bug-ideen-container');
  if (!host) return;

  if (!items.length) {
    host.innerHTML = '<p class="empty-state">Noch keine Einträge vorhanden.</p>';
    return;
  }

  const byStatus = { offen: [], in_arbeit: [], erledigt: [] };
  for (const item of items) {
    const s = item.status ?? 'offen';
    (byStatus[s] ?? byStatus.offen).push(item);
  }

  const renderItem = (item) => `
    <div class="bi-item status-${item.status}">
      <div class="bi-badges">
        <span class="badge" style="color:${BI_TYP_COLOR[item.typ]};border-color:currentColor;font-weight:600">${BI_TYP_LABEL[item.typ] ?? item.typ}</span>
        ${ampelBadge(item.prioritaet)}
      </div>
      <div class="bi-body">
        <span class="bi-titel">${escapeHtml(item.titel)}</span>
        ${item.beschreibung ? `<span class="bi-desc">${escapeHtml(item.beschreibung)}</span>` : ''}
      </div>
      <div class="bi-status-select">
        <select class="form-input form-input-sm" onchange="updateBiStatus(${item.id}, this.value)">
          ${Object.entries(BI_STATUS_LABEL).map(([k,l]) => `<option value="${k}"${item.status===k?' selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="todo-actions">
        <button class="btn-icon" onclick="openBugIdeeForm(${item.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteBugIdee(${item.id})" title="Löschen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>
      </div>
    </div>`;

  const section = (status, list) => list.length ? `
    <div class="card bi-card">
      <div class="todo-section-head${status === 'erledigt' ? ' muted' : ''}">${BI_STATUS_LABEL[status]} (${list.length})</div>
      ${list.map(renderItem).join('')}
    </div>` : '';

  host.innerHTML = [
    section('offen',    byStatus.offen),
    section('in_arbeit', byStatus.in_arbeit),
    section('erledigt', byStatus.erledigt),
  ].join('<div style="margin-top:var(--space-6)"></div>');
}

window.updateBiStatus = async function(id, status) {
  try {
    const upd = await api.bugIdeen.update(id, { status });
    state.bugIdeen = state.bugIdeen.map(x => x.id === id ? upd : x);
    renderBugIdeen();
  } catch (e) { toast(e.message); }
};

window.openBugIdeeForm = function(id = null) {
  state.editingId = id;
  const item = id ? state.bugIdeen.find(x => x.id === id) : null;
  document.getElementById('modal-title').textContent = id ? 'Eintrag bearbeiten' : 'Eintrag hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Typ <span class="required">*</span></label>
        <select id="f-typ" class="form-input">
          ${Object.entries(BI_TYP_LABEL).map(([k,l]) => `<option value="${k}"${item?.typ===k?' selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Priorität</label>
        <select id="f-prio" class="form-input">
          ${Object.entries(BI_PRIO_LABEL).map(([k,l]) => `<option value="${k}"${item?.prioritaet===k?' selected':''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Titel <span class="required">*</span></label>
      <input id="f-titel" class="form-input" value="${escapeHtml(item?.titel ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Beschreibung</label>
      <textarea id="f-beschreibung" class="form-input" rows="4" style="resize:vertical">${escapeHtml(item?.beschreibung ?? '')}</textarea>
    </div>`;
  document.getElementById('modal-submit').onclick = submitBugIdeeForm;
  openModal();
};

async function submitBugIdeeForm() {
  const data = {
    typ:          document.getElementById('f-typ').value,
    prioritaet:   document.getElementById('f-prio').value,
    titel:        document.getElementById('f-titel').value.trim(),
    beschreibung: document.getElementById('f-beschreibung').value.trim() || null,
  };
  if (!data.titel) return toast('Bitte Titel ausfüllen.');
  try {
    if (state.editingId) {
      const upd = await api.bugIdeen.update(state.editingId, data);
      state.bugIdeen = state.bugIdeen.map(x => x.id === state.editingId ? upd : x);
      toast('Eintrag aktualisiert.');
    } else {
      const neu = await api.bugIdeen.create(data);
      state.bugIdeen.unshift(neu);
      toast('Eintrag gespeichert.');
    }
    closeModal();
    renderBugIdeen();
  } catch (e) { toast(e.message); }
}

window.deleteBugIdee = async function(id) {
  const name = state.bugIdeen.find(x => x.id === id)?.titel ?? '';
  if (!confirm(`„${name}" wirklich löschen?`)) return;
  try {
    await api.bugIdeen.delete(id);
    state.bugIdeen = state.bugIdeen.filter(x => x.id !== id);
    renderBugIdeen();
    toast('Eintrag gelöscht.');
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

  // Theme aus localStorage wiederherstellen
  applyTheme(localStorage.getItem('mfb-theme') ?? 'fintech');

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
