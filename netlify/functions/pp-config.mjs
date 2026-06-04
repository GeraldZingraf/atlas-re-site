// Public config for the checkout page. The PayPal client-id is public by
// design (it ships in the browser SDK URL), but we serve it from env so there
// is nothing to hardcode and nothing to change when you flip live/sandbox.
//
// GET /.netlify/functions/pp-config?sku=solo            -> live client-id
// GET /.netlify/functions/pp-config?sku=solo&sandbox=1  -> sandbox client-id

const CATALOG = {
  solo:   { amount: '500.00',   label: 'Solo Kit',   display: '$500' },
  broker: { amount: '1997.00',  label: 'Broker Kit', display: '$1,997' },
};

export default async (req) => {
  const url = new URL(req.url);
  const sku = url.searchParams.get('sku');
  const sandbox = url.searchParams.get('sandbox') === '1';
  const item = CATALOG[sku] || null;

  return Response.json({
    clientId: (sandbox ? process.env.PAYPAL_SANDBOX_CLIENT_ID : process.env.PAYPAL_CLIENT_ID) || '',
    env: sandbox ? 'sandbox' : (process.env.PAYPAL_ENV === 'sandbox' ? 'sandbox' : 'live'),
    sku,
    item, // null if the sku is unknown; the page shows an error in that case
  });
};
