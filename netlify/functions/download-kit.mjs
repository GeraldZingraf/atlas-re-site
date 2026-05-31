// Serve a buyer's kit zip from the "kits" store, given the download token.
// Public endpoint (the token is the secret). Marks first-download time.
//
// GET /.netlify/functions/download-kit?t=<dlToken>

import { getStore } from '@netlify/blobs';

export default async (req) => {
  const url = new URL(req.url);
  const t = url.searchParams.get('t');
  if (!t) return new Response('Missing token', { status: 400 });

  const store = getStore('kits');
  const rec = await store.get(t, { type: 'json' });
  if (!rec || !rec.b64) return new Response('Not found or expired', { status: 404 });

  // Best-effort: record first download time.
  if (!rec.downloadedAt) {
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
