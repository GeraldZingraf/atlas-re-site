// Pure kit-build + email-render helpers for cloud free-kit delivery.
//
// Ported 1:1 from the local Python pipeline so cloud and laptop produce byte-for-byte
// equivalent kits:
//   - build_kit.py / stage_build  -> buildKitZip (copy kit + stamp profile/license.json
//     + .atlas-license, then zip under a `free-<license>/` top folder)
//   - mailer.py / render_template -> renderEmail ({{token}} substitution; first
//     `Subject:` line becomes the subject)
//
// Kept free of @netlify/blobs / nodemailer imports ON PURPOSE: this module is the
// risky logic (zip + watermark + template holes), and isolating it means it can be
// unit-tested locally with only `fflate` installed, no Netlify runtime.

import { zipSync, strToU8 } from 'fflate';

// Build the watermarked Starter kit zip in memory.
//   assets.kit: { "<relpath>": "<base64 of file bytes>" }  (the immutable source kit)
// Returns { bytes: Uint8Array, filename }.
export function buildKitZip(assets, { license, email, tier = 'free', issuedAt, top, filename }) {
  if (!assets || !assets.kit) throw new Error('buildKitZip: assets.kit missing');
  // Top folder inside the zip (cosmetic). Defaults to the free convention so the
  // free path is unchanged; paid passes `paid-<sku>-<license>` explicitly.
  const topName = top || `free-${license}`;
  const files = {};

  // 1. The immutable source kit, decoded from base64, re-rooted under the top folder.
  for (const [rel, b64] of Object.entries(assets.kit)) {
    files[`${topName}/${rel}`] = new Uint8Array(Buffer.from(b64, 'base64'));
  }

  // 2. profile/license.json — C1 local license identity (overrides any template copy).
  const licenseJson = JSON.stringify(
    {
      license,
      email,
      tier,                         // "free" | "paid"
      issuedAt: issuedAt || '',
      pendingActivation: false,
    },
    null,
    2,
  ) + '\n';
  files[`${topName}/profile/license.json`] = strToU8(licenseJson);

  // 3. Top-level human-readable watermark (deterrence + traceability, not a hard lock).
  files[`${topName}/.atlas-license`] = strToU8(
    `Atlas-RE build watermark\nlicense: ${license}\ntier: ${tier}\n`,
  );

  const bytes = zipSync(files, { level: 6 });
  return { bytes, filename: filename || `Atlas_RE_Starter_${license}.zip` };
}

// Render an email template: first `Subject:` line -> subject (stripped from body),
// `{{token}}` placeholders filled from vars. Returns { subject, body, missing }.
// `missing` lists any tokens left unresolved so the caller can refuse a holey send.
export function renderEmail(template, vars) {
  if (typeof template !== 'string') throw new Error('renderEmail: template must be a string');
  let subject = '';
  const bodyLines = [];
  for (const line of template.split(/\r?\n/)) {
    if (!subject && /^\s*subject\s*:/i.test(line)) {
      subject = line.split(':').slice(1).join(':').trim();
      continue;
    }
    bodyLines.push(line);
  }
  let body = bodyLines.join('\n').trim() + '\n';

  const subst = (text) => {
    for (const [k, v] of Object.entries(vars)) {
      text = text.split(`{{${k}}}`).join(String(v));
    }
    return text;
  };
  subject = subst(subject);
  body = subst(body);

  const missing = [...new Set(
    [...(subject + body).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]),
  )];
  return { subject, body, missing };
}
