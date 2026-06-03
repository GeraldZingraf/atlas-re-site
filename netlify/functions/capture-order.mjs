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
import crypto from 'node:crypto';

// --- Meta Conversions API (server-side Purchase) -------------------------------
// Fires a server-to-server Purchase the instant PayPal confirms the money, so the
// event reaches Meta for 100% of captured orders regardless of ad blockers, iOS/
// ITP, or the buyer closing the tab on the redirect. Deduplicated against the
// browser pixel by event_id = txnId. No-ops unless META_PIXEL_ID + META_CAPI_TOKEN
// are set, so deploying this before the token exists changes nothing.
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const normEmail = (e) => (e || '').trim().toLowerCase();
const normName = (n) => (n || '').trim().toLowerCase().replace(/[^a-z]/g, ''); // Meta: lowercase, strip punctuation/spaces

async function sendMetaCapiPurchase({ order, fbp, fbc, clientIp, userAgent, eventSourceUrl }) {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  if (!pixelId || !token) return { skipped: 'capi_not_configured' };

  const [firstName, ...rest] = (order.name || '').trim().split(/\s+/);
  const lastName = rest.join(' ');

  // Advanced Matching — all PII is SHA-256 hashed; raw signals (fbp/fbc/ip/ua) are not.
  const user_data = {};
  if (order.email) user_data.em = [sha256(normEmail(order.email))];
  if (firstName) user_data.fn = [sha256(normName(firstName))];
  if (lastName) user_data.ln = [sha256(normName(lastName))];
  if (fbp) user_data.fbp = fbp;
  if (fbc) user_data.fbc = fbc;
  if (clientIp) user_data.client_ip_address = clientIp;
  if (userAgent) user_data.client_user_agent = userAgent;

  const payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: order.txnId,            // dedup key shared with the browser pixel
      action_source: 'website',
      event_source_url: eventSourceUrl,
      user_data,
      custom_data: {
        currency: order.currency || 'USD',
        value: Number(order.amount) || 0,
        content_name: order.sku || 'unknown',
      },
    }],
  };
  // Set META_TEST_EVENT_CODE in Netlify env to route events to Events Manager > Test Events while verifying.
  if (process.env.META_TEST_EVENT_CODE) payload.test_event_code = process.env.META_TEST_EVENT_CODE;

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    );
    const detail = await res.json().catch(() => ({}));
    if (!res.ok) return { error: 'capi_failed', status: res.status, detail };
    return { ok: true, detail };
  } catch (e) {
    return { error: 'capi_exception', message: String(e) };
  }
}

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
    source: (body.source || 'direct').toString().toLowerCase().slice(0, 40), // channel that drove the sale
    itemName: pu.description || ITEM_NAME[sku] || '',
    status: 'pending',
    receivedAt: new Date().toISOString(),
  };

  // Sandbox test orders go to a SEPARATE store so the live engine never sees them.
  const store = getStore(sandbox ? 'orders-test' : 'orders');

  // Idempotency — capture can be retried; never queue the same txn twice.
  const existing = await store.get(txnId);
  if (!existing) await store.setJSON(txnId, order);

  // Server-side Meta Purchase — only for NEW orders so a retried capture never
  // double-reports. event_id = txnId dedups against the browser pixel on
  // /thank-you. Live orders fire normally; sandbox orders fire ONLY when
  // META_TEST_EVENT_CODE is set, which routes them to Events Manager > Test Events
  // (never counted in production) so the whole path can be verified for free.
  // While that code is set, live orders also route to Test Events — so remove it
  // once verified to start counting real conversions.
  const capiTesting = !!process.env.META_TEST_EVENT_CODE;
  if (!existing && (!sandbox || capiTesting)) {
    const clientIp = req.headers.get('x-nf-client-connection-ip')
      || (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const userAgent = req.headers.get('user-agent') || '';
    let origin = 'https://agent-atlas.co';
    try { origin = new URL(req.url).origin; } catch {}
    await sendMetaCapiPurchase({
      order,
      fbp: body.fbp,
      fbc: body.fbc,
      clientIp,
      userAgent,
      eventSourceUrl: `${origin}/thank-you.html?txn=${encodeURIComponent(txnId)}`,
    });
  }

  return Response.json({ ok: true, status: 'queued', txnId, sku, amount: order.amount, email: order.email, sandbox });
};
