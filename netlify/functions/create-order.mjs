// Create a PayPal order, server-side, with an AUTHORITATIVE price.
//
// The browser only sends a SKU ("solo" | "broker"). The price is looked up
// here, on the server, so a buyer can never tamper with the amount in JS.
//
// POST /.netlify/functions/create-order  { sku, sandbox? }
//   -> { id: "<paypal-order-id>" }
//
// When { sandbox: true } it uses the PAYPAL_SANDBOX_* credentials against the
// PayPal sandbox API, so test purchases never touch live money. Live mode uses
// PAYPAL_CLIENT_ID / PAYPAL_SECRET as before.

// Single source of truth for what each SKU costs and is called.
const CATALOG = {
  solo:   { amount: '497.00',  name: 'Atlas-RE Solo Kit' },
  broker: { amount: '1997.00', name: 'Atlas-RE Broker Kit' },
};

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
  if (!res.ok) throw new Error(`token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const item = CATALOG[body?.sku];
  if (!item) return Response.json({ error: 'Unknown SKU' }, { status: 400 });

  const c = creds(!!body.sandbox);
  if (!c.id || !c.secret) return Response.json({ error: 'paypal_not_configured' }, { status: 502 });

  let accessToken;
  try { accessToken = await getAccessToken(c); }
  catch (e) { return Response.json({ error: 'auth_failed' }, { status: 502 }); }

  const orderRes = await fetch(`${c.base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        custom_id: body.sku, // carried through to capture so we record the right SKU
        description: item.name,
        amount: {
          currency_code: 'USD',
          value: item.amount,
          breakdown: {
            item_total: { currency_code: 'USD', value: item.amount },
          },
        },
        items: [{
          name: item.name,
          quantity: '1',
          unit_amount: { currency_code: 'USD', value: item.amount },
        }],
      }],
      application_context: {
        brand_name: 'Atlas for Real Estate',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    }),
  });

  if (!orderRes.ok) {
    return Response.json({ error: 'create_failed', detail: await orderRes.text() }, { status: 502 });
  }

  const order = await orderRes.json();
  return Response.json({ id: order.id });
};
