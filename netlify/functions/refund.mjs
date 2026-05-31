// Refund-reason capture — structured "why it didn't fit" signal.
//
// WRITE (public): refund.html posts the buyer's refund request + reason here.
//   POST /.netlify/functions/refund  { email, txnId, reason, notes }
//   -> { ok: true }. Stored in the "refunds" blob store.
//
// READ (token-guarded, same ORDERS_TOKEN): the local engine / Claude pulls the
// list of refund reasons to sharpen the "NOT for" filter and the offer.
//   GET /.netlify/functions/refund?token=...
//
// This does NOT issue the refund (PayPal does that, by hand). It captures the
// reason at the moment the buyer asks, which a PayPal refund alone never gives us.
// If an order matches the email/txn, it is tagged refund_requested so the
// fulfillment ledger reflects it.

import { getStore } from '@netlify/blobs';

const REASONS = new Set([
  'didnt_fit_workflow',
  'too_technical',
  'not_enough_value',
  'bought_by_mistake',
  'expected_something_else',
  'other',
]);

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

async function readAll(store) {
  const out = [];
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : undefined);
    for (const b of page.blobs) {
      const o = await store.get(b.key, { type: 'json' });
      if (o) out.push(o);
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const store = getStore('refunds');

  // ---- WRITE (public) --------------------------------------------------------
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

    const email = clip(body?.email, 160);
    const reason = clip(body?.reason, 40);
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: 'A valid email is required.' }, { status: 400 });
    }
    if (!REASONS.has(reason)) {
      return Response.json({ error: 'Pick a reason.' }, { status: 400 });
    }

    const rec = {
      email,
      txnId: clip(body?.txnId, 64),
      reason,
      notes: clip(body?.notes, 2000),
      status: 'open', // open -> refunded (Gerald closes it after issuing in PayPal)
      receivedAt: new Date().toISOString(),
    };

    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await store.setJSON(key, rec);

    // Best-effort: tag the matching order so the ledger reflects the request.
    try {
      const orders = getStore('orders');
      const all = await readAll(orders);
      const match = all.find(o =>
        (rec.txnId && o.txnId === rec.txnId) ||
        (o.email && o.email.toLowerCase() === email.toLowerCase())
      );
      if (match) {
        match.refundRequested = true;
        match.refundReason = reason;
        match.refundRequestedAt = rec.receivedAt;
        await orders.setJSON(match.txnId, match);
      }
    } catch (e) { /* non-fatal: the refund record is already saved */ }

    return Response.json({ ok: true });
  }

  // ---- READ (token-guarded) --------------------------------------------------
  if (req.method === 'GET') {
    const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
    if (!token || token !== process.env.ORDERS_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
    const all = await readAll(store);
    all.sort((a, b) => (b.receivedAt || '').localeCompare(a.receivedAt || ''));

    const byReason = {};
    for (const r of all) byReason[r.reason] = (byReason[r.reason] || 0) + 1;

    return Response.json({
      count: all.length,
      open: all.filter(r => r.status === 'open').length,
      byReason,
      refunds: all,
    });
  }

  return new Response('Method not allowed', { status: 405 });
};
