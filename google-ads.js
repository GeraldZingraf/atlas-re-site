/* Google Ads conversion tracking for agent-atlas.co (funnel C / G).
   Mirrors the Meta pixel funnel layer (pixel.js) on the Google side:
     free signup  -> Lead      conversion  (analog of fbq('track','Lead'))
     thank-you    -> Purchase  conversion  (analog of fbq('track','Purchase'):
                                            real value + currency + transaction_id dedup)
   plus the account base Google tag on EVERY page (captures the gclid so a conversion
   can be attributed to the ad click) and Enhanced Conversions user_data on the Lead
   (the Google analog of Meta Advanced Matching — gtag hashes it in the browser).

   Conversion LABELS come from the Google Ads UI: open the conversion action ->
   "Tag setup" -> "Use Google tag", and the event snippet shows send_to as
   'AW-18206381858/<LABEL>'. Paste the two <LABEL> values below. Until a label is set
   (still 'PASTE_...'), that conversion NO-OPS, so this is safe to commit and deploy
   before the actions exist — nothing fires until the labels are in.

   The tag ID and labels are public (they ship in page source on every site that uses
   Google Ads), so committing them is fine.

   Include on EVERY page (after pixel.js), as it already is on
   index / checkout / free-starter / thank-you / refund. */
(function () {
  var GOOGLE_TAG_ID  = 'AW-18206381858';      // Agent Atlas, account 101-388-7891
  var LEAD_LABEL     = 'WmhBCMnqxbkcEKKuvelD'; // Conversion action: Lead - Free Signup
  var PURCHASE_LABEL = '605ACOnTxrkcEKKuvelD'; // Conversion action: Purchase - gtag event (paid order)

  var params = new URLSearchParams(location.search);
  var path = location.pathname || '/';
  // Normalize so this works for both explicit (/thank-you.html) and Netlify "pretty"
  // (/thank-you) URLs — same fix pixel.js needed.
  var route = path.replace(/\.html$/, '').replace(/\/index$/, '/');
  var isTest = params.get('test') === '1'; // sandbox order -> never count a real conversion

  // Skip the tag entirely on a sandbox test thank-you load, so no Purchase is counted
  // for ?test=1 orders (matches the old page-load behavior and pixel.js).
  if (route === '/thank-you' && isTest) return;

  // --- base Google tag (every page): load gtag, config the account, capture gclid ---
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GOOGLE_TAG_ID;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  gtag('js', new Date());
  // allow_enhanced_conversions lets the user_data we set on the Lead ride with the
  // conversion (gtag hashes it client-side). The real on/off switch is the account
  // toggle: Google Ads -> Goals -> Settings -> Enhanced conversions (Google tag method).
  gtag('config', GOOGLE_TAG_ID, { allow_enhanced_conversions: true });

  // Persist the gclid first-touch (the Google analog of Meta's _fbc cookie) so a later
  // server-side conversion upload (Tier 2) can tie the order back to the ad click.
  // Harmless and unused under Tier 1; just makes Tier 2 a drop-in later.
  try {
    var gclid = params.get('gclid');
    if (gclid && !localStorage.getItem('aa_gclid')) localStorage.setItem('aa_gclid', gclid);
  } catch (e) {}

  var configured = function (label) { return label && label.indexOf('PASTE_') !== 0; };
  var valueFor = function (sku) { return sku === 'broker' ? 1997 : 500; }; // solo default

  // Lead conversion — called from the free-starter form AFTER the lead is stored
  // (right next to fbq('track','Lead')). Passes Enhanced Conversions user_data
  // (email + name); gtag normalizes and hashes it in the browser before it leaves.
  // No-ops until LEAD_LABEL is set.
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

  // Purchase conversion — fires on the real (non-test) thank-you load, mirroring the
  // Meta pixel Purchase: real order value (prefer ?amt= carried from capture-order,
  // else the sku default), currency, and transaction_id = the PayPal txn. The txn id
  // makes Google de-dup a thank-you refresh and (Tier 2) a future server-side upload
  // of the same order. No-ops until PURCHASE_LABEL is set.
  if (route === '/thank-you' && configured(PURCHASE_LABEL)) {
    var psku = params.get('sku') || '';
    var amt = parseFloat(params.get('amt'));
    var pvalue = (isFinite(amt) && amt > 0) ? amt : valueFor(psku);
    var txn = params.get('txn') || '';
    var ev = { send_to: GOOGLE_TAG_ID + '/' + PURCHASE_LABEL, value: pvalue, currency: 'USD' };
    if (txn) ev.transaction_id = txn;
    gtag('event', 'conversion', ev);
  }
})();
