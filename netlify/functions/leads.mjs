// Leads / License API (contract C3). The server-side source of truth for the
// free->paid identity thread: one record per email, a license-index for license
// lookups. Mirrors orders.mjs auth + style.
//
// Token-guarded (shared secret ORDERS_TOKEN, header "x-orders-token" or "?token=").
// Named callers are all server-side: Delivery (issue at signup / marry at
// purchase / mark fulfilled) and Product (license check via C5). The PUBLIC
// browser capture form does NOT call this directly — it posts to the public
// subscribe.mjs front-door, which shares the same create-lead core.
//
//   POST   /.netlify/functions/leads            { email, name, website, source } -> { license, tier }
//   GET    /.netlify/functions/leads?email=     | ?license=            -> record | 404 {found:false}
//   GET    /.netlify/functions/leads?pending=free                      -> { count, pending:[records] }
//   POST   /.netlify/functions/leads?action=marry     { email, txnId } -> { license, tier:"paid", matched }
//   POST   /.netlify/functions/leads?action=fulfilled { license, which } -> { ok:true }

import { createOrGetLead, getByEmail, getByLicense, marry, markFulfilled, publicShape, listPendingFree, listAllLeads } from '../lib/leads-core.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  // GET — list pending free leads (the free-lead watcher polls this).
  if (req.method === 'GET' && url.searchParams.get('pending') === 'free') {
    const pending = await listPendingFree();
    return Response.json({ count: pending.length, pending });
  }

  // GET — list ALL leads (admin reporting; e.g. the funnel tracker's Leads tab).
  // Token-guarded like the rest of this endpoint; returns the same publicShape.
  if (req.method === 'GET' && url.searchParams.get('all') === '1') {
    const all = (await listAllLeads())
      .map(publicShape)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); // oldest first
    return Response.json({ count: all.length, leads: all });
  }

  // GET — lookup by email or license.
  if (req.method === 'GET') {
    const email = url.searchParams.get('email');
    const license = url.searchParams.get('license');
    if (!email && !license) return Response.json({ error: 'Missing email or license' }, { status: 400 });
    const rec = email ? await getByEmail(email) : await getByLicense(license);
    if (!rec) return Response.json({ found: false }, { status: 404 });
    return Response.json(publicShape(rec));
  }

  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
    const action = url.searchParams.get('action');

    // marry free -> paid at purchase.
    if (action === 'marry') {
      const { email, txnId } = body || {};
      if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });
      const { record, matched } = await marry({ email, txnId });
      return Response.json({ license: record.license, tier: 'paid', matched });
    }

    // mark a fulfillment timestamp.
    if (action === 'fulfilled') {
      const { license, which } = body || {};
      if (!license) return Response.json({ error: 'Missing license' }, { status: 400 });
      if (which !== 'free' && which !== 'paid') return Response.json({ error: 'which must be free|paid' }, { status: 400 });
      const rec = await markFulfilled({ license, which });
      if (!rec) return Response.json({ found: false }, { status: 404 });
      return Response.json({ ok: true });
    }

    // default — create or get a lead (idempotent on email). name/website optional
    // here (server-side callers may not have them); the public form enforces name.
    const { email, name, website, source } = body || {};
    if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });
    let result;
    try { result = await createOrGetLead({ email, name, website, source }); }
    catch { return Response.json({ error: 'invalid_email' }, { status: 400 }); }
    return Response.json({ license: result.record.license, tier: result.record.tier });
  }

  return new Response('Method not allowed', { status: 405 });
};
