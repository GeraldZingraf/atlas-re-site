// Capture an approved PayPal order and drop it into the orders queue the local
// fulfillment engine drains. On-domain replacement for the NCP/IPN front door.
//
// POST /.netlify/functions/capture-order  { orderID, contact?, sandbox? }
//   -> { ok: true, txnId, sku }
//
// Order record shape MATCHES paypal-ipn.mjs, plus a `website` field:
//   { txnId, sku, amount, currency, email, name, website, status, receivedAt }
//
// When { sandbox: true }: uses PAYPAL_SANDBOX_* creds + sandbox API, and writes
// to the SEPARATE "orders-test" store so the live engine never sees test orders.

import { getStore } from '@netlify/blobs';

function creds(sandbox) {
  return sandbox
    ? {
        base: 'https://api-m.sandbox.paypal.com',
        id: process.env.PAYPAL_SANDBOX_CLIENT_ID,
        secret: process.env.PAYPAL_SANDBOX_SECRET,
      }
    : {
        base: 'https://api-m.paypal.com',
        id: process.env.PAYPAL_CLIENT_ID,
        secret: process.env.PAYPAL_SECRET,
      };
}

async function getAccessToken(c) {
  const auth = Buffer.from(`${c.id}:${c.secret}`).toString('base64');
  const res = await fetch(`${c.base}/v1/oauth2/token`, {
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

  const sandbox = !!body.sandbox;
  const c = creds(sandbox);
  if (!c.id || !c.secret) return Response.json({ error: 'paypal_not_configured' }, { status: 502 });

  let accessToken;
  try { accessToken = await getAccessToken(c); }
  catch { return Response.json({ error: 'auth_failed' }, { status: 502 }); }

  const capRes = await fetch(`${c.base}/v2/checkout/orders/${orderID}/capture`, {
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

  const pu = result.purchase_units?.[0] || {};
  const capture = pu.payments?.captures?.[0] || {};
  const payer = result.payer || {};
  const txnId = capture.id; // the capture id is our transaction id
  if (!txnId) return Response.json({ error: 'no_capture_id', detail: result }, { status: 502 });

  // Resolve SKU robustly. PayPal returns custom_id on the CAPTURE object (and not
  // always on the purchase_unit), so check both, then fall back to the amount —
  // mirrors the old IPN listener — so fulfillment always knows which kit to build.
  const SKU_BY_AMOUNT = { '497.00': 'solo', '1997.00': 'broker' };
  const ITEM_NAME = { solo: 'Atlas-RE Solo Kit', broker: 'Atlas-RE Broker Kit' };
  const amountVal = capture.amount?.value || '';
  const sku = capture.custom_id || pu.custom_id || SKU_BY_AMOUNT[amountVal] || 'unknown';
  const payerName = `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim();

  // Buyer-entered details from the checkout form are authoritative for fulfillment.
  // Card payers have no PayPal account, so payer.email_address is often empty.
  const contact = body.contact || {};
  const order = {
    txnId,
    sku,
    amount: capture.amount?.value || '',
    currency: capture.amount?.currency_code || 'USD',
    email: (contact.email || payer.email_address || '').trim(),
    name: (contact.name || payerName || '').trim(),
    website: (contact.website || '').trim(),
    itemName: pu.description || ITEM_NAME[sku] || '',
    status: 'pending',
    receivedAt: new Date().toISOString(),
  };

  // Sandbox test orders go to a SEPARATE store so the live engine never sees them.
  const store = getStore(sandbox ? 'orders-test' : 'orders');

  // Idempotency — capture can be retried; never queue the same txn twice.
  const existing = await store.get(txnId);
  if (!existing) await store.setJSON(txnId, order);

  return Response.json({ ok: true, status: 'queued', txnId, sku, email: order.email, sandbox });
};
