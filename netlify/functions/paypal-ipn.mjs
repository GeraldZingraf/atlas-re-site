// PayPal IPN listener — always-on capture for the Atlas-RE fulfillment pipeline.
//
// PayPal POSTs every transaction here (form-urlencoded). We:
//   1. Verify the message is genuinely from PayPal (post it back, expect "VERIFIED").
//   2. Only act on completed payments.
//   3. Map the amount to a SKU (solo / broker).
//   4. Store the order in the durable Blobs queue (idempotent by transaction id).
//
// This runs on Netlify's servers, so orders are captured even when Gerald's
// laptop is off. The local engine drains the queue when the machine is on.
//
// Set in PayPal: Settings > Notifications > IPN > Notification URL =
//   https://agent-atlas.co/.netlify/functions/paypal-ipn

import { getStore } from '@netlify/blobs';

// Live PayPal IPN verification endpoint. (Sandbox: https://ipnpb.sandbox.paypal.com/cgi-bin/webscr)
const PAYPAL_VERIFY_URL = 'https://ipnpb.paypal.com/cgi-bin/webscr';

// Map the gross amount to a SKU. Item names are the fallback.
const SKU_BY_AMOUNT = {
  '500.00': 'solo',
  '1997.00': 'broker',
};

function skuFor(amount, itemName) {
  if (SKU_BY_AMOUNT[amount]) return SKU_BY_AMOUNT[amount];
  const n = (itemName || '').toLowerCase();
  if (n.includes('broker') || n.includes('team')) return 'broker';
  if (n.includes('solo')) return 'solo';
  return 'unknown';
}

export default async (req) => {
  // PayPal sends application/x-www-form-urlencoded. Keep the raw body exactly.
  const raw = await req.text();

  // 1) Verify with PayPal by echoing the payload back, prefixed with cmd=_notify-validate.
  let verifyText = '';
  try {
    const verifyRes = await fetch(PAYPAL_VERIFY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'atlas-re-ipn-listener',
      },
      body: 'cmd=_notify-validate&' + raw,
    });
    verifyText = (await verifyRes.text()).trim();
  } catch (e) {
    // If verification call fails, ack so PayPal stops retrying, but do not store.
    return new Response('VERIFY_ERROR', { status: 200 });
  }

  if (verifyText !== 'VERIFIED') {
    // Spoofed or invalid — acknowledge but ignore.
    return new Response('INVALID', { status: 200 });
  }

  // 2) Parse the verified payload.
  const p = new URLSearchParams(raw);
  if (p.get('payment_status') !== 'Completed') {
    return new Response('OK_NONCOMPLETED', { status: 200 });
  }

  const txnId = p.get('txn_id');
  if (!txnId) return new Response('OK_NO_TXN', { status: 200 });

  const amount = p.get('mc_gross') || '';
  const order = {
    txnId,
    sku: skuFor(amount, p.get('item_name')),
    amount,
    currency: p.get('mc_currency') || 'USD',
    email: p.get('payer_email') || '',
    name: `${p.get('first_name') || ''} ${p.get('last_name') || ''}`.trim(),
    source: 'unknown', // IPN (off-domain PayPal) carries no channel attribution
    itemName: p.get('item_name') || '',
    status: 'pending',
    receivedAt: new Date().toISOString(),
  };

  const store = getStore('orders');

  // 3) Idempotency — never record the same transaction twice (PayPal retries IPN).
  const existing = await store.get(txnId);
  if (existing) {
    return new Response('OK_DUP', { status: 200 });
  }

  await store.setJSON(txnId, order);
  return new Response('OK', { status: 200 });
};
