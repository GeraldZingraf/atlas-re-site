// Instant free-kit delivery — Netlify BACKGROUND function (the `-background` suffix
// makes Netlify return 202 immediately and run this async, up to 15 min). Fired by
// subscribe.mjs the moment a new free lead signs up, so delivery happens in seconds.
//
// Token-guarded (ORDERS_TOKEN) — only our own functions invoke it. A failure here is
// non-fatal to signup; the */15 sweep is the backstop.
//
//   POST /.netlify/functions/deliver-free-background  { email }   (x-orders-token)

import { deliverFree } from '../lib/deliver-free-core.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body = {};
  try { body = await req.json(); } catch { /* allow query-param fallback */ }
  const email = (body?.email || url.searchParams.get('email') || '').toString().trim();
  if (!email) return new Response('Missing email', { status: 400 });

  const res = await deliverFree({ email });
  console.log('[deliver-free-background]', JSON.stringify(res));
  return Response.json(res);
};
