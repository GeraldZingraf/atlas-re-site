// Orders queue API — the bridge between the cloud queue and the local engine.
//
// The local fulfillment engine (on Gerald's laptop) calls this to:
//   GET  /.netlify/functions/orders            -> list pending orders
//   POST /.netlify/functions/orders {txnId}    -> mark an order fulfilled
//
// Protected by a shared secret (env var ORDERS_TOKEN), passed either as
// header "x-orders-token" or query "?token=...". Set ORDERS_TOKEN in the
// Netlify site env AND in the local engine's .env (same value).

import { getStore } from '@netlify/blobs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const store = getStore('orders');

  // List pending orders (oldest first).
  if (req.method === 'GET') {
    const { blobs } = await store.list();
    const pending = [];
    for (const b of blobs) {
      const o = await store.get(b.key, { type: 'json' });
      if (o && o.status === 'pending') pending.push(o);
    }
    pending.sort((a, b) => (a.receivedAt || '').localeCompare(b.receivedAt || ''));
    return Response.json({ count: pending.length, pending });
  }

  // Mark an order fulfilled (or failed).
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
    const { txnId, status } = body || {};
    if (!txnId) return new Response('Missing txnId', { status: 400 });

    const o = await store.get(txnId, { type: 'json' });
    if (!o) return new Response('Not found', { status: 404 });

    o.status = status || 'fulfilled';
    o.fulfilledAt = new Date().toISOString();
    await store.setJSON(txnId, o);
    return Response.json({ ok: true, txnId, status: o.status });
  }

  return new Response('Method not allowed', { status: 405 });
};
