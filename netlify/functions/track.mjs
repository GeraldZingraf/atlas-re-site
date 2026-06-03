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
//   GET /.netlify/functions/track?token=...&raw=1            -> rollup + cache state
//
// READ ARCHITECTURE — incremental rollup cache (why this exists):
//   The naive read scanned every event blob on each request (one get() per event).
//   That timed out, then crashed, the function once Meta-ad traffic grew the log —
//   blob get latency * event count is unbounded. Instead we keep a small cached
//   rollup (per-day aggregates) in the "analytics_rollup" store. Each read:
//     1. list() event keys — cheap, returns KEYS only, never fetches values.
//     2. fold only events whose key is beyond the cache highwater (lastKey), in a
//        bounded batch. Event keys are `${Date.now()}-<rand>`, so string-sorting
//        keys == chronological order, and "> lastKey" == "not yet folded".
//     3. persist the advanced cache; serve all-time or windowed totals from it.
//   The first read after deploy backfills in batches (no mass-fetch cliff); pass
//   ?batch=/?conc= to tune. Steady-state reads fold ~zero new events. The PUBLIC
//   WRITE PATH is untouched — a bug here can only affect the token-guarded read,
//   never beacon ingestion.
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

// Resolve async tasks with a bounded concurrency. Kept low on purpose: firing a
// large fan-out of blob gets at once overwhelmed the function (fast 502s).
async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

// Walk every blob in a store (small stores only — used for orders, not events).
async function readAll(store) {
  const out = [];
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : undefined);
    const got = await mapLimit(page.blobs, 8, async (b) => {
      try {
        const o = await store.get(b.key, { type: 'json' });
        if (o) o._key = b.key;
        return o;
      } catch {
        return null;
      }
    });
    for (const o of got) if (o) out.push(o);
    cursor = page.cursor;
  } while (cursor);
  return out;
}

// ---- incremental rollup cache helpers --------------------------------------
const DEPTHS = [25, 50, 75, 100];
const freshSrc = () => ({ visitors: [], ctaClicks: 0, checkoutSessions: [] });
const freshDay = () => ({
  events: 0,
  pageViews: 0,
  ctaClicks: 0,
  ctaBySku: {},
  scrollDepth: { 25: 0, 50: 0, 75: 0, 100: 0 },
  sessions: [],
  checkoutSessions: [],
  bySource: {},
});
const pushUniq = (arr, v) => { if (v && !arr.includes(v)) arr.push(v); };

// Fold one event into the per-day cache (mutates state.days).
function foldEvent(state, e) {
  const day = (typeof e.ts === 'string' && e.ts.slice(0, 10)) || 'unknown';
  const d = state.days[day] || (state.days[day] = freshDay());
  const sid = e.sessionId;
  const ch = channelOf(e.source);
  const s = d.bySource[ch] || (d.bySource[ch] = freshSrc());

  d.events += 1;
  if (sid) { pushUniq(d.sessions, sid); pushUniq(s.visitors, sid); }
  if (e.type === 'page_view') d.pageViews += 1;
  if (e.type === 'cta_click') {
    d.ctaClicks += 1;
    const k = e.sku || 'unknown';
    d.ctaBySku[k] = (d.ctaBySku[k] || 0) + 1;
    s.ctaClicks += 1;
  }
  if (e.type === 'scroll_depth' && d.scrollDepth[e.meta] !== undefined) d.scrollDepth[e.meta] += 1;
  if (e.type === 'checkout_start' && sid) {
    pushUniq(d.checkoutSessions, sid);
    pushUniq(s.checkoutSessions, sid);
  }
}

// Aggregate selected day buckets into the response-shaped numbers.
function aggregate(state, days) {
  const sessions = new Set();
  const checkoutSessions = new Set();
  const ctaBySku = {};
  const scrollDepth = { 25: 0, 50: 0, 75: 0, 100: 0 };
  const src = {};
  let events = 0, pageViews = 0, ctaClicks = 0;

  for (const day of days) {
    const d = state.days[day];
    if (!d) continue;
    events += d.events;
    pageViews += d.pageViews;
    ctaClicks += d.ctaClicks;
    for (const sid of d.sessions) sessions.add(sid);
    for (const sid of d.checkoutSessions) checkoutSessions.add(sid);
    for (const k in d.ctaBySku) ctaBySku[k] = (ctaBySku[k] || 0) + d.ctaBySku[k];
    for (const k of DEPTHS) scrollDepth[k] += d.scrollDepth[k] || 0;
    for (const ch in d.bySource) {
      const a = src[ch] || (src[ch] = { visitors: new Set(), ctaClicks: 0, checkoutSessions: new Set() });
      for (const sid of d.bySource[ch].visitors) a.visitors.add(sid);
      a.ctaClicks += d.bySource[ch].ctaClicks;
      for (const sid of d.bySource[ch].checkoutSessions) a.checkoutSessions.add(sid);
    }
  }
  return { sessions, checkoutSessions, ctaBySku, scrollDepth, src, events, pageViews, ctaClicks };
}

