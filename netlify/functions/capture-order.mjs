// Capture an approved PayPal order and drop it into the SAME orders queue the
// IPN pipeline already uses, so the local fulfillment engine + download-kit
// work unchanged. This is the on-domain replacement for the NCP/IPN front door.
//
// POST /.netlify/functions/capture-order  { orderID: "<paypal-order-id>" }
//   -> { ok: true, txnId, sku }   (also { status: "queued" })
//
// Order record shape MATCHES paypal-ipn.mjs exactly:
//   { txnId, sku, amount, currency, email, name, itemName, status, receivedAt }
//
// Env: PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_ENV (see create-order.mjs)

import { getStore } from '@netlify/blobs';

const API_BASE = (process.env.PAYPAL_ENV === 'sandbox')
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString('base64');
  const res = await fetch(`${API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return (await res.json()).access_token;
}

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  const orderID = body?.orderID;
  if (!orderID) return Response.json({ error: 'Missing orderID' }, { status: 400 });

  let accessToken;
  try { accessToken = await getAccessToken(); }
  catch { return Response.json({ error: 'auth_failed' }, { status: 502 }); }

  const capRes = await fetch(`${API_BASE}/v2/checkout/orders/${orderID}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  const result = await capRes.json();
  if (!capRes.ok || result.status !== 'COMPLETED') {
    return Response.json({ error: 'capture_failed', detail: result }, { status: 502 });
  }

  // Pull the fields the fulfillment pipeline expects out of the capture response.
  const pu = result.purchase_units?.[0] || {};
  const capture = pu.payments?.captures?.[0] || {};
  const payer = result.payer || {};
  const txnId = capture.id; // the capture id is our transaction id
  if (!txnId) return Response.json({ error: 'no_capture_id', detail: result }, { status: 502 });

  const sku = pu.custom_id || 'unknown';
  const payerName = `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim();

  // Buyer-entered details from the checkout form are authoritative for fulfillment.
  // Card payers have no PayPal account, so payer.email_address is often empty —
  // the form email is what the engine sends the kit to. Fall back to PayPal data.
  const contact = body.contact || {};
  const order = {
    txnId,
    sku,
    amount: capture.amount?.value || '',
    currency: capture.amount?.currency_code || 'USD',
    email: (contact.email || payer.email_address || '').trim(),
    name: (contact.name || payerName || '').trim(),
    website: (contact.website || '').trim(),
    itemName: pu.description || '',
    status: 'pending',
    receivedAt: new Date().toISOString(),
  };

  const store = getStore('orders');

  // Idempotency — capture can be retried; never queue the same txn twice.
  const existing = await store.get(txnId);
  if (!existing) await store.setJSON(txnId, order);

  return Response.json({ ok: true, status: 'queued', txnId, sku, email: order.email });
};
