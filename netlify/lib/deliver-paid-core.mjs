// Cloud PAID-kit delivery — the always-on replacement for the laptop's
// marry_purchase.py (the order-watcher flow). A paid sibling of deliver-free-core.
//
// deliverPaid() runs entirely inside Netlify: marry the buyer's license free->paid,
// build the licensed Solo/Broker kit in memory, store it in the kits blob (license
// stamped), send the branched welcome (paid-match / paid-nomatch), then mark BOTH the
// lead (paidFulfilledAt) and the order (status: fulfilled). Two callers share it:
//   - deliver-paid-background.mjs : fired by capture-order.mjs the instant a purchase clears
//   - deliver-paid-sweep.mjs      : a scheduled safety-net for any order the trigger missed
//
// No prefiller. The paid kits self-personalize via their in-product onboarding ramp
// (realtor-ramp.md Phase 0 runs its own discovery when no pre-fill banner is present),
// so cloud delivery needs no Claude runtime — same rationale as free.
//
// Idempotent: claimOrderDelivery() is the mutex, and markOrderFulfilled() drops the
// order out of listPendingOrders() so neither the sweep nor the laptop order-watcher
// re-delivers it.

import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

import { marry, markFulfilled } from './leads-core.mjs';
import { buildKitZip, renderEmail } from './kit-build.mjs';
import { getOrder, claimOrderDelivery, markOrderFulfilled, recordOrderError } from './orders-core.mjs';

const ASSETS_STORE = 'delivery-assets';
const KITS_STORE = 'kits';
const VALID_SKU = new Set(['solo', 'broker']);

async function loadPaidKit(sku) {
  const k = await getStore(ASSETS_STORE).get(`kit-${sku}`, { type: 'json' });
  if (!k || !k.files) throw new Error(`paid kit '${sku}' not uploaded — run push_delivery_assets.py`);
  return k.files;
}

async function loadPaidEmails() {
  const e = await getStore(ASSETS_STORE).get('paid-emails', { type: 'json' });
  if (!e) throw new Error('paid email templates not uploaded — run push_delivery_assets.py');
  return e;
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

// Deliver a paid kit for one order (identified by txnId). Returns a structured
// result; never throws.
export async function deliverPaid({ txnId } = {}) {
  const env = process.env;
  if (!txnId) return { ok: false, reason: 'missing_txnId' };

  let order;
  try { order = await getOrder(txnId); }
  catch (e) { return { ok: false, reason: 'order_lookup_error', error: String(e?.message || e) }; }
  if (!order) return { ok: false, reason: 'order_not_found', txnId };
  if (order.status === 'fulfilled') return { ok: false, reason: 'already_fulfilled', txnId };

  const sku = VALID_SKU.has(order.sku) ? order.sku : null;
  if (!sku) return { ok: false, reason: `unknown_sku:${order.sku}`, txnId };
  if (!order.email) return { ok: false, reason: 'order_missing_email', txnId };

  // Mutex: only one caller proceeds.
  const claim = await claimOrderDelivery(txnId);
  if (!claim.ok) return { ok: false, reason: claim.reason, txnId };

  try {
    // 1. Marry free->paid. If a free lead matches this email, its license upgrades in
    //    place (so everything they built on the free agents carries over); else a new
    //    paid license is minted. `matched` chooses the welcome copy.
    const m = await marry({ email: order.email, txnId });
    const license = m.record.license;
    const matched = !!m.matched;

    // 2. Build the licensed paid kit (Solo or Broker source).
    const files = await loadPaidKit(sku);
    const { bytes, filename } = buildKitZip({ kit: files }, {
      license,
      email: order.email,
      tier: 'paid',
      issuedAt: new Date().toISOString(),
      top: `paid-${sku}-${license}`,
      filename: `Atlas_RE_${sku === 'broker' ? 'Broker' : 'Solo'}_${license}.zip`,
    });

    // 3. Store in the kits blob WITH the license (download-kit.mjs traceability).
    const dlToken = crypto.randomBytes(16).toString('hex');
    await getStore(KITS_STORE).setJSON(dlToken, {
      dlToken, filename, b64: Buffer.from(bytes).toString('base64'), license, tier: 'paid',
    });

    const base = env.URL || 'https://agent-atlas.co';
    const downloadUrl = `${base}/.netlify/functions/download-kit?t=${dlToken}`;
    const guideUrl = env.INSTALL_GUIDE_URL || 'https://agent-atlas.co/install-guide.html';

    // 4. Branched welcome: paid-match (free version found) vs paid-nomatch.
    const emails = await loadPaidEmails();
    const tplKey = matched ? 'welcome-paid-match' : 'welcome-paid-nomatch';
    const tpl = emails[tplKey];
    if (!tpl) throw new Error(`paid email '${tplKey}' missing from delivery-assets`);
    const firstName = (order.name && order.name.trim().split(/\s+/)[0]) || 'there';
    const { subject, body, missing } = renderEmail(tpl, {
      first_name: firstName,
      name: order.name || '',
      download_url: downloadUrl,
      guide_url: guideUrl,
      license,
    });
    // Only download_url/license are load-bearing across both variants; guide_url is
    // paid-nomatch-only and checkout_url is unused in paid.
    const blocking = missing.filter((x) => x !== 'checkout_url' && x !== 'guide_url');
    if (blocking.length) throw new Error(`${tplKey} unresolved placeholders: ${blocking.join(', ')}`);

    // 5. Send + stamp fulfillment on BOTH the lead and the order.
    await sendWelcome(env, order.email, subject, body);
    await markFulfilled({ license, which: 'paid' });
    await markOrderFulfilled(txnId);

    return { ok: true, txnId, sku, license, matched, email: order.email, downloadUrl };
  } catch (e) {
    const msg = String(e?.stack || e?.message || e);
    console.error('[deliver-paid] delivery_error', txnId, msg);
    try { await recordOrderError(txnId, msg); } catch (_) {}
    return { ok: false, reason: 'delivery_error', error: msg, txnId };
  }
}
