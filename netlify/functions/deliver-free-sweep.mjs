// Safety-net sweep — Netlify SCHEDULED function, every 15 minutes. Catches any free
// lead the instant trigger missed (trigger failed, signup happened before deploy, a
// mid-delivery crash that left a stale claim). Combined with the on-signup trigger,
// worst-case delivery is one sweep interval (<15 min); typical is seconds. Runs in
// Netlify's cloud, so it does NOT depend on Gerald's laptop being on.
//
// deliverFree() is idempotent (claim mutex + freeFulfilledAt), so re-running over the
// pending list never double-sends.

import { listPendingFree } from '../lib/leads-core.mjs';
import { deliverFree } from '../lib/deliver-free-core.mjs';

export const config = { schedule: '*/15 * * * *' };

export default async () => {
  const pending = await listPendingFree(); // tier=free, no freeFulfilledAt, not stopped
  const results = [];
  // Sequential on purpose: free-signup volume is low, and serial keeps SMTP + blob
  // writes well within the function's limits without a concurrency cap to tune.
  for (const lead of pending) {
    const r = await deliverFree({ license: lead.license });
    results.push({ email: lead.email, ...r });
  }
  const delivered = results.filter((r) => r.ok).length;
  console.log('[deliver-free-sweep]', JSON.stringify({ pending: pending.length, delivered, results }));
  return new Response(null, { status: 200 });
};
