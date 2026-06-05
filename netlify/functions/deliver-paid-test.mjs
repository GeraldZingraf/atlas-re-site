// Synchronous smoke test for cloud paid delivery — token-guarded. Builds a paid kit
// from the assets blob and emails it to a test address, with NO order/lead/revenue
// side effects (see deliverPaidTest). Returns the result synchronously so the caller
// can confirm ok + downloadUrl without a real purchase.
//
//   POST /.netlify/functions/deliver-paid-test  (x-orders-token)
//     { email, name?, sku?: 'solo'|'broker', matched?: bool }

import { deliverPaidTest } from '../lib/deliver-paid-core.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  let body = {};
  try { body = await req.json(); } catch { /* allow query params */ }
  const email = (body?.email || url.searchParams.get('email') || '').toString().trim();
  const name = (body?.name || url.searchParams.get('name') || 'Test Buyer').toString();
  const sku = (body?.sku || url.searchParams.get('sku') || 'solo').toString();
  const matched = body?.matched ?? (url.searchParams.get('matched') === '1');
  if (!email) return Response.json({ ok: false, error: 'missing email' }, { status: 400 });

  const res = await deliverPaidTest({ email, name, sku, matched });
  console.log('[deliver-paid-test]', JSON.stringify(res));
  return Response.json(res);
};
