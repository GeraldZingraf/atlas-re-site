// Regenerate a fresh download link for an existing FREE license (re-engagement).
// Rebuilds the kit from current assets (so it carries the latest activation hook) and
// stores it under a new token — does NOT re-send the welcome or change fulfillment.
// Token-guarded (ORDERS_TOKEN); called by the local re-engagement send script.
//
//   POST /.netlify/functions/relink  { license }  ->  { ok, downloadUrl }

import { regenerateLink } from '../lib/deliver-free-core.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  let body = {};
  try { body = await req.json(); } catch {}
  const license = (body?.license || url.searchParams.get('license') || '').toString().trim();
  if (!license) return Response.json({ ok: false, error: 'missing license' }, { status: 400 });

  const res = await regenerateLink(license);
  return Response.json(res);
};
