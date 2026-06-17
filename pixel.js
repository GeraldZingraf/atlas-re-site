/* Meta (Facebook) Pixel for agent-atlas.co (SaaS funnel).
   Fires PageView on every page, ViewContent on the landing page, and Lead when a
   visitor clicks "Start free trial" (the high-intent hand-off to the app signup).

     landing            -> ViewContent
     click Start trial  -> Lead   (intent; signup completes in the app)

   The real StartTrial (registration complete) and Subscribe (paid conversion) events
   fire SERVER-SIDE from the app, the same way the old one-time Purchase fired from
   capture-order via CAPI, deduped by a stable event_id. They are intentionally NOT
   fired from this static marketing site, which cannot know when signup/subscription
   actually completes.

   A pixel ID is public (it ships in page source), so it is safe to commit. */
(function () {
  var META_PIXEL_ID = '1425933262885676'; // Atlas RE dataset, Events Manager

  if (!META_PIXEL_ID || META_PIXEL_ID === 'PASTE_META_PIXEL_ID') return; // not configured yet

  var path = location.pathname || '/';

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

  // Normalize the path so this works whether the host serves explicit files or
  // Netlify "pretty" URLs (no extension).
  var route = path.replace(/\.html$/, '').replace(/\/index$/, '/');

  if (route === '/' || route === '') {
    fbq('track', 'ViewContent');
  }

  // Lead on the "Start free trial" CTA click (links marked data-trial; the app has no
  // /signup route, registration is on /login, so we mark trial CTAs explicitly). Fired once.
  var fired = false;
  document.addEventListener('click', function (ev) {
    if (fired) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[data-trial]') : null;
    if (!a) return;
    fired = true;
    fbq('track', 'Lead', { content_name: 'start_free_trial' });
  }, true);
})();
