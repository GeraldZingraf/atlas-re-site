// Public lead-capture front-door for the browser form (Brief 1, task 1).
//
// The capture form can't carry the ORDERS_TOKEN secret, so it posts here instead
// of to the token-guarded leads function (C3). This endpoint creates/gets the
// lead via the SAME shared core, so there is one record shape and one license
// generator. Mirrors the public posture of create-order.mjs / track.mjs (write).
//
//   POST /.netlify/functions/subscribe  { email, name, website, source }
//     -> { ok:true, license, tier }
//
// email + name are required (the form collects both); website is optional and used
// to pre-personalize the kit. Email/name/website are stored ONLY in the leads store
// (C3/C4) — never echoed to analytics or placed in a URL. The response returns the
// license so the page can confirm.

import { createOrGetLead } from '../lib/leads-core.mjs';
import { deliverFree, regenerateLink } from '../lib/deliver-free-core.mjs';

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
  const name = (body?.name || '').toString().trim();
  if (!name) return Response.json({ ok: false, error: 'missing_name' }, { status: 400 });
  const website = (body?.website || '').toString().trim();
  const source = (body?.source || 'direct').toString().toLowerCase().slice(0, 40);

  let result;
  try { result = await createOrGetLead({ email, name, website, source }); }
  catch { return Response.json({ ok: false, error: 'invalid_email' }, { status: 400 }); }

  // Instant on-page delivery for free leads: build the kit NOW (synchronously) and
  // return its download link so the buyer downloads straight from the page — no email
  // round-trip required (the "bad email" fix). The welcome email still goes out as a
  // best-effort backup copy of the same link (handled inside deliverFree). Only free
  // leads deliver here; paid goes through PayPal/capture-order.
  //
  //   - brand-new free lead          -> deliverFree (build, store, fulfill, email-backup)
  //   - returning free lead (resubmit) -> regenerateLink (fresh link, no resend) so a
  //                                       re-submit always recovers the download on-page
  //   - any failure                  -> fall back to the background trigger + */15 sweep,
  //                                       and the page shows the email-only path
  let downloadUrl = null;
  if (result.record.tier === 'free') {
    try {
      const r = (result.created || !result.record.freeFulfilledAt)
        ? await deliverFree({ email })
        : await regenerateLink(result.record.license);
      if (r && r.ok && r.downloadUrl) downloadUrl = r.downloadUrl;
    } catch (_) { /* fall through to the background fallback below */ }

    if (!downloadUrl) {
      // Could not produce a link inline (e.g. assets not loaded, or a delivery race).
      // Try one fresh link, then hand off to the always-on async path as the backstop.
      try {
        const r2 = await regenerateLink(result.record.license);
        if (r2 && r2.ok && r2.downloadUrl) downloadUrl = r2.downloadUrl;
      } catch (_) {}
      if (!downloadUrl) {
        try {
          const origin = new URL(req.url).origin;
          await fetch(`${origin}/.netlify/functions/deliver-free-background`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-orders-token': process.env.ORDERS_TOKEN || '' },
            body: JSON.stringify({ email }),
          });
        } catch (_) { /* sweep will catch it */ }
      }
    }
  }

  return Response.json({ ok: true, license: result.record.license, tier: result.record.tier, downloadUrl });
};
