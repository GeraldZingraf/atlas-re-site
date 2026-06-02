/* Google tag (gtag.js) for agent-atlas.co — Google Ads conversion tracking (funnel C).
   The Google Ads account (101-388-7891) uses a PAGE-LOAD conversion named "Purchase"
   that fires when /thank-you.html loads. So all this needs to do is put the account's
   base Google tag on every page: it captures the gclid on the landing page (so a
   conversion can be attributed to the ad click) and lets Google count the conversion
   when the thank-you page loads. No per-event label is needed for a page-load conversion.

   Include this on EVERY page (after pixel.js). The Conversion/Tag ID is public (it ships
   in page source), so it is safe to commit.

   Note: a page-load conversion records the conversion-action's default value ($1) and
   counts page loads, not real order values. Real per-channel revenue / CAC / ROAS for the
   GTM test come from the first-party tracker (bySource -> Dashboard), not from Google Ads. */
(function () {
  var GOOGLE_TAG_ID = 'AW-18206381858'; // Agent Atlas, account 101-388-7891

  var params = new URLSearchParams(location.search);
  // Don't count sandbox/test purchases: skip the tag on a test thank-you load so the
  // page-load conversion does not fire for ?test=1 orders.
  if (/thank-you\.html$/.test(location.pathname) && params.get('test') === '1') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_TAG_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag('js', new Date());
  gtag('config', GOOGLE_TAG_ID);
})();
