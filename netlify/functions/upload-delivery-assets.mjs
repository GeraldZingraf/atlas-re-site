// Push the delivery assets (the immutable Starter kit + email templates) into the
// `delivery-assets` blob that the cloud delivery functions read at runtime. Storing
// these in a blob (rather than bundling into the function) means the kit copy or the
// welcome email can be updated by re-running push_delivery_assets.py — NO redeploy.
//
// Token-guarded (ORDERS_TOKEN). Called only by the local push_delivery_assets.py.
//
//   POST /.netlify/functions/upload-delivery-assets
//     { version?, kit: { "<relpath>": "<base64>" }, emails: { "welcome-free": "<text>" } }

import { getStore } from '@netlify/blobs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  if (!body?.kit || typeof body.kit !== 'object' || !Object.keys(body.kit).length) {
    return Response.json({ ok: false, error: 'missing or empty kit' }, { status: 400 });
  }
  if (!body?.emails || !body.emails['welcome-free']) {
    return Response.json({ ok: false, error: 'missing emails["welcome-free"]' }, { status: 400 });
  }

  await getStore('delivery-assets').setJSON('current', {
    version: body.version || 1,
    kit: body.kit,
    emails: body.emails,
    uploadedAt: new Date().toISOString(),
  });

  return Response.json({
    ok: true,
    kitFiles: Object.keys(body.kit).length,
    emails: Object.keys(body.emails),
  });
};
