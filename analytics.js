/* First-party funnel analytics for agent-atlas.co.
   No cookies, no third-party scripts, no PII. A random sessionId in localStorage
   ties a visitor's events together so we can measure the funnel:
     page_view -> cta_click -> checkout_start -> purchase
   plus scroll depth (where the page loses people). Beacons to /track.
   Drop-in: <script src="/analytics.js" defer></script> on every page. */
(function () {
  var ENDPOINT = '/.netlify/functions/track';

  // Stable per-visitor id (random, not identifying).
  var sid;
  try {
    sid = localStorage.getItem('aa_sid');
    if (!sid) {
      sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
      localStorage.setItem('aa_sid', sid);
    }
  } catch (e) { sid = 'nostore'; }

  var path = location.pathname || '/';
  var params = new URLSearchParams(location.search);

  // First-touch source attribution. The first utm_source we ever see for this
  // visitor wins and is persisted; pure-direct visitors are "direct". This is
  // what lets the funnel rollup split visits/checkouts/buyers by channel.
  var SOURCE;
  try {
    var stored = localStorage.getItem('aa_src');
    var utm = (params.get('utm_source') || '').toLowerCase().slice(0, 40);
    if (!stored && utm) { localStorage.setItem('aa_src', utm); stored = utm; }
    SOURCE = stored || utm || 'direct';
  } catch (e) {
    SOURCE = (params.get('utm_source') || 'direct').toLowerCase().slice(0, 40);
  }

  function send(type, sku, meta) {
    var payload = JSON.stringify({ type: type, sku: sku || '', sessionId: sid, source: SOURCE, path: path, meta: meta || '' });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
        return;
      }
    } catch (e) {}
    // Fallback for browsers without sendBeacon.
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
  }

  // Expose a tiny tracker so page scripts can emit funnel events through the same
  // pipeline (e.g. the capture form fires lead_capture after the email POST
  // succeeds — C4). No PII ever passes through here; email goes only to the
  // subscribe/leads function.
  try { window.aaTrack = send; } catch (e) {}

  // 1) Page view on every load.
  send('page_view');

  // 2) Funnel stages (SaaS). The three tracker stages stay visits -> "checkout" ->
  // "purchase"; in the SaaS funnel that maps to visits -> trial-start -> subscription,
  // so the existing bySource rollup + Dashboard keep working unchanged.
  //  - 'checkout_start' now fires on the "Start free trial" CTA click (intent, below).
  //  - 'purchase' (= a paid subscription) is sent SERVER-SIDE from the app on the
  //    Stripe subscription, the same way ground-truth orders used to. Not fired here.

  // 3) CTA clicks — the "Start free trial" links (marked data-trial; the app has no
  // /signup route, registration is on /login). Fire 'checkout_start' (trial-start intent)
  // so the channel funnel's middle stage stays populated, plus a 'cta_click'.
  var startedTrial = false;
  document.addEventListener('click', function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest('a[data-trial]') : null;
    if (!a) return;
    // Carry first-party attribution across the domain hop to app.agent-atlas.co
    // (localStorage does not cross origins). Append the sid + first-touch source to
    // the trial CTA so the app can join the signup back to this visit and channel.
    // Capture phase, before navigation; never overwrite a param already present.
    try {
      if (a.href) {
        var extra = [];
        if (a.href.indexOf('aa_src=') === -1) extra.push('aa_src=' + encodeURIComponent(SOURCE));
        if (a.href.indexOf('aa_sid=') === -1) extra.push('aa_sid=' + encodeURIComponent(sid));
        if (extra.length) a.href += (a.href.indexOf('?') === -1 ? '?' : '&') + extra.join('&');
      }
    } catch (e) {}
    send('cta_click', '', 'start_free_trial');
    if (!startedTrial) { startedTrial = true; send('checkout_start', '', 'start_free_trial'); }
  }, true);

  // 4) Scroll depth — fire each threshold once per page load.
  var marks = [25, 50, 75, 100];
  var hit = {};
  function onScroll() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return;
    var pct = Math.min(100, Math.round(((window.scrollY || doc.scrollTop) / scrollable) * 100));
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i];
      if (pct >= m && !hit[m]) { hit[m] = 1; send('scroll_depth', '', String(m)); }
    }
    if (hit[100]) window.removeEventListener('scroll', onScroll);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
