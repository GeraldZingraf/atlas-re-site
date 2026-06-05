// Inject a synthetic PENDING order into the isolated `orders-test` store, so the full
// paid order-flow (getOrder -> claim -> marry -> build -> email -> markOrderFulfilled)
// can be tested end to end without a real PayPal charge. The live `orders` store is
// untouched, so track.mjs revenue/purchase counts and the laptop watcher never see it.
//
// Token-guarded.  POST /.netlify/functions/inject-test-order  (x-orders-token)
//   { email, sku?: 'solo'|'broker', name?, amount? }  -> { ok, txnId, order }

import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  const email = (body?.email || '').toString().trim();
  if (!email) return Response.json({ ok: false, error: 'missing email' }, { status: 400 });
  const sku = ['solo', 'broker'].includes(body?.sku) ? body.sku : 'solo';

  const txnId = `TEST-ORDER-${crypto.randomBytes(6).toString('hex')}`;
  const order = {
    txnId,
    sku,
    amount: (body?.amount || (sku === 'broker' ? '1997.00' : '500.00')).toString(),
    currency: 'USD',
    email,
    name: (body?.name || 'Order Flow Test').toString(),
    website: '',
    source: 'verify',
    itemName: sku === 'broker' ? 'Atlas-RE Broker Kit' : 'Atlas-RE Solo Kit',
    status: 'pending',
    receivedAt: new Date().toISOString(),
  };

  // Write to the SEPARATE test store. The live engine + analytics never read this.
  await getStore({ name: 'orders-test', consistency: 'strong' }).setJSON(txnId, order);
  return Response.json({ ok: true, txnId, order });
};
