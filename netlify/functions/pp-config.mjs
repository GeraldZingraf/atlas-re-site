// Public config for the checkout page. The PayPal client-id is public by
// design (it ships in the browser SDK URL), but we serve it from env so there
// is nothing to hardcode and nothing to change when you flip live/sandbox.
//
// GET /.netlify/functions/pp-config?sku=solo  -> { clientId, env, sku }

const CATALOG = {
  solo:   { amount: '497.00',   label: 'Solo Kit',   display: '$497' },
  broker: { amount: '1997.00',  label: 'Broker Kit', display: '$1,997' },
};

export default async (req) => {
  const url = new URL(req.url);
  const sku = url.searchParams.get('sku');
  const item = CATALOG[sku] || null;

  return Response.json({
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    env: process.env.PAYPAL_ENV === 'sandbox' ? 'sandbox' : 'live',
    sku,
    item, // null if the sku is unknown; the page shows an error in that case
  });
};
