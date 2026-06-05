// Diagnostic: report which expected env vars are VISIBLE to a function at runtime.
// Token-guarded. Returns booleans + non-secret hints only (never the values), so we
// can confirm Netlify env scope/naming without firing a full delivery or leaking creds.
//
//   GET /.netlify/functions/env-check?token=ORDERS_TOKEN

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const keys = [
    'ATLAS_EMAIL', 'ATLAS_APP_PASSWORD', 'SMTP_HOST', 'SMTP_PORT',
    'BCC_EMAIL', 'INSTALL_GUIDE_URL', 'ORDERS_TOKEN', 'URL',
  ];
  const present = {};
  for (const k of keys) present[k] = typeof process.env[k] === 'string' && process.env[k].length > 0;

  // Non-secret hints to catch a typo'd/empty value (domain + length, never the secret).
  const hint = {
    atlas_email_domain: (process.env.ATLAS_EMAIL || '').split('@')[1] || '',
    app_password_len: (process.env.ATLAS_APP_PASSWORD || '').length,
  };

  return Response.json({ present, hint });
};
