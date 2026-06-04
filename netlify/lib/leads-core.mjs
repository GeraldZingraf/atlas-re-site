// Shared core for the leads / license store (contracts C2 + C3 + C5).
//
// One record per email in the "leads" blob store; a "license-index" blob maps
// license -> email for O(1) license lookups. This module is the single place that
// knows the record shape, the license format, and the cap logic, so the four
// functions that touch leads (leads.mjs, subscribe.mjs, activate.mjs,
// download-kit.mjs) all agree.
//
// It lives in netlify/lib (NOT netlify/functions), so esbuild bundles it into the
// importing functions but never exposes it as its own endpoint.

import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';

// --- caps (C2, FROZEN) -------------------------------------------------------
export const FREE_DOWNLOAD_CAP = 2;     // free kit: 2 pulls per license
export const PAID_ACTIVATION_CAP = 2;   // paid license: 2 device activations

// C2: AR- prefix + 8 uppercase base32 chars, excluding ambiguous 0 O 1 I L.
const LICENSE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export const normalizeEmail = (e) => (e || '').trim().toLowerCase();
const clip = (v, n) => (v || '').toString().trim().slice(0, n);

// Strong consistency: license uniqueness + free->paid marriage are correctness-
// sensitive, and the cost is one slightly-slower get of a small blob.
const leadsStore = () => getStore({ name: 'leads', consistency: 'strong' });
const indexStore = () => getStore({ name: 'license-index', consistency: 'strong' });

// The blob key for a record: email when we have one, else the license itself
// (direct-to-paid with no email still gets a stable home).
const keyOf = (rec) => normalizeEmail(rec.email) || rec.license;

function newLicenseCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += LICENSE_ALPHABET[crypto.randomInt(LICENSE_ALPHABET.length)];
  return `AR-${s}`;
}

async function uniqueLicense() {
  for (let i = 0; i < 8; i++) {
    const lic = newLicenseCode();
    const taken = await indexStore().get(lic, { type: 'text' });
    if (!taken) return lic;
  }
  return newLicenseCode(); // astronomically unlikely to reach here
}

async function saveLead(rec) {
  const key = keyOf(rec);
  await leadsStore().setJSON(key, rec);
  await indexStore().set(rec.license, key); // keep the index in sync (idempotent)
  return rec;
}

function freshRecord({ license, email, name, website, source, tier }) {
  return {
    license,
    email: normalizeEmail(email),
    name: clip(name, 120),       // captured at signup for kit pre-personalization (C3)
    website: clip(website, 200), // optional; the pre-filler researches it
    source: (source || 'direct').toString().toLowerCase().slice(0, 40),
    tier: tier || 'free',
    createdAt: new Date().toISOString(),
    activations: 0,
    downloads: 0,
    devices: [],         // { hint, at } per distinct activated device (C5)
    activationLog: [],   // append-only audit trail (C5 "logged")
  };
}

// --- reads -------------------------------------------------------------------
export async function getByEmail(email) {
  const key = normalizeEmail(email);
  if (!key) return null;
  return await leadsStore().get(key, { type: 'json' });
}

export async function getByLicense(license) {
  if (!license) return null;
  const email = await indexStore().get(license, { type: 'text' });
  if (!email) return null;
  return await leadsStore().get(email, { type: 'json' });
}

// --- create / get (C3 POST create-lead; idempotent on email) -----------------
// On an existing record, backfill name/website ONLY where they were blank, so a
// later signup can fill in what an earlier one missed without overwriting good data.
export async function createOrGetLead({ email, name, website, source }) {
  const key = normalizeEmail(email);
  if (!key) throw new Error('missing_email');
  const existing = await leadsStore().get(key, { type: 'json' });
  if (existing) {
    const n = clip(name, 120), w = clip(website, 200);
    let changed = false;
    if (n && !existing.name) { existing.name = n; changed = true; }
    if (w && !existing.website) { existing.website = w; changed = true; }
    if (changed) await saveLead(existing);
    return { record: existing, created: false };
  }
  const license = await uniqueLicense();
  const record = freshRecord({ license, email: key, name, website, source, tier: 'free' });
  await saveLead(record);
  return { record, created: true };
}

// --- marry free -> paid at purchase (C3 ?action=marry) -----------------------
export async function marry({ email, txnId }) {
  const existing = await getByEmail(email);
  if (existing) {
    existing.tier = 'paid';
    if (txnId) existing.txnId = txnId;
    existing.paidAt = new Date().toISOString();
    await saveLead(existing);
    return { record: existing, matched: true };
  }
  // No match -> direct-to-paid: create a fresh paid record + license.
  const license = await uniqueLicense();
  const record = freshRecord({ license, email, source: 'direct', tier: 'paid' });
  if (txnId) record.txnId = txnId;
  record.paidAt = new Date().toISOString();
  await saveLead(record);
  return { record, matched: false };
}

