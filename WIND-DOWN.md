# agent-atlas.co: wind-down note (2026-08-28)

Atlas for Real Estate was wound down on 2026-08-28. The LLC is kept and the product is
pivoting; the full record lives in `WIND-DOWN.md` at the root of the `atlas-a11y/atlas-platform`
repo.

**Revenue (settled 2026-08-29):** $0 from real customers across both eras. A prod audit found
one subscription that converted from trial to paid on 2026-08-21 and was never canceled, but
Gerald confirmed it is his own throwaway test account, still charging his card until he cancels
it. No third party was ever billed.

**This site still sells.** The landing CTAs point at `/start`, which hands off to
`app.agent-atlas.co/login?mode=signup`, and signup takes a card. That purchase path must be cut
before the app is torn down, or a stranger can start a card-required trial for a product that
is being deleted. The old PayPal kit buttons are already gone from `index.html`, so PayPal is
not exposed. When the Render service is deleted, delete the `app.agent-atlas.co` DNS record at
the same time: a CNAME left pointing at a deprovisioned host is a subdomain-takeover risk on a
domain that is being kept.

## What this repo is

The agent-atlas.co marketing site (Netlify): the landing page (`index.html`), the `/start`
pre-sell bridge (`start.html`), legal pages, and the serverless functions (`netlify/`) that
powered lead capture (`/leads`), event tracking (`/track`), and the `/go/<channel>`
attribution redirects. `analytics.js`, `pixel.js` (Meta CAPI), and `google-ads.js` carry the
attribution plumbing.

## Site-specific facts worth remembering

- The funnel's final diagnosis (2026-08-04): the app's create-account form was the wall.
  The `/start` bridge fixed the CTA-to-signup handoff (12 bridge_continue), but 15 signup
  views produced 0 accounts after it shipped.
- `/track` measurement traps: the `checkouts` metric counts CTA clicks, not trial starts
  (56 clicks vs 1 real trial); Bearer-header auth 401s (use `?token=`); one GET can return
  partial data while the 80-event lazy backfill is pending. Real trial/paid truth was prod
  Supabase, never this endpoint.
- "Failed to find Server Action" errors in the logs are scanner-bot probes, not lost signups.
- The site stays live for now: the domain, brand, and DMARC p=reject posture carry forward to
  the pivot.

## Final state of this working tree (committed with this note)

- `assets/` (the three app screenshots referenced by `index.html`) had never been committed;
  they are now.
- `saas-rebuild-copy.md` had been deleted locally but never committed as deleted; it is
  restored, since this repo is now an archive and the staged copy is part of the record.
