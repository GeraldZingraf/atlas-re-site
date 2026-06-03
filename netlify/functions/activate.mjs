// Activation endpoint (contract C5). Gives the paid license real (soft) teeth at
// the only enforceable point — server-side. Called once by the paid kit's
// INSTALL.md (Product) before unboxing, and again to reconcile an offline grace
// activation.
//
//   POST /.netlify/functions/activate  { license, deviceHint? }
//     -> { ok:true, activationsLeft, reactivation }   (paid, under/at device cap)
//     -> { ok:false, reason:"activation_limit" }      (new 3rd device)
//     -> { ok:false, reason:"not_paid" }               (free / unknown tier)
//
// Token-guarded with ORDERS_TOKEN (same secret as orders.mjs). The honest scope:
// this deters casual multi-device sharing and logs every activation; a legit
// buyer reinstalling on a known device re-activates freely and is never stranded.

import { recordActivation } from '../lib/leads-core.mjs';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const url = new URL(req.url);
  const token = req.headers.get('x-orders-token') || url.searchParams.get('token');
  if (!token || token !== process.env.ORDERS_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try { body = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  const license = (body?.license || '').toString().trim();
  if (!license) return Response.json({ ok: false, error: 'Missing license' }, { status: 400 });

  const result = await recordActivation({ license, deviceHint: body?.deviceHint });

  if (!result.ok) {
    // not_found -> 404, not_paid -> 403, activation_limit -> 200 (a normal,
    // expected business answer the caller branches on, not a transport error).
    const status = result.status || (result.reason === 'activation_limit' ? 200 : 400);
    return Response.json({ ok: false, reason: result.reason, activationsLeft: result.activationsLeft ?? 0 }, { status });
  }
  return Response.json({ ok: true, activationsLeft: result.activationsLeft, reactivation: !!result.reactivation });
};