export default async (req) => {
  const url = new URL(req.url);
  const store = getStore('events');

  // ---- WRITE path (public) — UNCHANGED ---------------------------------------
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

  // ---- READ path (token-guarded) — incremental cache -------------------------
  if (req.method === 'GET') {
    const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
    if (!token || token !== process.env.ORDERS_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }

    const pct = (a, b) => (b ? +((a / b) * 100).toFixed(1) : 0);

    // Optional time window. ?since= inclusive, ?until= exclusive. ISO date or datetime.
    // Windowing is at day granularity (the weekly sync uses midnight boundaries).
    const since = url.searchParams.get('since');
    const until = url.searchParams.get('until');
    const sinceDay = since ? since.slice(0, 10) : null;
    const untilDay = until ? until.slice(0, 10) : null;
    const inWindow = (ts) => (!since || (ts && ts >= since)) && (!until || (ts && ts < until));

    // Tunables (let me dial the backfill without redeploying).
    const BATCH = Math.min(Math.max(parseInt(url.searchParams.get('batch') || '80', 10) || 80, 1), 600);
    const CONC = Math.min(Math.max(parseInt(url.searchParams.get('conc') || '8', 10) || 8, 1), 25);

    // 1. Load the cached rollup (or initialize).
    const rollupStore = getStore('analytics_rollup');
    let state = await rollupStore.get('state', { type: 'json' });
    if (!state || state.version !== 2) state = { version: 2, lastKey: '', days: {} };

    // 2. List event keys (cheap — keys only, no values fetched).
    const allKeys = [];
    let cursor;
    do {
      const page = await store.list(cursor ? { cursor } : undefined);
      for (const b of page.blobs) allKeys.push(b.key);
      cursor = page.cursor;
    } while (cursor);

    // 3. Fold only events beyond the highwater, oldest first, in a bounded batch.
    const newKeys = allKeys.filter((k) => k > state.lastKey).sort();
    const batch = newKeys.slice(0, BATCH);
    const fetched = await mapLimit(batch, CONC, async (k) => {
      try { return await store.get(k, { type: 'json' }); } catch { return null; }
    });
    let folded = 0;
    for (const e of fetched) { if (e) { foldEvent(state, e); folded += 1; } }
    if (batch.length) state.lastKey = batch[batch.length - 1]; // advance highwater
    await rollupStore.setJSON('state', state);
    const pending = newKeys.length - batch.length;

    // 4. Select day buckets for the window (all days if no window).
    const days = Object.keys(state.days).filter(
      (day) => (!sinceDay || day >= sinceDay) && (!untilDay || day < untilDay),
    );
    const agg = aggregate(state, days);

    // 5. Ground-truth purchases/revenue from the orders store (small — full scan ok).
    const orders = (await readAll(getStore('orders'))).filter((o) => inWindow(o.receivedAt));

    // 6. Merge beacon-side (visits/cta/checkouts) with order-side (buyers/revenue).
    const bySource = {};
    const channels = new Set([...Object.keys(agg.src), ...orders.map((o) => channelOf(o.source))]);
    for (const ch of channels) {
      const a = agg.src[ch] || { visitors: new Set(), ctaClicks: 0, checkoutSessions: new Set() };
      const chOrders = orders.filter((o) => channelOf(o.source) === ch);
      const buyers = chOrders.length;
      const revenue = chOrders.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
      const visits = a.visitors.size;
      const checkouts = a.checkoutSessions.size;
      bySource[ch] = {
        visits,
        ctaClicks: a.ctaClicks,
        checkouts,
        buyers,
        revenue,
        visit_to_buyer_pct: pct(buyers, visits),
        checkout_to_buyer_pct: pct(buyers, checkouts),
      };
    }

    const uniqueVisitors = agg.sessions.size;
    const checkoutStarts = agg.checkoutSessions.size;
    const purchases = orders.length;
    const revenue = orders.reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);

    const rollup = {
      generatedAt: new Date().toISOString(),
      totals: {
        events: agg.events,
        uniqueVisitors,
        pageViews: agg.pageViews,
        ctaClicks: agg.ctaClicks,
        checkoutStarts,
        purchases,
      },
      funnel: {
        visitor_to_cta_pct: pct(agg.ctaClicks, uniqueVisitors),
        cta_to_checkout_pct: pct(checkoutStarts, agg.ctaClicks),
        checkout_to_purchase_pct: pct(purchases, checkoutStarts),
        visitor_to_purchase_pct: pct(purchases, uniqueVisitors),
      },
      ctaBySku: agg.ctaBySku,
      scrollDepth: agg.scrollDepth,
      bySource,
      revenue,
      // Backfill progress: pending > 0 means call again to fold the rest.
      backfill: { pending, processedThisCall: folded, lastKey: state.lastKey, totalEvents: allKeys.length },
    };

    if (url.searchParams.get('raw') === '1') {
      return Response.json({ rollup, days: state.days });
    }
    return Response.json(rollup);
  }

  // ---- DELETE (token-guarded) — remove one event blob by key — UNCHANGED ------
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
