/* Meta (Facebook) Pixel for agent-atlas.co.
   Fires PageView on every page plus the right standard funnel event per page:
     landing      -> ViewContent
     checkout     -> InitiateCheckout (with sku value)
     thank-you    -> Purchase (value + currency; skipped for sandbox test orders)
   Drop the Pixel ID from Meta Events Manager into META_PIXEL_ID below. Until then
   this no-ops so nothing breaks. A pixel ID is public (it ships in page source on
   every site that uses Meta), so it is safe to commit. */
(function () {
  var META_PIXEL_ID = '1425933262885676'; // Atlas RE dataset, Events Manager

  if (!META_PIXEL_ID || META_PIXEL_ID === 'PASTE_META_PIXEL_ID') return; // not configured yet

  var params = new URLSearchParams(location.search);
  var path = location.pathname || '/';
  var isTest = params.get('test') === '1'; // sandbox order -> never report a real Purchase

  // Standard Meta Pixel base loader.
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ?
      n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
    n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', META_PIXEL_ID);
  fbq('track', 'PageView');

  var valueFor = function (sku) { return sku === 'broker' ? 1997 : 500; }; // solo default

  // Normalize the path so this works whether the host serves explicit files
  // (/checkout.html) or "pretty" URLs (/checkout). Netlify strips .html by
  // default, so the live funnel pages are /checkout and /thank-you with no
  // extension -- the old /checkout\.html$/ test never matched them, which is
  // why InitiateCheckout and Purchase silently never fired.
  var route = path.replace(/\.html$/, '').replace(/\/index$/, '/');

  if (route === '/checkout') {
    var sku = params.get('sku') || '';
    fbq('track', 'InitiateCheckout', { value: valueFor(sku), currency: 'USD', content_name: sku || 'unknown' });
  } else if (route === '/thank-you') {
    if (!isTest) {
      var psku = params.get('sku') || '';
      // Prefer the authoritative order amount carried from capture-order (?amt=);
      // fall back to the sku-based default so a legacy/sku-less URL still reports.
      var amt = parseFloat(params.get('amt'));
      var pvalue = (isFinite(amt) && amt > 0) ? amt : valueFor(psku);
      // eventID = txn so this dedups against the server-side CAPI Purchase
      // (same event_id = txnId). Meta collapses the two into one conversion.
      var txn = params.get('txn') || '';
      fbq(
        'track',
        'Purchase',
        { value: pvalue, currency: 'USD', content_name: psku || 'unknown' },
        txn ? { eventID: txn } : undefined
      );
    }
  } else if (route === '/' || route === '') {
    fbq('track', 'ViewContent');
  }
})();
