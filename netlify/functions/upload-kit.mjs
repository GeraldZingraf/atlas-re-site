// Upload a built kit zip into the durable "kits" store, keyed by a random
// download token. Called by the local fulfillment engine (ORDERS_TOKEN-protected).
//
// POST JSON: { dlToken, filename, b64, license?, tier? }  with header x-orders-token
// Returns:   { ok: true, path: "/.netlify/functions/download-kit?t=<dlToken>" }
//
// `license` is OPTIONAL. When Delivery (Stream 4) passes it, download-kit.mjs
// meters the pull against the per-license download cap (C5). Omitting it keeps
// today's behavior (24h-after-first-download link expiry only) — no cap binding.

import { getStore } from '@netlify/blobs';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const token = req.headers.get('x-orders-token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  const { dlToken, filename, b64, license, tier } = body || {};
  if (!dlToken || !filename || !b64) return new Response('Missing fields', { status: 400 });

  const store = getStore('kits');
  await store.setJSON(dlToken, {
    filename,
    b64,
    license: license ? license.toString().trim() : null, // C5 download-cap binding (optional)
    tier: tier === 'paid' ? 'paid' : (tier === 'free' ? 'free' : null),
    createdAt: new Date().toISOString(),
    downloadedAt: null,
  });

  return Response.json({ ok: true, path: `/.netlify/functions/download-kit?t=${dlToken}` });
};
