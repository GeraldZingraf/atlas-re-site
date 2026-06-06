// "Atlas came online" ping — the free-trial funnel step: installed Claude + activated
// Atlas. Called by the kit's SessionStart hook from the buyer's machine when they open
// the kit in Claude Code. PUBLIC (authenticated by the license, its own secret — like
// the download token), since the buyer's machine has no ORDERS_TOKEN.
//
//   POST /.netlify/functions/atlas-activated  { license }
//
// Stamps atlasActivatedAt on the lead (first ping) and fires an `atlas_activated`
// analytics event on FIRST activation so track.mjs counts activations per channel
// (deduped by license). Unknown licenses are accepted silently (no enumeration).

import { getStore } from '@netlify/blobs';
import { recordAtlasActivation } from '../lib/leads-core.mjs';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body = {};
  try { body = await req.json(); } catch { /* allow query-param fallback */ }
  const url = new URL(req.url);
  const license = (body?.license || url.searchParams.get('license') || '').toString().trim();
  if (!license) return Response.json({ ok: false, error: 'missing license' }, { status: 400 });

  const res = await recordAtlasActivation(license);
  // Silent on unknown license — don't confirm/deny which licenses exist.
  if (!res.ok) return Response.json({ ok: true });

  // Fire the funnel event only on the FIRST activation (deduped by license in the
  // rollup, so repeat session-starts don't inflate it).
  if (res.firstTime) {
    try {
      const ev = {
        type: 'atlas_activated',
        sku: res.tier || 'free',
        sessionId: '',
        source: res.source || 'direct',
        path: '/atlas-activated',
        meta: license,                 // dedup key for the rollup
        ts: new Date().toISOString(),
      };
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await getStore('events').setJSON(key, ev);
    } catch (_) {}
  }

  return Response.json({ ok: true });
};