// --- mark fulfilled (C3 ?action=fulfilled) -----------------------------------
export async function markFulfilled({ license, which }) {
  const rec = await getByLicense(license);
  if (!rec) return null;
  rec[which === 'paid' ? 'paidFulfilledAt' : 'freeFulfilledAt'] = new Date().toISOString();
  await saveLead(rec);
  return rec;
}

// --- download cap (C5) -------------------------------------------------------
// Meter a pull. Free licenses are refused past FREE_DOWNLOAD_CAP (C2: 2 pulls),
// so a shared/exhausted link returns download_limit. Paid licenses are counted
// for traceability but never refused here — paid is gated by the 2-activation
// flow, not a download cap (C2). download-kit.mjs calls this only when the kit
// record carries a license (Delivery opt-in); legacy kits are unaffected.
export async function meterDownload(license) {
  const rec = await getByLicense(license);
  if (!rec) return { ok: false, reason: 'unknown_license' };
  const current = rec.downloads || 0;
  if (rec.tier !== 'paid' && current >= FREE_DOWNLOAD_CAP) {
    return { ok: false, reason: 'download_limit', cap: FREE_DOWNLOAD_CAP, downloads: current };
  }
  rec.downloads = current + 1;
  await saveLead(rec);
  return { ok: true, downloads: rec.downloads, tier: rec.tier };
}

// --- activation (C5) ---------------------------------------------------------
// Distinct devices are capped at PAID_ACTIVATION_CAP. A device we've seen before
// (same deviceHint) re-activates freely and is logged — a legit reinstall never
// strands the buyer; only a NEW 3rd device trips the limit (the anti-sharing
// throttle). Offline grace/reconcile lives in INSTALL.md (Product); this endpoint
// is the server-side source of truth it reconciles against.
export async function recordActivation({ license, deviceHint }) {
  const rec = await getByLicense(license);
  if (!rec) return { ok: false, reason: 'not_found', status: 404 };
  if (rec.tier !== 'paid') return { ok: false, reason: 'not_paid', status: 403 };

  rec.devices = rec.devices || [];
  rec.activationLog = rec.activationLog || [];
  const hint = (deviceHint || '').toString().slice(0, 120);
  const now = new Date().toISOString();
  const known = hint && rec.devices.some((d) => d.hint === hint);

  if (known) {
    rec.activationLog.push({ at: now, hint, kind: 'reactivation' });
    await saveLead(rec);
    return { ok: true, reactivation: true, activationsLeft: Math.max(0, PAID_ACTIVATION_CAP - rec.devices.length) };
  }
  if (rec.devices.length >= PAID_ACTIVATION_CAP) {
    rec.activationLog.push({ at: now, hint, kind: 'denied_limit' });
    await saveLead(rec);
    return { ok: false, reason: 'activation_limit', activationsLeft: 0 };
  }
  rec.devices.push({ hint, at: now });
  rec.activations = (rec.activations || 0) + 1;
  rec.activationLog.push({ at: now, hint, kind: 'activation' });
  await saveLead(rec);
  return { ok: true, reactivation: false, activationsLeft: Math.max(0, PAID_ACTIVATION_CAP - rec.devices.length) };
}

// Project a record down to C3's documented public shape (drops internal fields
// like devices/activationLog from API responses).
export function publicShape(rec) {
  if (!rec) return null;
  const { license, email, name, website, source, tier, createdAt, paidAt, txnId,
          freeFulfilledAt, paidFulfilledAt, activations, downloads } = rec;
  return { license, email, name: name || '', website: website || '', source, tier, createdAt,
           paidAt, txnId, freeFulfilledAt, paidFulfilledAt, activations: activations || 0, downloads: downloads || 0 };
}

// --- pending-free list (C3 GET ?pending=free) --------------------------------
// Mirrors orders.mjs list-pending. Powers the local free-lead watcher: the leads
// the pre-filler + deliver_free still need to act on. Full scan is fine here —
// the leads store is small (mirrors orders' full scan).
async function listAllLeads() {
  const store = leadsStore();
  const out = [];
  let cursor;
  do {
    const page = await store.list(cursor ? { cursor } : undefined);
    for (const b of page.blobs) {
      const rec = await store.get(b.key, { type: 'json' });
      if (rec) out.push(rec);
    }
    cursor = page.cursor;
  } while (cursor);
  return out;
}

export async function listPendingFree() {
  const pending = (await listAllLeads())
    .filter((r) => r.tier === 'free' && !r.freeFulfilledAt && !r.stopped)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); // oldest first
  return pending.map(publicShape);
}
