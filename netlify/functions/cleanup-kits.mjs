// Scheduled daily sweep: delete kit blobs more than 24h past their first download.
//
// The common case is "buyer downloads once, never returns" — so the lazy expiry
// in download-kit.mjs would rarely fire. This sweep is what actually reclaims the
// storage: once a day it removes every kit downloaded more than a day ago.
//
// Kits never downloaded (no downloadedAt) are kept — the buyer hasn't gotten it yet.
// Runs daily via the schedule config below; also hittable manually for testing.

import { getStore } from '@netlify/blobs';

const EXPIRY_MS = 24 * 60 * 60 * 1000;

export default async () => {
  const store = getStore('kits');
  const now = Date.now();
  let scanned = 0, deleted = 0;

  const { blobs } = await store.list();
  for (const b of blobs) {
    scanned++;
    let rec;
    try { rec = await store.get(b.key, { type: 'json' }); } catch (_) { continue; }
    if (rec?.downloadedAt && (now - new Date(rec.downloadedAt).getTime()) > EXPIRY_MS) {
      try { await store.delete(b.key); deleted++; } catch (_) {}
    }
  }

  return new Response(JSON.stringify({ scanned, deleted }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const config = { schedule: '@daily' };
