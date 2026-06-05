// Synchronous test for cloud paid delivery — token-guarded. Two modes:
//
//  1. SMOKE (no txnId): build a paid kit from assets + email it, with NO order/lead/
//     revenue side effects (deliverPaidTest).
//  2. ORDER-FLOW (txnId given): run the REAL deliverPaid against the isolated
//     'orders-test' store — getOrder -> claim -> marry -> build -> email ->
//     markOrderFulfilled — and return the result synchronously. The live 'orders'
//     store, analytics, and laptop watcher never see it.
//
//   POST /.netlify/functions/deliver-paid-test  (x-orders-token)
//     smoke:      { email, name?, sku?: 'solo'|'broker', matched?: bool }
//     order-flow: { txnId, storeName?: 'orders-test' }

import { deliverPaidTest, deliverPaid } from '../lib/deliver-paid-core.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  let body = {};
  try { body = await req.json(); } catch { /* allow query params */ }

  // ORDER-FLOW mode: drive the real deliverPaid against a test-store order.
  const txnId = (body?.txnId || url.searchParams.get('txnId') || '').toString().trim();
  if (txnId) {
    const storeName = (body?.storeName || url.searchParams.get('storeName') || 'orders-test').toString();
    const res = await deliverPaid({ txnId, storeName });
    console.log('[deliver-paid-test order-flow]', JSON.stringify(res));
    return Response.json(res);
  }

  // SMOKE mode.
  const email = (body?.email || url.searchParams.get('email') || '').toString().trim();
  const name = (body?.name || url.searchParams.get('name') || 'Test Buyer').toString();
  const sku = (body?.sku || url.searchParams.get('sku') || 'solo').toString();
  const matched = body?.matched ?? (url.searchParams.get('matched') === '1');
  if (!email) return Response.json({ ok: false, error: 'missing email' }, { status: 400 });

  const res = await deliverPaidTest({ email, name, sku, matched });
  console.log('[deliver-paid-test smoke]', JSON.stringify(res));
  return Response.json(res);
};
