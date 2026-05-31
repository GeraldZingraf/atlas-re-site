// TEMPORARY — verifies the fulfillment watcher's headless path end-to-end.
// Writes one test order into the LIVE 'orders' queue so AtlasRE-OrderWatcher
// picks it up. Token-guarded (ORDERS_TOKEN). REMOVE after the test.
//
// POST /.netlify/functions/inject-test-order  { name, email, website, sku }
//   header x-orders-token: <ORDERS_TOKEN>

import { getStore } from '@netlify/blobs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const sku = body.sku === 'broker' ? 'broker' : 'solo';
  const txnId = body.txnId || 'TEST-WATCHER-CHECK';
  const order = {
    txnId,
    sku,
    amount: sku === 'broker' ? '1997.00' : '497.00',
    currency: 'USD',
    email: (body.email || '').trim(),
    name: (body.name || '').trim(),
    website: (body.website || '').trim(),
    source: 'test-inject',
    itemName: sku === 'broker' ? 'Atlas-RE Broker Kit' : 'Atlas-RE Solo Kit',
    status: 'pending',
    receivedAt: new Date().toISOString(),
    _test: true,
  };

  const store = getStore('orders');
  await store.setJSON(txnId, order);
  return Response.json({ ok: true, injected: order });
};
