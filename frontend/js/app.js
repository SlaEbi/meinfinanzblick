import { api } from './api.js?v=2';

// ── Theme ────────────────────────────────────────────────────────────────────

function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id === 'fintech' ? 'fintech' : '');
  localStorage.setItem('mfb-theme', id);
  if (state.view === 'dashboard') renderDashboard();
}

window.setTheme = applyTheme;

// ── Formatierung ────────────────────────────────────────────────────────────

const fmt = {
  eur: (v) => new Intl.NumberFormat('de-DE', {
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

// ── State ───────────────────────────────────────────────────────────────────

const state = {
  view: 'dashboard',
  konten: [],
  darlehen: [],
  depots: [],
  sachwerte: [],
  versicherungen: [],
  vertraege: [],
  kontakte: [],
  notfall: [],
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
  const [konten, darlehen, depots, sachwerte, versicherungen, vertraege, kontakte, notfall, networth] = await Promise.all([
    api.konten.list(),
    api.darlehen.list(),
    api.depots.list(),
    api.sachvermoegen.list(),
    api.versicherungen.list(),
    api.vertraege.list(),
    api.kontakte.list(),
    api.notfall.list(),
    api.networth.get(),
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
}

function renderCurrentView() {
  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'konten')    renderKonten();
  if (state.view === 'darlehen')  renderDarlehen();
  if (state.view === 'depots')    renderDepots();
  if (state.view === 'sachwerte')      renderSachwerte();
  if (state.view === 'spending')       renderSpending();
  if (state.view === 'versicherungen') renderVersicherungen();
  if (state.view === 'notfall')        renderNotfall();
}

// ── Dashboard ───────────────────────────────────────────────────────────────

function renderDashboard() {
  const nw = state.networth?.aktuell ?? {};
  const netto = nw.netto ?? 0;

  // Hero
  document.getElementById('nw-netto').textContent          = fmt.eur(netto);
  document.getElementById('nw-konten').textContent         = fmt.eur(nw.summe_konten ?? 0);
  document.getElementById('nw-depots').textContent         = fmt.eur(nw.summe_depots ?? 0);
  document.getElementById('nw-sachvermoegen').textContent  = fmt.eur(nw.summe_sachvermoegen ?? 0);
  document.getElementById('nw-schulden').textContent       = fmt.eur(nw.summe_schulden ?? 0);

  // Netto-Klasse
  const heroEl = document.getElementById('nw-netto');
  heroEl.className = 'card-value hero mono ' + (netto >= 0 ? '' : 'negative');

  // Charts zeichnen
  renderDonutChart();
  renderSchuldenChart();
  renderVerlaufChart();

  // Quick-Listen
  renderDashboardKonten();
  renderDashboardDarlehen();
}

function renderDonutChart() {
  const nw = state.networth?.aktuell ?? {};
  const data = [
    nw.summe_konten ?? 0,
    nw.summe_depots ?? 0,
    nw.summe_sachvermoegen ?? 0,
  ];

  const ctx = document.getElementById('chart-donut')?.getContext('2d');
  if (!ctx) return;

  if (state.charts.donut) state.charts.donut.destroy();

  state.charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Konten', 'Depots', 'Sachwerte'],
      datasets: [{
        data,
        backgroundColor: ['#8A1C15', '#4A5568', '#6B7532'],
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            color: '#808080',
            padding: 16,
            usePointStyle: true,
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

function renderSchuldenChart() {
  const ctx = document.getElementById('chart-schulden')?.getContext('2d');
  if (!ctx) return;

  if (state.charts.schulden) state.charts.schulden.destroy();

  const darlehen = state.darlehen ?? [];

  if (!darlehen.length) {
    ctx.canvas.parentElement.innerHTML = '<div class="chart-empty">Keine Darlehen erfasst</div>';
    return;
  }

  const SCHULDEN_COLORS = ['#8A1C15', '#A83428', '#C4523C', '#D97A60', '#E8A080', '#F0C0A0'];
  const labels = darlehen.map(d => d.bezeichnung);
  const data   = darlehen.map(d => Number(d.restschuld ?? 0));
  const colors = darlehen.map((_, i) => SCHULDEN_COLORS[i % SCHULDEN_COLORS.length]);

  state.charts.schulden = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 0,
        hoverOffset: 6,
      }],
    },
    options: {
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            color: '#808080',
            padding: 12,
            usePointStyle: true,
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

function renderVerlaufChart() {
  const verlauf = state.networth?.verlauf ?? [];
  const ctx = document.getElementById('chart-verlauf')?.getContext('2d');
  if (!ctx) return;

  if (state.charts.verlauf) state.charts.verlauf.destroy();

  if (verlauf.length === 0) {
    ctx.canvas.parentElement.innerHTML =
      '<p class="text-muted" style="text-align:center;padding:4rem 0;font-size:0.85rem">Noch keine Verlaufsdaten. Erstelle den ersten Snapshot.</p>';
    return;
  }

  state.charts.verlauf = new Chart(ctx, {
    type: 'line',
    data: {
      labels: verlauf.map(s => new Date(s.datum).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })),
      datasets: [{
        label: 'Nettovermögen',
        data: verlauf.map(s => s.netto),
        borderColor: '#8A1C15',
        backgroundColor: 'rgba(138,28,21,0.06)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#8A1C15',
      }],
    },
    options: {
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
            color: '#808080',
            callback: (v) => '€' + (v / 1000).toFixed(0) + 'k',
          },
          grid: { color: 'rgba(0,0,0,0.04)' },
          border: { dash: [4, 4] },
        },
        x: {
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            color: '#808080',
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
  el.innerHTML = state.darlehen.slice(0, 5).map(d => `
    <tr>
      <td>${d.bezeichnung}<br><span class="text-muted" style="font-size:0.75rem">${d.glaeubiger}</span></td>
      <td class="mono">${fmt.pct(d.zinssatz * 100)}</td>
      <td class="right mono text-red">${fmt.eur(d.restschuld)}</td>
    </tr>
  `).join('');
}

// ── Konten View ─────────────────────────────────────────────────────────────

function renderKonten() {
  const tbody = document.getElementById('konten-tbody');
  if (!tbody) return;

  if (!state.konten.length) {
    tbody.innerHTML = `<tr><td colspan="6">
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
      <td><strong>${k.name}</strong></td>
      <td>${k.bank}</td>
      <td><span class="badge badge-${k.typ}">${k.typ}</span></td>
      <td class="mono">${k.iban ? maskIBAN(k.iban) : '—'}</td>
      <td class="right mono ${k.saldo >= 0 ? '' : 'text-red'}">${fmt.eur(k.saldo)}</td>
      <td class="right"><div class="action-cell">
        <button class="btn-icon" onclick="openKontoForm(${k.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteKonto(${k.id}, '${escapeHtml(k.name)}')" title="Löschen">
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
    <div class="form-group">
      <label class="form-label">Name <span class="required">*</span></label>
      <input id="f-name" class="form-input" placeholder="z. B. Girokonto DKB" value="${escapeHtml(konto?.name ?? '')}" required>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Bank <span class="required">*</span></label>
        <input id="f-bank" class="form-input" placeholder="DKB, ING, Sparkasse…" value="${escapeHtml(konto?.bank ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Kontotyp <span class="required">*</span></label>
        <select id="f-typ" class="form-select">
          ${['giro','tagesgeld','festgeld','sparkonto','sonstige'].map(t =>
            `<option value="${t}" ${konto?.typ === t ? 'selected' : ''}>${t}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">IBAN</label>
      <input id="f-iban" class="form-input mono" placeholder="DE12 3456 7890 1234 5678 90" value="${escapeHtml(konto?.iban ?? '')}">
      <p class="form-hint">Wird maskiert angezeigt (nur zur Identifikation)</p>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Saldo (€) <span class="required">*</span></label>
        <input id="f-saldo" class="form-input" type="number" step="0.01" value="${konto?.saldo ?? 0}">
      </div>
      <div class="form-group">
        <label class="form-label">Währung</label>
        <select id="f-waehrung" class="form-select">
          ${['EUR','USD','CHF','GBP'].map(w =>
            `<option value="${w}" ${(konto?.waehrung ?? 'EUR') === w ? 'selected' : ''}>${w}</option>`
          ).join('')}
        </select>
      </div>
    </div>
  `;
  document.getElementById('modal-submit').onclick = submitKontoForm;
  openModal();
};

async function submitKontoForm() {
  const data = {
    name:     document.getElementById('f-name').value.trim(),
    bank:     document.getElementById('f-bank').value.trim(),
    typ:      document.getElementById('f-typ').value,
    iban:     document.getElementById('f-iban').value.trim() || null,
    saldo:    parseFloat(document.getElementById('f-saldo').value) || 0,
    waehrung: document.getElementById('f-waehrung').value,
  };
  if (!data.name || !data.bank) return toast('Bitte Name und Bank ausfüllen.');
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

window.deleteKonto = async function(id, name) {
  if (!confirm(`Konto „${name}" wirklich löschen?`)) return;
  try {
    await api.konten.delete(id);
    toast('Konto gelöscht.');
    await refresh();
  } catch (e) { toast(e.message); }
};

// ── Darlehen View ────────────────────────────────────────────────────────────

function renderDarlehen() {
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
    return `
    <tr>
      <td>
        <strong>${d.bezeichnung}</strong><br>
        <span class="text-muted" style="font-size:0.75rem">${d.glaeubiger}</span>
      </td>
      <td class="mono text-red">${fmt.eur(d.restschuld)}</td>
      <td class="mono">${fmt.pct(d.zinssatz * 100)}</td>
      <td class="mono">${fmt.eur(d.rate_monatlich)} / Mon.</td>
      <td>
        <span class="mono" style="font-size:0.75rem ${zinsbindungWarning ? ';color:var(--seal-red)' : ''}">
          ${d.zinsbindung_bis ? fmt.date(d.zinsbindung_bis) : '—'}
          ${zinsbindungWarning ? ' ⚠' : ''}
        </span>
      </td>
      <td class="right"><div class="action-cell">
        <button class="btn-icon" onclick="openDarlehenForm(${d.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteDarlehen(${d.id}, '${escapeHtml(d.bezeichnung)}')" title="Löschen">
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

window.openDarlehenForm = function(id = null) {
  state.editingId = id;
  const d = id ? state.darlehen.find(x => x.id === id) : null;

  document.getElementById('modal-title').textContent = id ? 'Darlehen bearbeiten' : 'Darlehen hinzufügen';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Bezeichnung <span class="required">*</span></label>
        <input id="f-bez" class="form-input" placeholder="Immobiliendarlehen" value="${escapeHtml(d?.bezeichnung ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Gläubiger <span class="required">*</span></label>
        <input id="f-glaeubiger" class="form-input" placeholder="Deutsche Bank" value="${escapeHtml(d?.glaeubiger ?? '')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Ursprungsbetrag (€) <span class="required">*</span></label>
        <input id="f-urspr" class="form-input" type="number" step="0.01" value="${d?.urspr_betrag ?? 0}">
      </div>
      <div class="form-group">
        <label class="form-label">Restschuld (€) <span class="required">*</span></label>
        <input id="f-restschuld" class="form-input" type="number" step="0.01" value="${d?.restschuld ?? 0}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Zinssatz (%) <span class="required">*</span></label>
        <input id="f-zinssatz" class="form-input" type="number" step="0.001" placeholder="3.50" value="${d ? (d.zinssatz * 100).toFixed(3) : ''}">
        <p class="form-hint">z. B. 3.5 für 3,50 %</p>
      </div>
      <div class="form-group">
        <label class="form-label">Monatliche Rate (€) <span class="required">*</span></label>
        <input id="f-rate" class="form-input" type="number" step="0.01" value="${d?.rate_monatlich ?? 0}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Zinsbindung bis</label>
        <input id="f-zinsbindung" class="form-input" type="date" value="${fmt.dateISO(d?.zinsbindung_bis)}">
      </div>
      <div class="form-group">
        <label class="form-label">Restlaufzeit (Monate)</label>
        <input id="f-restlaufzeit" class="form-input" type="number" value="${d?.restlaufzeit ?? ''}">
      </div>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
        <input id="f-sonder" type="checkbox" ${d?.sondertilgung_moeglich ? 'checked' : ''}>
        Sondertilgung möglich
      </label>
    </div>
  `;
  document.getElementById('modal-submit').onclick = submitDarlehenForm;
  openModal();
};

async function submitDarlehenForm() {
  const zinssatzInput = parseFloat(document.getElementById('f-zinssatz').value);
  const data = {
    bezeichnung:            document.getElementById('f-bez').value.trim(),
    glaeubiger:             document.getElementById('f-glaeubiger').value.trim(),
    urspr_betrag:           parseFloat(document.getElementById('f-urspr').value) || 0,
    restschuld:             parseFloat(document.getElementById('f-restschuld').value) || 0,
    zinssatz:               zinssatzInput / 100,
    rate_monatlich:         parseFloat(document.getElementById('f-rate').value) || 0,
    zinsbindung_bis:        document.getElementById('f-zinsbindung').value || null,
    restlaufzeit:           parseInt(document.getElementById('f-restlaufzeit').value) || null,
    sondertilgung_moeglich: document.getElementById('f-sonder').checked,
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

window.deleteDarlehen = async function(id, name) {
  if (!confirm(`Darlehen „${name}" wirklich löschen?`)) return;
  try {
    await api.darlehen.delete(id);
    toast('Darlehen gelöscht.');
    await refresh();
  } catch (e) { toast(e.message); }
};

// ── Depots View ─────────────────────────────────────────────────────────────

function renderDepots() {
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
      <td><strong>${dep.name}</strong></td>
      <td>${dep.bank}</td>
      <td class="mono text-muted" style="font-size:0.8rem">${dep.depotnummer ?? '—'}</td>
      <td class="right mono">${fmt.eur(dep.wert_aktuell)}</td>
      <td class="right"><div class="action-cell">
        <button class="btn-icon" onclick="openDepotForm(${dep.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteDepot(${dep.id}, '${escapeHtml(dep.name)}')" title="Löschen">
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
    <div class="form-group">
      <label class="form-label">Name <span class="required">*</span></label>
      <input id="f-name" class="form-input" placeholder="ETF-Depot" value="${escapeHtml(dep?.name ?? '')}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Bank / Broker <span class="required">*</span></label>
        <input id="f-bank" class="form-input" placeholder="comdirect, ING…" value="${escapeHtml(dep?.bank ?? '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Depotnummer</label>
        <input id="f-depotnr" class="form-input mono" placeholder="123456789" value="${escapeHtml(dep?.depotnummer ?? '')}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Aktueller Gesamtwert (€) <span class="required">*</span></label>
      <input id="f-wert" class="form-input" type="number" step="0.01" value="${dep?.wert_aktuell ?? 0}">
      <p class="form-hint">Summe aller Positionen zum heutigen Kurs</p>
    </div>
  `;
  document.getElementById('modal-submit').onclick = submitDepotForm;
  openModal();
};

async function submitDepotForm() {
  const data = {
    name:        document.getElementById('f-name').value.trim(),
    bank:        document.getElementById('f-bank').value.trim(),
    depotnummer: document.getElementById('f-depotnr').value.trim() || null,
    wert_aktuell: parseFloat(document.getElementById('f-wert').value) || 0,
  };
  if (!data.name || !data.bank) return toast('Bitte Name und Bank ausfüllen.');
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

window.deleteDepot = async function(id, name) {
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
    return `
    <tr>
      <td><strong>${s.bezeichnung}</strong></td>
      <td><span class="badge badge-${s.kategorie}">${katLabel}</span></td>
      <td class="text-muted" style="font-size:0.8rem">${s.beschreibung ?? '—'}</td>
      <td class="mono" style="font-size:0.8rem">
        ${s.anschaffungsjahr ?? '—'}
        ${s.anschaffungswert ? `<br><span class="text-muted">${fmt.eur(s.anschaffungswert)}</span>` : ''}
        ${wertEntwicklung !== null ? `<br><span class="${parseFloat(wertEntwicklung) >= 0 ? 'text-green' : 'text-red'}" style="font-size:0.7rem">${wertEntwicklung >= 0 ? '+' : ''}${wertEntwicklung} %</span>` : ''}
      </td>
      <td class="right mono">${fmt.eur(s.aktueller_wert)}</td>
      <td class="right"><div class="action-cell">
        <button class="btn-icon" onclick="openSachwertForm(${s.id})" title="Bearbeiten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon danger" onclick="deleteSachwert(${s.id}, '${escapeHtml(s.bezeichnung)}')" title="Löschen">
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
      <input id="f-bez" class="form-input" placeholder="z. B. Eigenheim München, VW Golf" value="${escapeHtml(s?.bezeichnung ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Kategorie <span class="required">*</span></label>
      <select id="f-kat" class="form-select">
        ${SACHWERT_KATEGORIEN.map(k =>
          `<option value="${k.value}" ${s?.kategorie === k.value ? 'selected' : ''}>${k.label}</option>`
        ).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Beschreibung</label>
      <input id="f-desc" class="form-input" placeholder="Kurze Beschreibung (optional)" value="${escapeHtml(s?.beschreibung ?? '')}">
    </div>
    <div class="form-group">
      <label class="form-label">Aktueller Schätzwert (€) <span class="required">*</span></label>
      <input id="f-wert" class="form-input" type="number" step="0.01" value="${s?.aktueller_wert ?? 0}">
      <p class="form-hint">Aktueller Marktwert / Zeitwert</p>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Anschaffungswert (€)</label>
        <input id="f-anschaffwert" class="form-input" type="number" step="0.01" placeholder="0" value="${s?.anschaffungswert ?? ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Anschaffungsjahr</label>
        <input id="f-jahr" class="form-input" type="number" placeholder="2018" min="1900" max="2100" value="${s?.anschaffungsjahr ?? ''}">
      </div>
    </div>
  `;
  document.getElementById('modal-submit').onclick = submitSachwertForm;
  openModal();
};

async function submitSachwertForm() {
  const anschaffwert = document.getElementById('f-anschaffwert').value;
  const jahr = document.getElementById('f-jahr').value;
  const data = {
    bezeichnung:       document.getElementById('f-bez').value.trim(),
    kategorie:         document.getElementById('f-kat').value,
    beschreibung:      document.getElementById('f-desc').value.trim() || null,
    aktueller_wert:    parseFloat(document.getElementById('f-wert').value) || 0,
    anschaffungswert:  anschaffwert ? parseFloat(anschaffwert) : null,
    anschaffungsjahr:  jahr ? parseInt(jahr) : null,
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

window.deleteSachwert = async function(id, name) {
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

function spKatSumme(kat) {
  return spGetPositionen(kat).reduce((s, p) => s + (p.betrag || 0), 0);
}

function spSonstiges() {
  const sub = spKatSumme('fixkosten');
  return sub * (spPlan?.sonstiges_puffer_pct ?? 0.05);
}

function spFixTotal()  { return spKatSumme('fixkosten') + spSonstiges(); }
function spInvTotal()  { return spKatSumme('investments'); }
function spSparTotal() { return spKatSumme('sparziele'); }
function spGFS()       {
  const n = spPlan?.netto_monatlich ?? 0;
  return Math.max(0, n - spFixTotal() - spInvTotal() - spSparTotal());
}

function spPct(val) {
  const n = spPlan?.netto_monatlich ?? 1;
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

  const netto    = spPlan.netto_monatlich;
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

  el.innerHTML = `
    <div class="page-header">
      <div style="flex:1">
        <input class="sp-plan-name" value="${escapeHtml(spPlan.name)}"
          onblur="spSavePlanField('name', this.value)"
          onkeydown="if(event.key==='Enter')this.blur()">
        <p style="font-size:var(--text-sm);color:var(--wash-grey);margin-top:0.25rem">
          Stand: ${spPlan.stand ? new Date(spPlan.stand).toLocaleDateString('de-DE') : '—'}
          · IWT Conscious Spending Plan
        </p>
      </div>
      <button class="btn btn-ghost" onclick="spCreateNew()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M12 5v14M5 12h14"/></svg>
        Neuer Plan
      </button>
    </div>

    <!-- Einkommens-Leiste -->
    <div class="sp-income-bar">
      <div class="sp-income-field">
        <label>Brutto / Monat</label>
        <input class="sp-income-input" type="number" step="50"
          value="${spPlan.brutto_monatlich}"
          onblur="spSavePlanField('brutto_monatlich', +this.value)"
          onkeydown="if(event.key==='Enter')this.blur()"> €
      </div>
      <div class="sp-income-field">
        <label>Netto / Monat</label>
        <input class="sp-income-input" id="sp-netto-input" type="number" step="50"
          value="${spPlan.netto_monatlich}"
          onblur="spSavePlanField('netto_monatlich', +this.value)"
          oninput="spRecalc()"
          onkeydown="if(event.key==='Enter')this.blur()"> €
      </div>
      <div class="sp-puffer-label">
        Sonstiges-Puffer:
        <input id="sp-puffer-input" style="width:45px;font-family:var(--font-mono);border:none;border-bottom:1px solid var(--ink-wash);background:transparent;text-align:right"
          type="number" step="1" min="0" max="30"
          value="${Math.round((spPlan.sonstiges_puffer_pct ?? 0.05) * 100)}"
          onblur="spSavePlanField('sonstiges_puffer_pct', this.value/100)"
          oninput="spRecalc()"
          onkeydown="if(event.key==='Enter')this.blur()"> %
        auf Fixkosten
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
          ${renderPositionen('fixkosten')}
        </div>
        <div class="sp-sonstiges-row">
          <span>Sonstiges-Puffer (${Math.round((spPlan.sonstiges_puffer_pct??0.05)*100)} %)</span>
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

  // Werte aus dem DOM lesen (bei laufender Eingabe)
  const nettoInput = document.getElementById('sp-netto-input');
  if (nettoInput) spPlan.netto_monatlich = parseFloat(nettoInput.value) || spPlan.netto_monatlich;

  // Beträge aus amount-Inputs in spPlan.positionen spiegeln
  document.querySelectorAll('.sp-position[data-pos-id]').forEach(row => {
    const posId = parseInt(row.dataset.posId);
    const amtInput = row.querySelector('.sp-pos-amount');
    if (!amtInput) return;
    const pos = spPlan.positionen.find(p => p.id === posId);
    if (pos) pos.betrag = parseFloat(amtInput.value) || 0;
  });

  const puffInput = document.getElementById('sp-puffer-input');
  if (puffInput) spPlan.sonstiges_puffer_pct = parseFloat(puffInput.value) / 100 || 0.05;

  const n = spPlan.netto_monatlich || 1;
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
  if (!spPlan || !value.trim()) return;
  try {
    await api.spending.updatePosition(spPlan.id, posId, { bezeichnung: value.trim() });
    const pos = spPlan.positionen.find(p => p.id === posId);
    if (pos) pos.bezeichnung = value.trim();
  } catch (e) { toast(e.message); }
}

async function spSavePosAmount(posId, value) {
  if (!spPlan) return;
  const betrag = parseFloat(value) || 0;
  try {
    await api.spending.updatePosition(spPlan.id, posId, { betrag });
    const pos = spPlan.positionen.find(p => p.id === posId);
    if (pos) pos.betrag = betrag;
  } catch (e) { toast(e.message); }
}

window.spAddPos = async function(kat) {
  if (!spPlan) return;
  const maxOrder = Math.max(0, ...spGetPositionen(kat).map(p => p.sort_order));
  try {
    const pos = await api.spending.addPosition(spPlan.id, {
      kategorie: kat, bezeichnung: 'Neue Position', betrag: 0, sort_order: maxOrder + 1,
    });
    spPlan.positionen.push(pos);
    await renderSpendinPlan();
    // Fokus auf neue Zeile
    const rows = document.querySelectorAll(`#sp-${kat==='fixkosten'?'fix':kat==='investments'?'inv':'spar'}-list .sp-pos-name`);
    if (rows.length) rows[rows.length - 1].focus();
  } catch (e) { toast(e.message); }
};

window.spDeletePos = async function(posId) {
  if (!spPlan) return;
  try {
    await api.spending.deletePosition(spPlan.id, posId);
    spPlan.positionen = spPlan.positionen.filter(p => p.id !== posId);
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
        <input id="f-brutto" class="form-input" type="number" step="50" placeholder="10000">
      </div>
      <div class="form-group">
        <label class="form-label">Netto / Monat (€) <span class="required">*</span></label>
        <input id="f-netto" class="form-input" type="number" step="50" placeholder="7500">
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

function renderFristenBanner(items) {
  const urgent = [];
  for (const item of items) {
    const days = vsDaysTillKuendigung(item);
    if (days !== null && days <= 90) {
      urgent.push({ ...item, _days: days });
    }
  }
  urgent.sort((a, b) => a._days - b._days);
  const banner = document.getElementById('vs-fristen-banner');
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
  const vs  = state.versicherungen ?? [];
  const vt  = state.vertraege ?? [];

  // Fristen-Banner (alle zusammen prüfen)
  renderFristenBanner([...vs, ...vt]);

  // Jahressummen
  const sumVs = vs.reduce((s, v) => s + vsJahresbeitrag(v, 'beitrag'), 0);
  const sumVt = vt.reduce((s, v) => s + vsJahresbeitrag(v, 'kosten'), 0);
  const el = id => document.getElementById(id);
  if (el('vs-sum-versicherungen')) el('vs-sum-versicherungen').textContent = fmt.eur(sumVs);
  if (el('vs-sum-vertraege'))      el('vs-sum-vertraege').textContent      = fmt.eur(sumVt);
  if (el('vs-sum-gesamt'))         el('vs-sum-gesamt').textContent         = fmt.eur(sumVs + sumVt);

  // Versicherungen-Tabelle
  const vstb = document.getElementById('versicherungen-tbody');
  if (vstb) {
    if (!vs.length) {
      vstb.innerHTML = `<tr><td colspan="8" class="empty-row">Noch keine Versicherungen erfasst</td></tr>`;
    } else {
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
              <button class="btn-icon danger" onclick="deleteVersicherung(${v.id},'${escapeHtml(v.bezeichnung)}')" title="Löschen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  }

  // Verträge-Tabelle
  const vttb = document.getElementById('vertraege-tbody');
  if (vttb) {
    if (!vt.length) {
      vttb.innerHTML = `<tr><td colspan="8" class="empty-row">Noch keine Verträge erfasst</td></tr>`;
    } else {
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
              <button class="btn-icon danger" onclick="deleteVertrag(${v.id},'${escapeHtml(v.bezeichnung)}')" title="Löschen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
      }).join('');
    }
  }
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
        <input id="f-bez" class="form-input" placeholder="z. B. Private Haftpflicht" value="${escapeHtml(v?.bezeichnung??'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Anbieter <span class="required">*</span></label>
        <input id="f-anbieter" class="form-input" placeholder="z. B. Allianz" value="${escapeHtml(v?.anbieter??'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Vertragsnummer</label>
        <input id="f-vnr" class="form-input mono" placeholder="123456789" value="${escapeHtml(v?.vertragsnummer??'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Beitrag (€) <span class="required">*</span></label>
        <input id="f-beitrag" class="form-input" type="number" step="1" placeholder="0" value="${v?.beitrag??''}">
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
        <input id="f-frist" class="form-input" type="number" step="1" placeholder="0" value="${v?.kuendigungsfrist_tage??0}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Kontakt Telefon</label>
        <input id="f-tel" class="form-input" placeholder="+49 800 …" value="${escapeHtml(v?.kontakt_telefon??'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Kontakt E-Mail</label>
        <input id="f-email" class="form-input" placeholder="service@…" value="${escapeHtml(v?.kontakt_email??'')}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <input id="f-notiz" class="form-input" placeholder="Freitext" value="${escapeHtml(v?.notiz??'')}">
    </div>
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
};

window.deleteVersicherung = async function(id, name) {
  if (!confirm(`"${name}" wirklich löschen?`)) return;
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
        <input id="f-bez" class="form-input" placeholder="z. B. Strom Wohnung" value="${escapeHtml(v?.bezeichnung??'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Anbieter <span class="required">*</span></label>
        <input id="f-anbieter" class="form-input" placeholder="z. B. E.ON" value="${escapeHtml(v?.anbieter??'')}">
      </div>
      <div class="form-group">
        <label class="form-label">Vertragsnummer</label>
        <input id="f-vnr" class="form-input mono" value="${escapeHtml(v?.vertragsnummer??'')}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Kosten (€) <span class="required">*</span></label>
        <input id="f-kosten" class="form-input" type="number" step="1" placeholder="0" value="${v?.kosten??''}">
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
        <input id="f-frist" class="form-input" type="number" step="1" placeholder="0" value="${v?.kuendigungsfrist_tage??0}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Notiz</label>
      <input id="f-notiz" class="form-input" value="${escapeHtml(v?.notiz??'')}">
    </div>
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
      renderVersicherungen();
    } catch (e) { toast(e.message); }
  };
  openModal();
};

window.deleteVertrag = async function(id, name) {
  if (!confirm(`"${name}" wirklich löschen?`)) return;
  try {
    await api.vertraege.delete(id);
    state.vertraege = state.vertraege.filter(x => x.id !== id);
    renderVersicherungen();
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
          <button class="btn-icon danger" onclick="deleteKontakt(${k.id},'${name}')" title="Löschen">
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
            <button class="btn-icon danger" onclick="deleteNotfallEintrag(${e.id},'${titel}')" title="Löschen">
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
          <button class="btn-icon danger" onclick="deleteNotfallEintrag(${e.id},'${titel}')" title="Löschen">
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
    <div class="form-row two-col">
      <div class="form-group">
        <label>Name*</label>
        <input id="f-name" type="text" value="${k?.name ?? ''}" placeholder="Max Mustermann">
      </div>
      <div class="form-group">
        <label>Rolle*</label>
        <select id="f-rolle">
          ${Object.entries(NF_ROLLE_LABEL).map(([v,l]) =>
            `<option value="${v}" ${k?.rolle===v?'selected':''}>${l}</option>`
          ).join('')}
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Firma / Institut</label>
      <input id="f-firma" type="text" value="${k?.firma ?? ''}" placeholder="z.B. Kanzlei Müller">
    </div>
    <div class="form-row two-col">
      <div class="form-group">
        <label>Telefon</label>
        <input id="f-telefon" type="text" value="${k?.telefon ?? ''}" placeholder="+49 ...">
      </div>
      <div class="form-group">
        <label>E-Mail</label>
        <input id="f-email" type="email" value="${k?.email ?? ''}" placeholder="name@example.de">
      </div>
    </div>
    <div class="form-group">
      <label>Adresse</label>
      <input id="f-adresse" type="text" value="${k?.adresse ?? ''}" placeholder="Musterstraße 1, 12345 Stadt">
    </div>
    <div class="form-group">
      <label>Notiz</label>
      <textarea id="f-notiz" rows="2" placeholder="Zusätzliche Infos...">${k?.notiz ?? ''}</textarea>
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

window.deleteKontakt = async (id, name) => {
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
      <label>Titel*</label>
      <input id="f-titel" type="text" value="${e?.titel ?? ''}" placeholder="z.B. Passwort-Manager, Testament, ...">
    </div>
    <div class="form-row two-col">
      <div class="form-group">
        <label>Kategorie*</label>
        <select id="f-kategorie">
          ${Object.entries(NF_KAT_LABEL).map(([v,l]) =>
            `<option value="${v}" ${e?.kategorie===v?'selected':''}>${l}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Priorität</label>
        <select id="f-prioritaet">
          <option value="1" ${e?.prioritaet===1?'selected':''}>Sofort</option>
          <option value="2" ${(!e||e.prioritaet===2)?'selected':''}>Normal</option>
          <option value="3" ${e?.prioritaet===3?'selected':''}>Irgendwann</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label>Wo liegt es / Verweis</label>
      <input id="f-verweis" type="text" value="${e?.verweis ?? ''}" placeholder="z.B. Bitwarden › Kategorie Finanzen / Safe im Arbeitszimmer">
    </div>
    <div class="form-group">
      <label>Hinweis (kein Klartext-Passwort!)</label>
      <textarea id="f-hinweis" rows="3" placeholder="Zusätzliche Hinweise für den Ernstfall...">${e?.hinweis ?? ''}</textarea>
    </div>`;
  document.getElementById('modal-submit').onclick = saveNotfallEintrag;
  openModal();
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

window.deleteNotfallEintrag = async (id, titel) => {
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
    const log = [data.git_output, data.pip_output].filter(Boolean).join('\n\n').trim();
    const reloadBtn = (data.success && !data.message.includes('neuesten Stand'))
      ? `<button class="update-reload-btn" onclick="location.reload()">Seite neu laden</button>`
      : '';

    body.innerHTML = `
      <p class="update-result-msg ${msgClass}">${escHtml(data.message)}</p>
      ${log ? `<pre class="update-log">${escHtml(log)}</pre>` : ''}
      ${reloadBtn}`;
  } catch (e) {
    body.innerHTML = `<p class="update-result-msg error">Verbindungsfehler: ${escHtml(e.message)}</p>`;
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
      ${data.output ? `<pre class="update-log">${escHtml(data.output)}</pre>` : ''}`;
  } catch (e) {
    body.innerHTML = `<p class="update-result-msg error">Fehler: ${escHtml(e.message)}</p>`;
  } finally {
    btn.classList.remove('loading');
  }
};

window.closeUpdateModal = () => {
  const modal = document.getElementById('update-modal');
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
};

// ── Globale Exports (für onclick-Handler in HTML) ───────────────────────────

window.navigate         = navigate;
window.openKontaktForm  = window.openKontaktForm;
window.openNotfallForm  = window.openNotfallForm;
window.spRecalc         = spRecalc;
window.spSavePlanField  = spSavePlanField;
window.spSavePosName    = spSavePosName;
window.spSavePosAmount  = spSavePosAmount;

// ── Init ────────────────────────────────────────────────────────────────────

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

  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Theme aus localStorage wiederherstellen
  applyTheme(localStorage.getItem('mfb-theme') ?? 'fintech');

  try {
    await loadAll();
    navigate('dashboard');
  } catch (e) {
    console.error('Init-Fehler:', e);
  }
});
