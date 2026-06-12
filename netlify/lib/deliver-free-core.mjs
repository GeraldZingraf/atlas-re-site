// Cloud free-kit delivery — the always-on replacement for the laptop's deliver_free.py.
//
// deliverFree() runs entirely inside Netlify: build the watermarked Starter kit in
// memory, store it in the kits blob (license-stamped, so download-kit.mjs meters the
// pull and the "Did they download?" signal works), email the lean welcome, and mark
// the lead free-fulfilled. Two callers share this one function:
//   - deliver-free-background.mjs : fired by subscribe.mjs the instant someone signs up
//   - deliver-free-sweep.mjs      : a */15 scheduled safety-net for any lead the trigger missed
//
// Idempotent: claimFreeDelivery() is the mutex, and markFulfilled() drops the lead out
// of listPendingFree() so neither the sweep nor the old laptop watcher re-delivers it.
//
// Personalization note: free kits ship STANDARD (license-stamped only). The kit
// personalizes itself via its in-product onboarding ramp on first launch, so cloud
// delivery needs no Claude runtime. (Paid pre-fill stays in the local lane.)

import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
// nodemailer is imported dynamically inside sendWelcome() so a bundling/resolution
// failure surfaces as a catchable runtime error (recorded on the lead) rather than
// crashing the whole function at module load.

import { getByEmail, getByLicense, claimFreeDelivery, markFulfilled, recordDeliveryError, patchLead } from './leads-core.mjs';
import { buildKitZip, renderEmail } from './kit-build.mjs';

const ASSETS_STORE = 'delivery-assets';   // base kit + email templates (pushed by push_delivery_assets.py)
const KITS_STORE = 'kits';                // per-lead built zips (served by download-kit.mjs)
const SEQUENCE_STORE = 'sequence-state';  // nurture/Friday enrollment (consumed by the sequence senders)

async function loadAssets() {
  const a = await getStore(ASSETS_STORE).get('current', { type: 'json' });
  if (!a || !a.kit || !a.emails) {
    throw new Error('delivery-assets not uploaded — run push_delivery_assets.py');
  }
  return a;
}

async function sendWelcome(env, to, subject, body) {
  const sender = env.ATLAS_EMAIL;
  const pass = env.ATLAS_APP_PASSWORD;
  if (!sender || !pass) throw new Error('ATLAS_EMAIL / ATLAS_APP_PASSWORD not set in Netlify env');
  const nodemailer = (await import('nodemailer')).default;
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(env.SMTP_PORT || '587', 10),
    secure: false,
    requireTLS: true,
    auth: { user: sender, pass },
  });
  await transport.sendMail({
    from: `Atlas <${sender}>`,
    to,
    bcc: env.BCC_EMAIL || undefined,
    subject,
    text: body,
  });
}

// Best-effort: seed the nurture/Friday sequence state so follow-ups pick the lead up.
// Never throws — enrollment is not on the delivery critical path.
async function recordEnrollment(rec) {
  try {
    const store = getStore(SEQUENCE_STORE);
    if (await store.get(rec.email, { type: 'json' })) return; // already enrolled
    await store.setJSON(rec.email, {
      email: rec.email,
      name: rec.name || '',
      license: rec.license,
      source: rec.source || 'direct',
      enrolledAt: new Date().toISOString(),
      nurtureSent: {},
      fridaySent: {},
      stopped: false,
    });
  } catch (_) { /* non-critical */ }
}

