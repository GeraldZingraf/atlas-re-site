// Public lead-capture front-door for the browser form (Brief 1, task 1).
//
// The capture form can't carry the ORDERS_TOKEN secret, so it posts here instead
// of to the token-guarded leads function (C3). This endpoint creates/gets the
// lead via the SAME shared core, so there is one record shape and one license
// generator. Mirrors the public posture of create-order.mjs / track.mjs (write).
//
//   POST /.netlify/functions/subscribe  { email, source } -> { ok:true, license, tier }
//
// Email is stored ONLY in the leads store (C3/C4) — never echoed to analytics or
// placed in a URL. The response returns the license so the page can confirm.

import { createOrGetLead } from '../lib/leads-core.mjs';

// Conservative single-line email check — just enough to reject junk/abuse, not a
// full RFC validator (the real signal is whether the address receives the email).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const email = (body?.email || '').toString().trim();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  const source = (body?.source || 'direct').toString().toLowerCase().slice(0, 40);

  let result;
  try { result = await createOrGetLead({ email, source }); }
  catch { return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 }); }

  return Response.json({ ok: true, license: result.record.license, tier: result.record.tier });
};
