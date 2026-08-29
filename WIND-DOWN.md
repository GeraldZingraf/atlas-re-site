# agent-atlas.co: wind-down note (2026-08-28)

Atlas for Real Estate was wound down on 2026-08-28. The business took $0 revenue across both
its eras (the pay-once kit, then the SaaS trial funnel this site served). The LLC is kept and
the product is pivoting; the full record lives in `WIND-DOWN.md` at the root of the
`atlas-a11y/atlas-platform` repo.

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
