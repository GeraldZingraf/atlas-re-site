// First-party analytics — funnel telemetry for the validation signals.
//
// WRITE (public, no auth): the client analytics.js beacons page events here.
//   POST /.netlify/functions/track  { type, sku, sessionId, source, path, meta }
//   -> 204. Events land in the "events" blob store. `source` is the UTM-attributed
//   channel (see SOURCE_TO_CHANNEL) and powers the per-channel `bySource` rollup.
//
// READ (token-guarded, same ORDERS_TOKEN as orders.mjs): the local engine /
// Claude pulls the rolled-up funnel.
//   GET /.netlify/functions/track?token=...                  -> funnel rollup (all-time)
//   GET /.netlify/functions/track?token=...&since=&until=    -> rollup for a window
//   GET /.netlify/functions/track?token=...&raw=1            -> rollup + raw events
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

// Maps utm_source tags to the channel names used in the funnel Dashboard sheet,
// so the per-source rollup lines up 1:1 with that tab. Tag each channel's links:
//   ?utm_source=linkedin | meta | google | fbgroup | reddit | biggerpockets |
//               labcoat | activerain | youtube | tiktok
const SOURCE_TO_CHANNEL = {
  linkedin: 'LinkedIn',
  meta: 'Meta Ads',
  google: 'Google Search Ads',
  fbgroup: 'Facebook Groups',
  reddit: 'Reddit',
  biggerpockets: 'BiggerPockets',
  labcoat: 'Lab Coat Agents',
  activerain: 'Active Rain',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  direct: 'Direct',
  unknown: 'Unknown',
};
const channelOf = (s) => SOURCE_TO_CHANNEL[(s || 'direct').toLowerCase()] || (s || 'direct');

// Resolve an array of async tasks with a bounded concurrency so a large store
// doesn't fire thousands of simultaneous subrequests (which Netlify caps).
async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

// Walk every blob in a store, following the list cursor so we never miss events
// once volume grows past a single page. Blobs in a page are fetched in parallel
// (bounded) rather than one-at-a-time — the old serial loop timed out the function
// once the events log grew, which is what 502'd the read path.
//
// `keyTimeWindow` (optional) skips blobs whose key falls outside the window WITHOUT
// fetching them. Event keys are `${Date.now()}-<rand>`, so the numeric prefix is the
// write time in ms — this keeps windowed reads (the weekly sync) cheap as the log grows.
// A single unreadable blob is skipped, never fatal.
async function readAll(store, keyTimeWindow) {
  const out = [];
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : undefined);
    let blobs = page.blobs;
    if (keyTimeWindow) {
      const { sinceMs, untilMs } = keyTimeWindow;
      blobs = blobs.filter((b) => {
        const ms = parseInt(b.key, 10);
        if (!Number.isFinite(ms)) return true; // unknown key shape -> keep, filter later
        if (sinceMs != null && ms < sinceMs) return false;
        if (untilMs != null && ms >= untilMs) return false;
        return true;
      });
    }
    const got = await mapLimit(blobs, 250, async (b) => {
      try {
        const o = await store.get(b.key, { type: 'json' });
        if (o) o._key = b.key;
        return o;
      } catch {
        return null; // one bad blob must not 502 the whole rollup
      }
    });
    for (const o of got) if (o) out.push(o);
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
      source: clip(body?.source, 40) || 'direct',
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

    // Optional time window so the weekly sync can pull just one week's numbers.
    //   ?since=2026-06-01            (inclusive, ISO date or datetime)
    //   ?until=2026-06-08            (exclusive). Omit both for all-time.
    const since = url.searchParams.get('since');
    const until = url.searchParams.get('until');
    const inWindow = (ts) => (!since || (ts && ts >= since)) && (!until || (ts && ts < until));

    // Timestamp-prefixed event keys let us skip out-of-window blobs before fetching.
    const sinceMs = since ? Date.parse(since) : NaN;
    const untilMs = until ? Date.parse(until) : NaN;
    const keyWin = (since || until)
      ? { sinceMs: Number.isFinite(sinceMs) ? sinceMs : null, untilMs: Number.isFinite(untilMs) ? untilMs : null }
      : undefined;

    const events = (await readAll(store, keyWin)).filter((e) => inWindow(e.ts));

    // Ground-truth purchases come from the orders store, not client beacons. Orders
    // are keyed by txnId (not timestamp), so they're filtered by receivedAt after read.
    const ordersStore = getStore('orders');
    const orders = (await readAll(ordersStore)).filter((o) => inWindow(o.receivedAt));

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

    // Per-channel funnel (UTM-attributed). Visits/CTA/checkouts from beacons,
    // buyers/revenue ground-truthed from the order's stored source. Keyed by the
    // Dashboard channel names so weekly numbers drop straight into that tab.
    const srcAgg = {};
    const ensure = (ch) => (srcAgg[ch] || (srcAgg[ch] = {
      visitors: new Set(), ctaClicks: 0, checkoutSessions: new Set(), buyers: 0, revenue: 0,
    }));
    for (const e of events) {
      const a = ensure(channelOf(e.source));
      if (e.sessionId) a.visitors.add(e.sessionId);
      if (e.type === 'cta_click') a.ctaClicks += 1;
      if (e.type === 'checkout_start' && e.sessionId) a.checkoutSessions.add(e.sessionId);
    }
    for (const o of orders) {
      const a = ensure(channelOf(o.source));
      a.buyers += 1;
      a.revenue += parseFloat(o.amount) || 0;
    }
    const bySource = {};
    for (const ch of Object.keys(srcAgg)) {
      const a = srcAgg[ch];
      const visits = a.visitors.size;
      const checkouts = a.checkoutSessions.size;
      bySource[ch] = {
        visits,
        ctaClicks: a.ctaClicks,
        checkouts,
        buyers: a.buyers,
        revenue: a.revenue,
        visit_to_buyer_pct: pct(a.buyers, visits),
        checkout_to_buyer_pct: pct(a.buyers, checkouts),
      };
    }

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
      bySource,
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
