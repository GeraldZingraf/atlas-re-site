// Shared helpers for the paid `orders` blob store — the order-side analog of
// leads-core. Used by the cloud paid-delivery functions so the order queue logic
// lives in one place (mirrors orders.mjs's inline list/mark, plus a delivery mutex).
//
// Strong consistency: the claim mutex must see its own write so a concurrent
// trigger + sweep don't both deliver the same order.
//
// `storeName` lets callers target the isolated 'orders-test' store for end-to-end
// tests; it defaults to the live 'orders' store. (The live store is what track.mjs
// reads for revenue and what the laptop watcher polls, so 'orders-test' is invisible
// to both.)

import { getStore } from '@netlify/blobs';

const ALLOWED_STORES = new Set(['orders', 'orders-test']);
const ordersStore = (storeName = 'orders') => {
  const name = ALLOWED_STORES.has(storeName) ? storeName : 'orders';
  return getStore({ name, consistency: 'strong' });
};

export async function getOrder(txnId, storeName = 'orders') {
  if (!txnId) return null;
  return await ordersStore(storeName).get(txnId, { type: 'json' });
}

// Pending orders (status === 'pending'), oldest first. Small store — full scan ok.
export async function listPendingOrders(storeName = 'orders') {
  const store = ordersStore(storeName);
  const out = [];
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : undefined);
    for (const b of page.blobs) {
      const o = await store.get(b.key, { type: 'json' });
      if (o && o.status === 'pending') out.push(o);
    }
    cursor = page.cursor;
  } while (cursor);
  out.sort((a, b) => (a.receivedAt || '').localeCompare(b.receivedAt || ''));
  return out;
}

// Delivery mutex: ok:true to exactly one caller. Skips if already fulfilled or
// another delivery claimed it within `staleMs` (a crashed attempt frees up so the
// sweep retries). Mirrors leads-core.claimFreeDelivery.
export async function claimOrderDelivery(txnId, staleMs = 10 * 60 * 1000, storeName = 'orders') {
  const store = ordersStore(storeName);
  const o = await store.get(txnId, { type: 'json' });
  if (!o) return { ok: false, reason: 'order_not_found' };
  if (o.status === 'fulfilled') return { ok: false, reason: 'already_fulfilled' };
  const claimedAt = o.deliveringAt ? new Date(o.deliveringAt).getTime() : 0;
  if (claimedAt && (Date.now() - claimedAt) < staleMs) return { ok: false, reason: 'in_progress' };
  o.deliveringAt = new Date().toISOString();
  await store.setJSON(txnId, o);
  return { ok: true, order: o };
}

export async function markOrderFulfilled(txnId, storeName = 'orders') {
  const store = ordersStore(storeName);
  const o = await store.get(txnId, { type: 'json' });
  if (!o) return null;
  o.status = 'fulfilled';
  o.fulfilledAt = new Date().toISOString();
  await store.setJSON(txnId, o);
  return o;
}

// Record a delivery failure on the order so it's visible via orders.mjs (?txn=)
// without needing Netlify function logs.
export async function recordOrderError(txnId, message, storeName = 'orders') {
  const store = ordersStore(storeName);
  const o = await store.get(txnId, { type: 'json' });
  if (!o) return;
  o.lastDeliveryError = (message || '').toString().slice(0, 500);
  o.lastDeliveryAttemptAt = new Date().toISOString();
  await store.setJSON(txnId, o);
}
