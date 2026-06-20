/* API client — alle Aufrufe gehen an /api/v1/ */

const BASE = '/api/v1';

async function request(method, path, body = null) {
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

  dokumente: {
    list:   ()          => request('GET',    '/dokumente/'),
    create: (data)      => request('POST',   '/dokumente/', data),
    update: (id, data)  => request('PUT',    `/dokumente/${id}`, data),
    delete: (id)        => request('DELETE', `/dokumente/${id}`),
  },

  networth: {
    get:      ()  => request('GET',  '/networth/'),
    snapshot: ()  => request('POST', '/networth/snapshot'),
  },
};
