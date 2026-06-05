// Instant paid-kit delivery — Netlify BACKGROUND function (returns 202, runs async
// up to 15 min). Fired by capture-order.mjs the instant a purchase clears, so a
// paying customer gets their kit in seconds. Token-guarded; the */15 paid sweep is
// the backstop if this misses.
//
//   POST /.netlify/functions/deliver-paid-background  { txnId }   (x-orders-token)

import { deliverPaid } from '../lib/deliver-paid-core.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body = {};
  try { body = await req.json(); } catch { /* allow query-param fallback */ }
  const txnId = (body?.txnId || url.searchParams.get('txnId') || '').toString().trim();
  if (!txnId) return new Response('Missing txnId', { status: 400 });

  const res = await deliverPaid({ txnId });
  console.log('[deliver-paid-background]', JSON.stringify(res));
  return Response.json(res);
};
