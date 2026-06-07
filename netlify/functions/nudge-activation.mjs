// Automated activation nudge — Netlify SCHEDULED function (always-on, no laptop).
// Once per lead: a free lead that signed up 48h+ ago and has NOT activated Atlas
// (no atlasActivatedAt) gets one check-in email with a FRESH download link (relink,
// so the kit carries the activation hook). Marked with activationNudgeAt so it never
// re-nudges. Runs daily M-F ~11am ET.
//
// Modes:
//   (scheduled / plain)        -> SEND: email + mark each eligible lead (48h+).
//   ?mode=mark-only            -> MARK all currently-eligible non-activated free leads
//                                 as nudged WITHOUT sending (used once after launch to
//                                 suppress a cohort already hand-emailed).
//
// Safety: only ever emails real (test-filtered), free, not-yet-activated leads with a
// fixed template; one-time via activationNudgeAt; capped per run. Mirrors the unguarded
// scheduled-function pattern of cleanup-kits.

import { listAllLeads, patchLead } from '../lib/leads-core.mjs';
import { regenerateLink } from '../lib/deliver-free-core.mjs';
import { sendMail } from '../lib/mailer.mjs';

export const config = { schedule: '0 15 * * 1-5' }; // 15:00 UTC M-F (~11am ET)

const FORTY_EIGHT_H = 48 * 60 * 60 * 1000;
const CAP = 25;
const GUIDE = 'https://agent-atlas.co/install-guide.html';
const SUBJECT = 'How are your Atlas agents doing?';
const TEST_SRC = new Set(['verify', 'audit-smoketest', 'qa-regression', 'self-test']);

function isReal(r) {
  const e = (r.email || '').toLowerCase();
  const s = (r.source || '').toLowerCase();
  if (TEST_SRC.has(s)) return false;
  if (e === 'gerald@glaciergrid.com' || e === 'gzingraf@gmail.com') return false;
  const [loc, dom] = e.split('@');
  const root = (loc || '').split('+')[0];
  if (dom === 'gmail.com' && root.replace(/\./g, '') === 'gzingraf') return false;
  if (dom === 'glaciergrid.com' && root === 'gerald') return false;
  if (e.endsWith('@example.com') || e.endsWith('@agent-atlas.co')) return false;
  return true;
}

function firstName(name, email) {
  const n = (name || '').trim();
  if (!n || n.includes('@') || n.toLowerCase() === (email || '').toLowerCase()
      || /\d/.test(n) || n.length < 2) return 'there';
  const t = n.split(/\s+/)[0];
  return t[0].toUpperCase() + t.slice(1);
}

function renderBody(fn, downloadUrl) {
  return `Hi ${fn},

Just checking in. How is it going with your Atlas agents? If you have them running, I would love to hear how it is working. If you are stuck anywhere, reply and I will help.

If you still need to get set up, it takes about 10 minutes:

1. Download your team: ${downloadUrl}
2. Unzip it, then open the folder and say hi to Atlas.
3. New to this? The plain-English guide walks you through it: ${GUIDE}

Reply any time and a real person will help you get going.

Best,
Atlas
agent-atlas.co
`;
}

export default async (req) => {
  const url = new URL(req.url);
  const markOnly = url.searchParams.get('mode') === 'mark-only';
  const env = process.env;
  const now = Date.now();

  let leads;
  try { leads = await listAllLeads(); }
  catch (e) { console.error('[nudge-activation] list error', e); return new Response('list error', { status: 500 }); }

  // Base: real, free, not activated, not already nudged.
  const base = leads.filter((r) =>
    (r.tier || 'free') === 'free' && !r.atlasActivatedAt && !r.activationNudgeAt && isReal(r));
  // SEND mode also requires 48h since signup; MARK mode suppresses the whole cohort now.
  const eligible = markOnly
    ? base
    : base.filter((r) => r.createdAt && (now - new Date(r.createdAt).getTime()) >= FORTY_EIGHT_H);

  const batch = eligible.slice(0, CAP);
  const results = [];
  for (const r of batch) {
    if (markOnly) {
      try { await patchLead(r.license, { activationNudgeAt: new Date().toISOString(), activationNudgeMode: 'backfill' }); results.push({ email: r.email, marked: true }); }
      catch (e) { results.push({ email: r.email, error: String(e?.message || e) }); }
      continue;
    }
    try {
      const rl = await regenerateLink(r.license);
      if (!rl.ok) { results.push({ email: r.email, error: 'relink:' + rl.reason }); continue; }
      await sendMail(env, {
        to: r.email,
        subject: SUBJECT,
        text: renderBody(firstName(r.name, r.email), rl.downloadUrl),
        bcc: env.BCC_EMAIL,
      });
      await patchLead(r.license, { activationNudgeAt: new Date().toISOString() });
      results.push({ email: r.email, sent: true });
    } catch (e) {
      results.push({ email: r.email, error: String(e?.message || e) });
    }
  }

  console.log('[nudge-activation]', JSON.stringify({ eligible: eligible.length, processed: batch.length, markOnly, results }));
  return Response.json({ ok: true, eligible: eligible.length, processed: batch.length, markOnly, results });
};
