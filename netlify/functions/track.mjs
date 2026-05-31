// First-party analytics — funnel telemetry for the validation signals.
//
// WRITE (public, no auth): the client analytics.js beacons page events here.
//   POST /.netlify/functions/track  { type, sku, sessionId, path, meta }
//   -> 204. Events land in the "events" blob store.
//
// READ (token-guarded, same ORDERS_TOKEN as orders.mjs): the local engine /
// Claude pulls the rolled-up funnel.
//   GET /.netlify/functions/track?token=...           -> funnel rollup
//   GET /.netlify/functions/track?token=...&raw=1     -> rollup + raw events
//
// No third-party analytics. No cookies. sessionId is a random id in localStorage,
// not PII. This matches the site's no-SaaS, first-party-data posture.

import { getStore } from '@netlify/blobs';

// Only these event types are accepted; anything else is dropped on the floor.
const ALLOWED = new Set([
  'page_view',
  'scroll_depth',
  'cta_click',
  'checkout_start',
  'purchase',
  'refund_view',
]);

const clip = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');

// Walk every blob in a store, following the list cursor so we never miss events
// once volume grows past a single page.
async function readAll(store) {
  const out = [];
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : undefined);
    for (const b of page.blobs) {
      const o = await store.get(b.key, { type: 'json' });
      if (o) { o._key = b.key; out.push(o); }
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}

export default async (req) => {
  const url = new URL(req.url);
  const store = getStore('events');

  // ---- WRITE path (public) ---------------------------------------------------
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

    const type = clip(body?.type, 40);
    if (!ALLOWED.has(type)) return new Response(null, { status: 204 }); // ignore junk silently

    const ev = {
      type,
      sku: clip(body?.sku, 20),
      sessionId: clip(body?.sessionId, 64),
      path: clip(body?.path, 200),
      meta: clip(typeof body?.meta === 'string' ? body.meta : JSON.stringify(body?.meta ?? ''), 200),
      ref: clip(req.headers.get('referer'), 200),
      ts: new Date().toISOString(),
    };

    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await store.setJSON(key, ev);
    return new Response(null, { status: 204 });
  }

  // ---- READ path (token-guarded) ---------------------------------------------
  if (req.method === 'GET') {
    const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
    if (!token || token !== process.env.ORDERS_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }

    const events = await readAll(store);

    // Ground-truth purchases come from the orders store, not client beacons.
    const ordersStore = getStore('orders');
    const orders = await readAll(ordersStore);

    const byType = {};
    const ctaBySku = {};
    const scrollDepth = { 25: 0, 50: 0, 75: 0, 100: 0 };
    const sessions = new Set();
    const checkoutStartSessions = new Set();

    for (const e of events) {
      byType[e.type] = (byType[e.type] || 0) + 1;
      if (e.sessionId) sessions.add(e.sessionId);
      if (e.type === 'cta_click') ctaBySku[e.sku || 'unknown'] = (ctaBySku[e.sku || 'unknown'] || 0) + 1;
      if (e.type === 'scroll_depth' && scrollDepth[e.meta] !== undefined) scrollDepth[e.meta] += 1;
      if (e.type === 'checkout_start' && e.sessionId) checkoutStartSessions.add(e.sessionId);
    }

    const uniqueVisitors = sessions.size;
    const ctaClicks = byType.cta_click || 0;
    const checkoutStarts = checkoutStartSessions.size;
    const purchases = orders.length; // every queued order is a completed payment
    const pct = (a, b) => (b ? +((a / b) * 100).toFixed(1) : 0);

    const rollup = {
      generatedAt: new Date().toISOString(),
      totals: {
        events: events.length,
        uniqueVisitors,
        pageViews: byType.page_view || 0,
        ctaClicks,
        checkoutStarts,
        purchases,
      },
      funnel: {
        // Each rate is the drop from the prior stage.
        visitor_to_cta_pct: pct(ctaClicks, uniqueVisitors),
        cta_to_checkout_pct: pct(checkoutStarts, ctaClicks),
        checkout_to_purchase_pct: pct(purchases, checkoutStarts),
        visitor_to_purchase_pct: pct(purchases, uniqueVisitors),
      },
      ctaBySku,
      scrollDepth,
      revenue: orders.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0),
    };

    if (url.searchParams.get('raw') === '1') {
      return Response.json({ rollup, events });
    }
    return Response.json(rollup);
  }

  // ---- DELETE (token-guarded) — remove one event blob by key ------------------
  if (req.method === 'DELETE') {
    const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
    if (!token || token !== process.env.ORDERS_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
    const key = url.searchParams.get('key');
    if (!key) return Response.json({ error: 'Missing key' }, { status: 400 });
    await store.delete(key);
    return Response.json({ ok: true, deleted: key });
  }

  return new Response('Method not allowed', { status: 405 });
};
