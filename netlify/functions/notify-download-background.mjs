// Email Gerald when a kit is downloaded (a real activation signal). Netlify BACKGROUND
// function (returns 202, runs async) — fired by download-kit.mjs on the FIRST pull of
// each kit, so the download itself is never delayed and Gerald gets one email per
// download (not per re-click). Token-guarded; best-effort.
//
//   POST /.netlify/functions/notify-download-background  { license, tier, filename }
//
// Recipient: NOTIFY_EMAIL, else BCC_EMAIL (gzingraf@gmail.com), so it works with the
// env vars already set.

import { getByLicense } from '../lib/leads-core.mjs';
import { sendMail } from '../lib/mailer.mjs';

export default async (req) => {
  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }
  const env = process.env;

  let body = {};
  try { body = await req.json(); } catch { /* allow query-param fallback */ }
  const license = (body?.license || url.searchParams.get('license') || '').toString();
  const tier = (body?.tier || url.searchParams.get('tier') || '').toString();
  const filename = (body?.filename || url.searchParams.get('filename') || '').toString();

  const to = env.NOTIFY_EMAIL || env.BCC_EMAIL || 'gzingraf@gmail.com';

  try {
    // Resolve buyer details from the lead record when we have a license.
    let name = '', email = '', source = '';
    if (license) {
      const rec = await getByLicense(license);
      if (rec) { name = rec.name || ''; email = rec.email || ''; source = rec.source || ''; }
    }
    const who = name ? `${name}${email ? ` (${email})` : ''}` : (email || 'A lead');
    const kitLabel = tier === 'paid' ? 'paid kit' : 'free kit';

    const subject = `Atlas-RE download: ${who} pulled the ${kitLabel}`;
    const text = [
      `${who} just downloaded their Atlas-RE ${kitLabel}.`,
      '',
      `Name:    ${name || '(unknown)'}`,
      `Email:   ${email || '(unknown)'}`,
      `Tier:    ${tier || '(unknown)'}`,
      `Source:  ${source || '(unknown)'}`,
      `License: ${license || '(none)'}`,
      `File:    ${filename || '(unknown)'}`,
    ].join('\n');

    await sendMail(env, { to, subject, text });
    console.log('[notify-download]', JSON.stringify({ ok: true, to, license, tier }));
    return Response.json({ ok: true, to });
  } catch (e) {
    const msg = String(e?.message || e);
    console.error('[notify-download] error', msg);
    return Response.json({ ok: false, error: msg });
  }
};
