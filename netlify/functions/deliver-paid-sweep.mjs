// Safety-net sweep for PAID orders — Netlify SCHEDULED function, every 15 minutes
// (offset from the free sweep to spread load). Delivers any pending order the instant
// trigger missed (trigger failed, IPN-only order, mid-delivery crash leaving a stale
// claim). Runs in Netlify's cloud, so it does NOT depend on Gerald's laptop.
//
// deliverPaid() is idempotent (claim mutex + order status), so re-running over the
// pending list never double-sends.

import { listPendingOrders } from '../lib/orders-core.mjs';
import { deliverPaid } from '../lib/deliver-paid-core.mjs';

export const config = { schedule: '5,20,35,50 * * * *' };

export default async () => {
  const pending = await listPendingOrders();
  const results = [];
  // Sequential: paid volume is low; serial keeps SMTP + blob writes well within limits.
  for (const o of pending) {
    const r = await deliverPaid({ txnId: o.txnId });
    results.push({ txnId: o.txnId, ...r });
  }
  const delivered = results.filter((r) => r.ok).length;
  console.log('[deliver-paid-sweep]', JSON.stringify({ pending: pending.length, delivered, results }));
  return new Response(null, { status: 200 });
};
