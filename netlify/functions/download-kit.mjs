// Serve a buyer's kit zip from the "kits" store, given the download token.
// Public endpoint (the token is the secret). Marks first-download time, and
// expires the link 24h after that first download (also deletes the blob).
//
// When the kit record carries a `license` (Delivery opt-in via upload-kit), each
// served pull is metered against the per-license download cap (C5). Free licenses
// are refused past 2 pulls (so a shared link / exhausted token gets a clear
// "limit reached" instead of the bytes); paid licenses are counted but not
// download-capped (paid is gated by the 2-activation flow, not downloads, per C2).
// Kits without a license keep the legacy 24h-expiry-only behavior.
//
// GET /.netlify/functions/download-kit?t=<dlToken>

import { getStore } from '@netlify/blobs';
import { meterDownload } from '../lib/leads-core.mjs';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day after first download

export default async (req) => {
  const url = new URL(req.url);
  const t = url.searchParams.get('t');
  if (!t) return new Response('Missing token', { status: 400 });

  const store = getStore('kits');
  const rec = await store.get(t, { type: 'json' });
  if (!rec || !rec.b64) return new Response('This download link has expired or is invalid.', { status: 404 });

  // Expire 24h after the first download. Delete the blob and refuse the link.
  // (Checked before metering so an expired-link hit never burns a download pull.)
  if (rec.downloadedAt) {
    const age = Date.now() - new Date(rec.downloadedAt).getTime();
    if (age > EXPIRY_MS) {
      try { await store.delete(t); } catch (_) {}
      return new Response('This download link has expired. Reply to your kit email for a fresh link.', { status: 410 });
    }
  }

  // Per-license download cap (C5). Meters EVERY served pull when Delivery stamped
  // a license on the kit, so a shared link exhausts the free 2-pull cap and then
  // returns "limit reached". Paid is counted but never refused here (activation is
  // the paid gate). Kits with no license skip this entirely.
  let metered = null;
  if (rec.license) {
    metered = await meterDownload(rec.license);
    if (!metered.ok) {
      const msg = metered.reason === 'download_limit'
        ? 'Download limit reached for this license. Buy your own copy or contact support for a reset.'
        : 'This download link is invalid.';
      return new Response(msg, { status: 403 });
    }
  }

  // First download — start the 24h link-lifetime clock.
  const isFirstDownload = !rec.downloadedAt;
  if (isFirstDownload) {
    rec.downloadedAt = new Date().toISOString();
    try { await store.setJSON(t, rec); } catch (_) {}
  }

  // Funnel telemetry — fire a server-side `kit_download` event on the FIRST pull of
  // each kit token, so the analytics rollup (track.mjs) can count unique downloaders:
  // the step between lead_capture (form submit) and viewed_guide (opened install
  // guide). Deduped by license in the rollup, so re-pulls don't double-count and a
  // shared link can't inflate it. Channel-attributed via the lead's source. A
  // telemetry write must NEVER block serving the bytes — best-effort, swallowed.
  if (isFirstDownload) {
    try {
      const ev = {
        type: 'kit_download',
        sku: (metered && metered.tier) || 'free',
        sessionId: '',                                  // server-side; no browser session
        source: (metered && metered.source) || 'direct',
        path: '/download-kit',
        meta: rec.license || `tok-${t}`,                // dedup key for the rollup
        ts: new Date().toISOString(),
      };
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      await getStore('events').setJSON(key, ev);
    } catch (_) {}
  }

  const bytes = Buffer.from(rec.b64, 'base64');
  return new Response(bytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${rec.filename}"`,
      'Cache-Control': 'no-store',
    },
  });
};
