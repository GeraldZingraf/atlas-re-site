// Serve a buyer's kit zip from the "kits" store, given the download token.
// Public endpoint (the token is the secret). Marks first-download time, and
// expires the link 24h after that first download (also deletes the blob).
//
// GET /.netlify/functions/download-kit?t=<dlToken>

import { getStore } from '@netlify/blobs';

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 1 day after first download

export default async (req) => {
  const url = new URL(req.url);
  const t = url.searchParams.get('t');
  if (!t) return new Response('Missing token', { status: 400 });

  const store = getStore('kits');
  const rec = await store.get(t, { type: 'json' });
  if (!rec || !rec.b64) return new Response('This download link has expired or is invalid.', { status: 404 });

  // Expire 24h after the first download. Delete the blob and refuse the link.
  if (rec.downloadedAt) {
    const age = Date.now() - new Date(rec.downloadedAt).getTime();
    if (age > EXPIRY_MS) {
      try { await store.delete(t); } catch (_) {}
      return new Response('This download link has expired. Reply to your kit email for a fresh link.', { status: 410 });
    }
  } else {
    // First download — start the 24h clock.
    rec.downloadedAt = new Date().toISOString();
    try { await store.setJSON(t, rec); } catch (_) {}
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