// Deliver the free Starter to one lead. Identify by email (instant trigger) or
// license (sweep). Returns a structured result; never throws.
export async function deliverFree({ email, license: licenseIn } = {}) {
  const env = process.env;

  let rec;
  try {
    rec = licenseIn ? await getByLicense(licenseIn) : await getByEmail(email);
  } catch (e) {
    return { ok: false, reason: 'lead_lookup_error', error: String(e?.message || e) };
  }
  if (!rec) return { ok: false, reason: 'lead_not_found' };
  if (rec.tier && rec.tier !== 'free') return { ok: false, reason: 'not_free_tier', license: rec.license };

  const license = rec.license;

  // Mutex: only one caller proceeds past here.
  const claim = await claimFreeDelivery(license);
  if (!claim.ok) return { ok: false, reason: claim.reason, license };

  try {
    const assets = await loadAssets();

    // 1. Build the watermarked kit in memory.
    const { bytes, filename } = buildKitZip(assets, {
      license,
      email: rec.email,
      tier: 'free',
      issuedAt: new Date().toISOString(),
    });

    // 2. Store it in the kits blob WITH the license, so download-kit.mjs meters pulls
    //    (the per-license cap + the downloads counter behind "Did they download?").
    const dlToken = crypto.randomBytes(16).toString('hex');
    await getStore(KITS_STORE).setJSON(dlToken, {
      dlToken,
      filename,
      b64: Buffer.from(bytes).toString('base64'),
      license,
      tier: 'free',
    });
    try { await patchLead(license, { lastDlToken: dlToken }); } catch (_) {}

    const base = env.URL || 'https://agent-atlas.co';
    const downloadUrl = `${base}/.netlify/functions/download-kit?t=${dlToken}`;
    const guideUrl = env.INSTALL_GUIDE_URL || 'https://agent-atlas.co/install-guide.html';

    // 3. Stamp fulfillment + enroll for nurture FIRST. The download link is the kit's
    //    real delivery channel now (returned to the page and downloadable on the spot),
    //    so the kit counts as delivered the moment it's built and stored — independent
    //    of whether the welcome email lands. This is the "bad email" fix: a bounced or
    //    fake address can no longer strand the buyer or trigger an endless sweep retry.
    await markFulfilled({ license, which: 'free' });
    await recordEnrollment(rec);

    // 4. Welcome email — BEST-EFFORT backup copy of the same download link. A render or
    //    SMTP failure is recorded on the lead but never fails delivery (the page already
    //    has the link). The email reuses the SAME dlToken, so on-page + email share one
    //    metered cap.
    try {
      const tpl = assets.emails['welcome-free'];
      if (!tpl) throw new Error('welcome-free template missing from delivery-assets');
      const firstName = (rec.name && rec.name.trim().split(/\s+/)[0]) || 'there';
      const { subject, body, missing } = renderEmail(tpl, {
        first_name: firstName,
        name: rec.name || '',
        download_url: downloadUrl,
        guide_url: guideUrl,
        license,
        checkout_url: 'https://agent-atlas.co/checkout.html?sku=solo',
      });
      // Only the optional upsell token may be unused; download/guide/license must resolve.
      const blocking = missing.filter((m) => m !== 'checkout_url');
      if (blocking.length) throw new Error(`welcome-free has unresolved placeholders: ${blocking.join(', ')}`);
      await sendWelcome(env, rec.email, subject, body);
    } catch (mailErr) {
      const msg = String(mailErr?.stack || mailErr?.message || mailErr);
      console.error('[deliver-free] email_error (non-fatal)', license, msg);
      try { await recordDeliveryError(license, `email (non-fatal): ${msg}`); } catch (_) {}
    }

    return { ok: true, license, email: rec.email, downloadUrl };
  } catch (e) {
    // Delivery failed AFTER claiming. The claim goes stale in 10 min, so the next sweep
    // retries automatically. Surface the error to the function log AND onto the lead
    // record (readable via the leads API, since we can't reach Netlify logs locally).
    const msg = String(e?.stack || e?.message || e);
    console.error('[deliver-free] delivery_error', license, msg);
    try { await recordDeliveryError(license, msg); } catch (_) {}
    return { ok: false, reason: 'delivery_error', error: msg, license };
  }
}

// Rebuild a fresh download link for an existing FREE license, WITHOUT re-sending the
// welcome or touching fulfillment. Used by re-engagement: the kit is rebuilt from the
// current assets (so it includes the latest SessionStart activation hook) and stored
// under a new token. Returns { ok, downloadUrl } or { ok:false }.
export async function regenerateLink(license) {
  if (!license) return { ok: false, reason: 'missing_license' };
  const rec = await getByLicense(license);
  if (!rec) return { ok: false, reason: 'lead_not_found' };
  try {
    const assets = await loadAssets();
    const { bytes, filename } = buildKitZip(assets, {
      license, email: rec.email, tier: 'free', issuedAt: new Date().toISOString(),
    });
    const dlToken = crypto.randomBytes(16).toString('hex');
    await getStore(KITS_STORE).setJSON(dlToken, {
      dlToken, filename, b64: Buffer.from(bytes).toString('base64'), license, tier: 'free',
    });
    try { await patchLead(license, { lastDlToken: dlToken }); } catch (_) {}
    const base = process.env.URL || 'https://agent-atlas.co';
    return { ok: true, downloadUrl: `${base}/.netlify/functions/download-kit?t=${dlToken}` };
  } catch (e) {
    return { ok: false, reason: 'build_error', error: String(e?.message || e) };
  }
}
