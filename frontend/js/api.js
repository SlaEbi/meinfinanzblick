/* API client v16 — alle Aufrufe gehen an /api/v1/ */

const BASE = '/api/v1';

/* ── Schreibsperre im Demo-Modus ────────────────────────────────────────────
   Im Demo-Modus zeigt die Oberfläche Musterdaten, die Datensätze dahinter sind
   aber die echten. Weil sich die Demo-IDs mit den echten überschneiden, würde
   jeder Schreibvorgang einen echten Datensatz treffen — sichtbar wäre davon
   nichts, weil auf dem Schirm die Musterdaten stehen.

   Die Sperre sitzt deshalb hier an der einzigen Stelle, durch die JEDER
   Schreibvorgang läuft, und nicht in der Oberfläche: eine CSS-Regel oder ein
   Guard pro Formular muss bei jedem neuen Bedienelement nachgezogen werden,
   diese Prüfung nicht. */
function istDemoModus() {
  return sessionStorage.getItem('mfb-demo') === '1';
}

class DemoSchreibsperre extends Error {
  constructor() {
    super('Demo-Modus aktiv — Änderungen werden nicht gespeichert.');
    this.name = 'DemoSchreibsperre';
  }
}

async function request(method, path, body = null) {
  if (method !== 'GET' && istDemoModus()) throw new DemoSchreibsperre();

  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Fehler beim API-Aufruf');
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Konten ─────────────────────────────────────────────────────────────────

export const api = {
  konten: {
    list:   ()          => request('GET',    '/konten/'),
    create: (data)      => request('POST',   '/konten/', data),
    update: (id, data)  => request('PUT',    `/konten/${id}`, data),
    delete: (id)        => request('DELETE', `/konten/${id}`),
  },

  darlehen: {
    list:   ()          => request('GET',    '/darlehen/'),
    create: (data)      => request('POST',   '/darlehen/', data),
    update: (id, data)  => request('PUT',    `/darlehen/${id}`, data),
    delete: (id)        => request('DELETE', `/darlehen/${id}`),
    tilgungsplan: (id, sondertilgungJahr = 0) =>
      request('GET', `/darlehen/${id}/tilgungsplan?sondertilgung_jahr=${sondertilgungJahr}`),
    simulation: (params) => request('GET', `/darlehen/simulation?${new URLSearchParams(params)}`),
  },

  zinseszins: {
    simulation: (params) => request('GET', `/zinseszins/simulation?${new URLSearchParams(params)}`),
  },

  kapitalentnahme: {
    simulation: (params) => request('GET', `/kapitalentnahme/simulation?${new URLSearchParams(params)}`),
  },

  sparziele: {
    list:   ()          => request('GET',    '/sparziele/'),
    create: (data)      => request('POST',   '/sparziele/', data),
    update: (id, data)  => request('PUT',    `/sparziele/${id}`, data),
    delete: (id)        => request('DELETE', `/sparziele/${id}`),
    fuettern: (id, data)      => request('POST',   `/sparziele/${id}/fuetterungen`, data),
    fuetterungLoeschen: (id, fid) => request('DELETE', `/sparziele/${id}/fuetterungen/${fid}`),
  },

  spending: {
    list:           ()              => request('GET',    '/spending/'),
    aktiv:          ()              => request('GET',    '/spending/aktiv'),
    create:         (data)          => request('POST',   '/spending/', data),
    update:         (id, data)      => request('PUT',    `/spending/${id}`, data),
    delete:         (id)            => request('DELETE', `/spending/${id}`),
    addPosition:    (id, data)      => request('POST',   `/spending/${id}/positionen`, data),
    updatePosition: (id, pos, data) => request('PUT',    `/spending/${id}/positionen/${pos}`, data),
    deletePosition: (id, pos)       => request('DELETE', `/spending/${id}/positionen/${pos}`),
  },

  sachvermoegen: {
    list:   ()          => request('GET',    '/sachvermoegen/'),
    create: (data)      => request('POST',   '/sachvermoegen/', data),
    update: (id, data)  => request('PUT',    `/sachvermoegen/${id}`, data),
    delete: (id)        => request('DELETE', `/sachvermoegen/${id}`),
  },

  depots: {
    list:   ()          => request('GET',    '/depots/'),
    create: (data)      => request('POST',   '/depots/', data),
    update: (id, data)  => request('PUT',    `/depots/${id}`, data),
    delete: (id)        => request('DELETE', `/depots/${id}`),
    positionen: {
      list:   (depotId)       => request('GET',    `/depots/${depotId}/positionen`),
      create: (depotId, data) => request('POST',   `/depots/${depotId}/positionen`, data),
      delete: (depotId, posId) => request('DELETE', `/depots/${depotId}/positionen/${posId}`),
    },
  },

  versicherungen: {
    list:   ()          => request('GET',    '/versicherungen/'),
    create: (data)      => request('POST',   '/versicherungen/', data),
    update: (id, data)  => request('PUT',    `/versicherungen/${id}`, data),
    delete: (id)        => request('DELETE', `/versicherungen/${id}`),
  },

  vertraege: {
    list:   ()          => request('GET',    '/vertraege/'),
    create: (data)      => request('POST',   '/vertraege/', data),
    update: (id, data)  => request('PUT',    `/vertraege/${id}`, data),
    delete: (id)        => request('DELETE', `/vertraege/${id}`),
  },

  kontakte: {
    list:   ()          => request('GET',    '/kontakte/'),
    create: (data)      => request('POST',   '/kontakte/', data),
    update: (id, data)  => request('PUT',    `/kontakte/${id}`, data),
    delete: (id)        => request('DELETE', `/kontakte/${id}`),
  },

  notfall: {
    list:   ()          => request('GET',    '/notfall/'),
    create: (data)      => request('POST',   '/notfall/', data),
    update: (id, data)  => request('PUT',    `/notfall/${id}`, data),
    delete: (id)        => request('DELETE', `/notfall/${id}`),
  },

  networth: {
    get:            ()   => request('GET',    '/networth/'),
    snapshot:       ()   => request('POST',   '/networth/snapshot'),
    deleteSnapshot: (id) => request('DELETE', `/networth/snapshot/${id}`),
  },

  todos: {
    list:   ()          => request('GET',    '/todos/'),
    create: (data)      => request('POST',   '/todos/', data),
    update: (id, data)  => request('PUT',    `/todos/${id}`, data),
    delete: (id)        => request('DELETE', `/todos/${id}`),
  },


  steuer: {
    jahre:            ()          => request('GET',    '/steuer/jahre'),
    get:              (jahr)      => request('GET',    `/steuer/${jahr}`),
    create:           (data)      => request('POST',   '/steuer/', data),
    update:           (jahr, data) => request('PUT',   `/steuer/${jahr}`, data),
    delete:           (jahr)      => request('DELETE', `/steuer/${jahr}`),
    berechnung:       (jahr)      => request('GET',    `/steuer/${jahr}/berechnung`),
    hebesatzDefaults: (jahr)      => request('GET',    `/steuer/${jahr}/hebesatz-defaults`),
    meta:             (jahr)      => request('GET',    `/steuer/${jahr}/meta`),
  },

  steuerbescheide: {
    list:   ()          => request('GET',    '/steuerbescheide/'),
    get:    (jahr)      => request('GET',    `/steuerbescheide/${jahr}`),
    create: (data)      => request('POST',   '/steuerbescheide/', data),
    update: (jahr, data) => request('PUT',   `/steuerbescheide/${jahr}`, data),
    delete: (jahr)      => request('DELETE', `/steuerbescheide/${jahr}`),
  },

  anhaenge: {
    list:   (typ, id)      => request('GET',    `/anhaenge/${typ}/${id}`),
    delete: (anhangId)     => request('DELETE', `/anhaenge/${anhangId}`),
    upload: async (typ, id, file) => {
      if (istDemoModus()) throw new DemoSchreibsperre();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${BASE}/anhaenge/${typ}/${id}`, { method: 'POST', body: fd });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || 'Upload fehlgeschlagen');
      }
      return res.json();
    },
  },
};
