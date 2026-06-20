/* Google Ads conversion tracking for agent-atlas.co (SaaS funnel).
   Mirrors the Meta pixel funnel layer (pixel.js) on the Google side:
     click Start trial -> Lead conversion  (analog of fbq('track','Lead'))
   plus the account base Google tag on EVERY page (captures the gclid so a conversion
   can be attributed to the ad click) and Enhanced Conversions plumbing.

   The Subscribe (paid) conversion fires SERVER-SIDE from the app on a Stripe
   subscription, the same way the old one-time Purchase did, deduped by transaction_id.
   It is intentionally NOT fired from this static marketing site.

   Conversion LABELS come from the Google Ads UI (conversion action -> Tag setup).
   Until a label is set (still 'PASTE_...'), that conversion NO-OPS, so this is safe to
   commit/deploy before the actions exist. The tag ID and labels are public.

   Include on EVERY page (after pixel.js). */
(function () {
  var GOOGLE_TAG_ID  = 'AW-18206381858';      // Agent Atlas, account 101-388-7891
  var LEAD_LABEL     = 'WmhBCMnqxbkcEKKuvelD'; // Conversion action: Lead - Start Free Trial
  // SUBSCRIBE conversion fires server-side from the app (Tier 2 upload), not here.

  var params = new URLSearchParams(location.search);

  // --- base Google tag (every page): load gtag, config the account, capture gclid ---
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_TAG_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  // allow_enhanced_conversions lets user_data set on the Lead ride with the conversion
  // (gtag hashes it client-side). Real on/off is the account toggle.
  gtag('config', GOOGLE_TAG_ID, { allow_enhanced_conversions: true });

  // Persist the gclid first-touch so a later server-side conversion upload (the app's
  // Subscribe) can tie the subscription back to the ad click. Harmless if unused.
  try {
    var gclid = params.get('gclid');
    if (gclid && !localStorage.getItem('aa_gclid')) localStorage.setItem('aa_gclid', gclid);
  } catch (e) {}

  var configured = function (label) { return label && label.indexOf('PASTE_') !== 0; };

  // Lead conversion. Exposed so the app's signup page can call it AFTER registration
  // with Enhanced Conversions user_data (email + name); gtag normalizes and hashes it
  // in the browser. No-ops until LEAD_LABEL is set.
  window.aaGoogleLead = function (email, name) {
    if (!configured(LEAD_LABEL)) return;
    if (email || name) {
      var ud = {};
      if (email) ud.email = String(email).trim().toLowerCase();
      if (name) {
        var parts = String(name).trim().split(/\s+/);
        ud.first_name = parts.shift() || '';
        if (parts.length) ud.last_name = parts.join(' ');
      }
      gtag('set', 'user_data', ud);
    }
    gtag('event', 'conversion', { send_to: GOOGLE_TAG_ID + '/' + LEAD_LABEL });
  };

  // Fire the Lead conversion on the "Start free trial" CTA click (links marked data-trial;
  // the app has no /signup route, registration is on /login). No user_data here (no form on
  // the marketing site); the app can re-fire aaGoogleLead with email/name after registration
  // for Enhanced Conversions. Fired once.
  var fired = false;
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[data-trial]') : null;
    if (!a) return;
    // Carry the first-touch gclid to the app signup URL so the app's server-side
    // conversion upload can attribute the trial/subscription to the ad click.
    // Done in the capture phase BEFORE navigation, on every click (independent of
    // the once-only conversion fire below). Only when present; never overwrite an
    // existing gclid param.
    try {
      var g = localStorage.getItem('aa_gclid');
      if (g && a.href && a.href.indexOf('gclid=') === -1) {
        a.href += (a.href.indexOf('?') === -1 ? '?' : '&') + 'gclid=' + encodeURIComponent(g);
      }
    } catch (e) {}
    if (fired) return;
    fired = true;
    window.aaGoogleLead();
  }, true);
})();
