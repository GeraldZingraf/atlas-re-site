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

  const store = getStore('delivery-assets');

  // --- per-kit upload (paid Solo/Broker — one kit per blob to stay under the
  //     function payload limit) ----------------------------------------------------
  //   { kind:'kit', name:'solo'|'broker', files: { "<relpath>": "<base64>" } }
  if (body?.kind === 'kit') {
    const name = (body.name || '').toString();
    if (!['free', 'solo', 'broker'].includes(name)) {
      return Response.json({ ok: false, error: 'kit name must be free|solo|broker' }, { status: 400 });
    }
    if (!body.files || typeof body.files !== 'object' || !Object.keys(body.files).length) {
      return Response.json({ ok: false, error: 'missing or empty files' }, { status: 400 });
    }
    await store.setJSON(`kit-${name}`, { files: body.files, uploadedAt: new Date().toISOString() });
    return Response.json({ ok: true, stored: `kit-${name}`, files: Object.keys(body.files).length });
  }

  // --- paid email templates ------------------------------------------------------
  //   { kind:'paid-emails', emails: { 'welcome-paid-match':'...', 'welcome-paid-nomatch':'...' } }
  if (body?.kind === 'paid-emails') {
    const e = body.emails;
    if (!e || !e['welcome-paid-match'] || !e['welcome-paid-nomatch']) {
      return Response.json({ ok: false, error: 'missing welcome-paid-match / welcome-paid-nomatch' }, { status: 400 });
    }
    await store.setJSON('paid-emails', { ...e, uploadedAt: new Date().toISOString() });
    return Response.json({ ok: true, stored: 'paid-emails', emails: Object.keys(e) });
  }

  // --- legacy free monolith (UNCHANGED — free delivery still reads 'current') -----
  //   { kit: {...}, emails: { 'welcome-free':'...' } }
  if (!body?.kit || typeof body.kit !== 'object' || !Object.keys(body.kit).length) {
    return Response.json({ ok: false, error: 'missing or empty kit' }, { status: 400 });
  }
  if (!body?.emails || !body.emails['welcome-free']) {
    return Response.json({ ok: false, error: 'missing emails["welcome-free"]' }, { status: 400 });
  }

  await store.setJSON('current', {
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
