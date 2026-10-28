// agent-atlas.co: the word reel and Atlas, the card deck, the stickers, the split-flap board.
// Every animation here is decoration: the real text is already in the page.
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isDesktop = () => window.matchMedia("(min-width: 720px)").matches;

  let openDialog = () => {};
  const onOpen = {};
  const onClose = {};

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Hero: the cycling word; Atlas stands a little taller with each one ---------- */
  const reel = document.querySelector("[data-reel]");
  const atlas = document.querySelector("[data-atlas]");
  if (reel && !reduce) {
    const last = reel.children.length - 1;
    let i = 0;
    reel.style.setProperty("--i", "0");
    const step = () => {
      i += 1;
      reel.style.setProperty("--i", String(i));
      if (atlas) atlas.style.setProperty("--relief", String(i * 2));
      if (i < last) setTimeout(step, i === last - 1 ? 2100 : 1700);
    };
    setTimeout(step, 1500);
  }

  /* ---------- How it works: the deck ---------- */
  const deck = document.querySelector("[data-deck]");
  if (deck) {
    const card = deck.querySelector("[data-card]");
    const slides = Array.from(deck.querySelectorAll(".slide"));
    const cur = deck.querySelector("[data-cur]");
    const live = deck.querySelector("[data-live]");
    let index = 0;
    let typing = null;
    let seen = false;
    let busy = false;

    // Overlay the slide with a copy whose text types itself out. The original
    // stays in place (transparent) so layout and screen readers never change.
    const prepare = (slide) => {
      const full = slide.querySelector(".full");
      const typed = full.cloneNode(true);
      typed.classList.remove("full");
      typed.classList.add("typed");
      typed.setAttribute("aria-hidden", "true");
      typed.querySelectorAll(".btn").forEach((b) => b.remove());

      const walker = document.createTreeWalker(typed, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) {
        const n = walker.currentNode;
        if (n.textContent.trim()) {
          nodes.push({ node: n, text: n.textContent.replace(/\s+/g, " ").trim() });
          n.textContent = "";
        } else {
          n.textContent = "";
        }
      }
      const caret = document.createElement("span");
      caret.className = "caret";
      (nodes[0] ? nodes[0].node.parentNode : typed).appendChild(caret);

      full.classList.add("ghost");
      slide.appendChild(typed);

      let timer = null;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        typed.remove();
        full.classList.remove("ghost");
      };
      const start = () => {
        let n = 0;
        let c = 0;
        const tick = () => {
          if (done) return;
          const item = nodes[n];
          if (!item) { timer = setTimeout(finish, 500); return; }
          c += 1 + (Math.random() < 0.6 ? 1 : 0);
          item.node.textContent = item.text.slice(0, c);
          item.node.parentNode.appendChild(caret);
          if (c >= item.text.length) { n += 1; c = 0; timer = setTimeout(tick, 70); return; }
          const ch = item.text[c - 1];
          timer = setTimeout(tick, /[.,:]/.test(ch) ? 60 : 10 + Math.random() * 8);
        };
        timer = setTimeout(tick, 160);
      };
      return { start, finish };
    };

    const type = (slide, startNow) => {
      if (typing) typing.finish();
      typing = null;
      if (reduce) return;
      typing = prepare(slide);
      if (startNow) typing.start();
    };

    const show = (next) => {
      if (busy) return;
      const target = (next + slides.length) % slides.length;
      if (target === index) return;
      if (typing) typing.finish();
      busy = true;
      const swap = () => {
        slides[index].classList.remove("is-active");
        index = target;
        slides[index].classList.add("is-active");
        cur.textContent = String(index + 1);
        deck.dataset.left = String(Math.min(4, slides.length - 1 - index));
        live.textContent = `Card ${index + 1} of ${slides.length}`;
        card.classList.remove("is-out");
        if (!reduce) {
          card.classList.add("is-in");
          setTimeout(() => card.classList.remove("is-in"), 450);
        }
        type(slides[index], true);
        busy = false;
      };
      if (reduce) { swap(); return; }
      card.classList.add("is-out");
      setTimeout(swap, 200);
    };

    deck.querySelector("[data-next]").addEventListener("click", () => show(index + 1));
    deck.querySelector("[data-prev]").addEventListener("click", () => show(index - 1));

    // Click the card while it types to see the whole thing at once.
    card.addEventListener("click", (e) => {
      if (e.target.closest("button, a")) return;
      if (typing) typing.finish();
    });

    // Arrow keys: when the deck has focus, or when it's on screen.
    document.addEventListener("keydown", (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      const box = card.getBoundingClientRect();
      const onScreen = box.top < window.innerHeight * 0.8 && box.bottom > window.innerHeight * 0.2;
      if (!onScreen && !deck.contains(document.activeElement)) return;
      e.preventDefault();
      show(index + (e.key === "ArrowRight" ? 1 : -1));
    });

    // Swipe (touch, pen, or a mouse drag on the card).
    let sx = null;
    let sy = 0;
    card.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button, a")) return;
      sx = e.clientX;
      sy = e.clientY;
    });
    const endSwipe = (e) => {
      if (sx === null) return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) show(index + (dx < 0 ? 1 : -1));
    };
    card.addEventListener("pointerup", endSwipe);
    card.addEventListener("pointercancel", () => { sx = null; });

    // The first card waits, blank with a caret, until the deck is on screen.
    type(slides[0], false);
    const startWhenSeen = () => {
      if (seen) return;
      const box = card.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.7 && box.bottom > window.innerHeight * 0.2) {
        seen = true;
        window.removeEventListener("scroll", startWhenSeen);
        if (typing) typing.start();
      }
    };
    window.addEventListener("scroll", startWhenSeen, { passive: true });
    startWhenSeen();
  }

  /* ---------- Stickers: they drift, react when clicked, and can be dragged ---------- */
  const stickers = Array.from(document.querySelectorAll(".sticker"));

  // Click or tap: the sticker does its trick and says one short line.
  // Keep the speech bubble on screen: anchor it to the sticker's inner side.
  const say = (el) => {
    if (!el.dataset.say) return;
    const box = el.getBoundingClientRect();
    const mid = box.left + box.width / 2;
    el.classList.toggle("say-left", mid < window.innerWidth * 0.3);
    el.classList.toggle("say-right", mid > window.innerWidth * 0.7);
    el.classList.add("saying");
    clearTimeout(el.sayTimer);
    el.sayTimer = setTimeout(() => el.classList.remove("saying"), 2400);
  };

  // The compass takes a lap of the screen, spinning, then comes home.
  const runLap = (el) => {
    if (el.running) return;
    const art = el.querySelector(".sticker-art");
    const r = art.getBoundingClientRect();
    if (reduce || !art.animate) { say(el); return; }
    el.running = true;
    const runner = art.cloneNode(true);
    runner.className = "compass-runner";
    runner.style.width = `${r.width}px`;
    runner.style.height = `${r.height}px`;
    document.body.appendChild(runner);
    el.classList.add("away");
    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = r.width;
    const pad = 16;
    const stops = [
      [r.left, r.top],
      [W - w - pad, 84],
      [W - w - pad * 2, H * 0.55],
      [W - w - pad, H - w - pad],
      [W * 0.5 - w / 2, H - w - pad * 2],
      [pad, H - w - pad],
      [pad * 2, H * 0.45],
      [pad, 84],
      [W * 0.4, H * 0.25],
      [r.left, r.top],
    ];
    const lap = runner.animate(
      stops.map(([x, y], i) => ({ transform: `translate(${x}px, ${y}px) rotate(${i * 140}deg)` })),
      { duration: 3800, easing: "ease-in-out" },
    );
    lap.onfinish = () => {
      runner.remove();
      el.classList.remove("away");
      el.running = false;
      say(el);
    };
  };

  const react = (el) => {
    el.classList.add("is-touched");
    if (el.dataset.fx === "run") { el.classList.remove("nudge"); runLap(el); return; }
    if (el.dataset.open) {
      const art = el.querySelector(".sticker-art");
      const fx = `fx-${el.dataset.fx || "pop"}`;
      if (!reduce) {
        art.classList.remove(fx);
        void art.offsetWidth;
        art.classList.add(fx);
        art.addEventListener("animationend", () => art.classList.remove(fx), { once: true });
      }
      setTimeout(() => openDialog(el.dataset.open), reduce ? 0 : 380);
      return;
    }
    el.classList.remove("nudge");
    const art = el.querySelector(".sticker-art");
    const fx = `fx-${el.dataset.fx || "pop"}`;
    if (!reduce) {
      art.classList.remove(fx);
      void art.offsetWidth; // restart the animation on repeat clicks
      art.classList.add(fx);
      art.addEventListener("animationend", () => art.classList.remove(fx), { once: true });
    }
    say(el);
  };

  stickers.forEach((el) => {
    // Each one drifts on its own rhythm until someone touches it.
    el.style.setProperty("--dur", `${(4.5 + Math.random() * 3).toFixed(2)}s`);
    el.style.setProperty("--delay", `${(-Math.random() * 6).toFixed(2)}s`);
    const bubble = document.createElement("span");
    bubble.className = "sticker-say";
    bubble.textContent = el.dataset.say || "";
    el.appendChild(bubble);
    if (el.dataset.chip) {
      const chip = document.createElement("span");
      chip.className = "sticker-chip";
      chip.textContent = el.dataset.chip;
      el.appendChild(chip);
    }

    let ox = 0;
    let oy = 0;
    let sx = 0;
    let sy = 0;
    let px = 0;
    let py = 0;
    let down = false;
    let dragging = false;

    el.addEventListener("pointerdown", (e) => {
      down = true;
      px = e.clientX;
      py = e.clientY;
      sx = e.clientX - ox;
      sy = e.clientY - oy;
      if (isDesktop()) {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
      }
    });
    el.addEventListener("pointermove", (e) => {
      if (!down || !isDesktop()) return;
      if (!dragging && Math.hypot(e.clientX - px, e.clientY - py) < 6) return;
      if (!dragging) {
        dragging = true;
        el.classList.add("is-dragging", "is-touched");
        el.classList.remove("saying", "nudge");
      }
      ox = e.clientX - sx;
      oy = e.clientY - sy;
      el.style.setProperty("--dx", `${ox}px`);
      el.style.setProperty("--dy", `${oy}px`);
    });
    el.addEventListener("pointerup", () => {
      if (!down) return;
      down = false;
      if (dragging) {
        dragging = false;
        el.classList.remove("is-dragging");
        el.style.setProperty("--r", `${(Math.random() * 18 - 9).toFixed(1)}deg`);
      } else {
        react(el);
      }
    });
    el.addEventListener("pointercancel", () => {
      down = false;
      dragging = false;
      el.classList.remove("is-dragging");
    });
  });

  // Every few seconds, one untouched sticker gives a little wiggle to invite a click.
  if (!reduce && stickers.length) {
    const how = document.querySelector(".how");
    setInterval(() => {
      if (document.hidden || !how) return;
      const box = how.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) return;
      const idle = stickers.filter((s) => !s.classList.contains("is-touched") && s.getClientRects().length > 0);
      if (!idle.length) return;
      const pick = idle[Math.floor(Math.random() * idle.length)];
      pick.classList.add("nudge");
      setTimeout(() => pick.classList.remove("nudge"), 950);
    }, 3200);
  }

  /* ---------- Agents at work: a bird's-eye workflow, animated ---------- */
  const flow = document.querySelector("[data-flow]");
  if (flow) {
    const canvas = flow.querySelector("[data-flow-canvas]");
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs, parent) => {
      const n = document.createElementNS(NS, tag);
      Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v));
      if (parent) parent.appendChild(n);
      return n;
    };

    // Small line icons, drawn around (0, 0) at roughly 22 units across.
    const ICONS = {
      mail: "M-10 -6 H10 V6 H-10 Z M-10 -6 L0 2 L10 -6",
      text: "M-10 -7 H10 V4 H-2 L-7 8 V4 H-10 Z",
      star: "M0 -9 L2.6 -3 L9 -2.6 L4 1.6 L5.6 8 L0 4.6 L-5.6 8 L-4 1.6 L-9 -2.6 L-2.6 -3 Z",
      chart: "M-9 7 V-1 M-3 7 V-7 M3 7 V-3 M9 7 V2 M-11 7 H11",
      box: "M-9 -4 L0 -9 L9 -4 V6 L0 10 L-9 6 Z M-9 -4 L0 1 L9 -4 M0 1 V10",
      cal: "M-9 -5 H9 V8 H-9 Z M-9 -1 H9 M-4 -9 V-3 M4 -9 V-3",
      clock: "M0 0 m-9 0 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0 M0 -5 V0 L4 3",
      ledger: "M-8 -9 H8 V9 H-8 Z M-4 -4 H4 M-4 0 H4 M-4 4 H1",
      doc: "M-7 -9 H4 L8 -5 V9 H-7 Z M-3 -2 H4 M-3 2 H4 M-3 6 H1",
      person: "M0 -5 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M-8 9 C-8 2 8 2 8 9",
      send: "M-9 0 L9 -7 L4 8 L1 2 Z M1 2 L9 -7",
      phone: "M-5 -10 H5 V10 H-5 Z M-2 7 H2",
      coin: "M0 0 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 M0 -4 V4 M-3 -2 H2 M-2 2 H3",
      cart: "M-10 -7 H-6 L-3 4 H7 L9 -3 H-5 M-2 8 h0.1 M5 8 h0.1",
      bell: "M-6 4 V-1 C-6 -6 6 -6 6 -1 V4 L8 6 H-8 Z M-2 8 H2",
      check: "M-7 0 L-2 5 L7 -5",
    };

    // The map. Each node has a wide position [x, y] and a phone position.
    const N = [
      // systems they already use
      { id: "s-mail", k: "source", i: "mail", l: "Email", w: [55, 50], t: [50, 60] },
      { id: "s-text", k: "source", i: "text", l: "Texts", w: [150, 90], t: [150, 60] },
      { id: "s-rev", k: "source", i: "star", l: "Reviews", w: [55, 130], t: [250, 60] },
      { id: "s-pos", k: "source", i: "chart", l: "Sales", w: [150, 170], t: [350, 60] },
      { id: "s-inv", k: "source", i: "box", l: "Inventory", sl: "Stock", w: [55, 210], t: [50, 150] },
      { id: "s-cal", k: "source", i: "cal", l: "Calendar", w: [150, 250], t: [150, 150] },
      { id: "s-time", k: "source", i: "clock", l: "Timeclock", w: [55, 290], t: [250, 150] },
      { id: "s-acct", k: "source", i: "ledger", l: "Accounting", sl: "Books", w: [150, 330], t: [350, 150] },
      // agents
      { id: "a-reply", k: "agent", i: "mail", l: "Replies", sl: "Replies", w: [330, 50], t: [50, 300] },
      { id: "a-rev", k: "agent", i: "star", l: "Reviews", sl: "Reviews", w: [440, 90], t: [150, 300] },
      { id: "a-score", k: "agent", i: "chart", l: "Scorecard", sl: "Numbers", w: [330, 130], t: [250, 300] },
      { id: "a-order", k: "agent", i: "cart", l: "Ordering", sl: "Orders", w: [440, 170], t: [350, 300] },
      { id: "a-prep", k: "agent", i: "doc", l: "Meeting prep", sl: "Prep", w: [330, 210], t: [50, 400] },
      { id: "a-sched", k: "agent", i: "cal", l: "Scheduling", sl: "Shifts", w: [440, 250], t: [150, 400] },
      { id: "a-pay", k: "agent", i: "clock", l: "Payroll", sl: "Payroll", w: [330, 290], t: [250, 400] },
      { id: "a-coll", k: "agent", i: "coin", l: "Collections", sl: "Collect", w: [440, 330], t: [350, 400] },
      // coordinator and you
      { id: "hub", k: "hub", l: "Coordinator", w: [612, 190], t: [160, 560] },
      { id: "you", k: "decision", i: "person", l: "You decide", w: [748, 262], t: [240, 690] },
      // work shipped
      { id: "o-reply", k: "output", i: "send", l: "Replies sent", sl: "Replied", w: [860, 50], t: [70, 820] },
      { id: "o-rev", k: "output", i: "star", l: "Reviews answered", sl: "Reviewed", w: [950, 90], t: [70, 890] },
      { id: "o-refund", k: "output", i: "coin", l: "Refund issued", sl: "Refund", w: [860, 210], t: [330, 820] },
      { id: "o-order", k: "output", i: "cart", l: "Order placed", sl: "Ordered", w: [950, 250], t: [330, 890] },
      { id: "o-shifts", k: "output", i: "cal", l: "Shifts posted", sl: "Shifts", w: [860, 290], t: [330, 960] },
      { id: "o-pay", k: "output", i: "check", l: "Payroll ready", sl: "Payroll", w: [950, 330], t: [330, 1030] },
      { id: "o-remind", k: "output", i: "bell", l: "Reminders sent", sl: "Chased", w: [860, 130], t: [70, 960] },
      { id: "o-report", k: "output", i: "phone", l: "Report to you", sl: "Report", w: [950, 170], t: [70, 1030] },
    ];
    const FEEDS = [
      ["s-mail", "a-reply"], ["s-text", "a-reply"], ["s-rev", "a-rev"], ["s-pos", "a-score"], ["s-pos", "a-order"],
      ["s-inv", "a-order"], ["s-cal", "a-prep"], ["s-cal", "a-sched"], ["s-time", "a-sched"], ["s-time", "a-pay"],
      ["s-acct", "a-coll"], ["s-acct", "a-pay"],
    ];
    // Agents talking to each other.
    const TALK = [
      ["a-rev", "a-reply"], ["a-score", "a-rev"], ["a-score", "a-order"], ["a-order", "a-prep"],
      ["a-prep", "a-sched"], ["a-order", "a-sched"], ["a-sched", "a-pay"], ["a-coll", "a-pay"],
    ];
    const AGENTS = N.filter((n) => n.k === "agent").map((n) => n.id);
    const ASKED = ["o-refund", "o-order", "o-shifts", "o-pay"]; // need your OK
    const DIRECT = ["o-reply", "o-rev", "o-remind", "o-report"]; // routine, shipped by the coordinator

    const EDGES = [
      ...FEEDS.map(([a, b]) => ({ id: `${a}>${b}`, a, b, kind: "feed" })),
      ...TALK.map(([a, b]) => ({ id: `${a}>${b}`, a, b, kind: "talk" })),
      ...AGENTS.map((a) => ({ id: `${a}>hub`, a, b: "hub", kind: "report" })),
      { id: "hub>you", a: "hub", b: "you", kind: "ask" },
      ...ASKED.map((o) => ({ id: `you>${o}`, a: "you", b: o, kind: "ship" })),
      ...DIRECT.map((o) => ({ id: `hub>${o}`, a: "hub", b: o, kind: "ship" })),
    ];

    // One morning, on a loop: [ms, edge id, packet kind, duration].
    const LOOP = 12500;
    const SCRIPT = [];
    FEEDS.forEach(([a, b], i) => SCRIPT.push([i * 130, `${a}>${b}`, "info", 1100]));
    TALK.forEach(([a, b], i) => SCRIPT.push([2700 + i * 260, `${a}>${b}`, "talk", 1000]));
    AGENTS.forEach((a, i) => SCRIPT.push([4300 + i * 170, `${a}>hub`, "info", 1000]));
    SCRIPT.push([6500, "hub>you", "ask", 900], [6900, "hub>you", "ask", 900]);
    DIRECT.forEach((o, i) => SCRIPT.push([7000 + i * 220, `hub>${o}`, "ship", 1100]));
    SCRIPT.push([8000, "decide", "you", 0]);
    ASKED.forEach((o, i) => SCRIPT.push([8500 + i * 200, `you>${o}`, "ship", 1000]));
    SCRIPT.sort((x, y) => x[0] - y[0]);

    let layout = null;
    let svg = null;
    let paths = {};
    let nodesEl = {};
    const counts = {};

    const R = { source: 18, output: 18, agent: 21, hub: 34, decision: 25 };
    const label = (n, wide) => (!wide && n.sl ? n.sl : n.l);

    const build = () => {
      const wide = canvas.clientWidth >= 640;
      const key = wide ? "w" : "t";
      if (layout === key && svg) return;
      layout = key;
      canvas.textContent = "";
      svg = mk("svg", { viewBox: wide ? "0 0 1010 380" : "0 0 400 1075" }, canvas);
      const gEdges = mk("g", {}, svg);
      const gNodes = mk("g", {}, svg);
      svg.packets = mk("g", {}, svg);
      paths = {};
      nodesEl = {};
      const byId = Object.fromEntries(N.map((n) => [n.id, n]));
      const below = { source: 20, output: 20, agent: 22, hub: 26, decision: 34 }; // label room under a node

      EDGES.forEach((e) => {
        const na = byId[e.a];
        const nb = byId[e.b];
        const [x1, y1] = na[key];
        const [x2, y2] = nb[key];
        let d;
        if (e.kind === "ship" && !wide) {
          // Phones: run down a trunk beside the column, then turn into the tile from the side.
          const side = Math.sign(x2 - x1) || 1;
          const sy = y1 + R[na.k] + below[na.k];
          const ex = x2 - side * R[nb.k] * 1.3;
          d = `M${x1} ${sy} L${x1} ${y2 - 12} Q${x1} ${y2} ${x1 + side * 12} ${y2} L${ex} ${y2}`;
        } else if (e.kind === "talk") {
          // A bowed arc between two agents, so the conversation reads as its own line.
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const bow = Math.min(46, len * 0.45);
          const cx = (x1 + x2) / 2 - uy * bow;
          const cy = (y1 + y2) / 2 + ux * bow;
          const ra = R.agent + 3;
          d = `M${x1 + ux * ra} ${y1 + uy * ra} Q${cx} ${cy} ${x2 - ux * ra} ${y2 - uy * ra}`;
        } else {
          const horiz = wide ? Math.abs(x2 - x1) >= Math.abs(y2 - y1) * 0.6 : Math.abs(x2 - x1) > Math.abs(y2 - y1) * 1.5;
          if (horiz) {
            const sx = x1 + Math.sign(x2 - x1) * R[na.k] * (na.k === "source" ? 1.25 : 1.05);
            const ex = x2 - Math.sign(x2 - x1) * R[nb.k] * (nb.k === "output" ? 1.3 : 1.05);
            const mx = (sx + ex) / 2;
            d = `M${sx} ${y1} C${mx} ${y1} ${mx} ${y2} ${ex} ${y2}`;
          } else {
            const down = y2 > y1;
            const sy = y1 + (down ? R[na.k] + below[na.k] : -R[na.k]);
            const ey = y2 + (down ? -R[nb.k] - 2 : R[nb.k] + below[nb.k]);
            const my = (sy + ey) / 2;
            d = `M${x1} ${sy} C${x1} ${my} ${x2} ${my} ${x2} ${ey}`;
          }
        }
        paths[e.id] = mk("path", { d, class: `edge ${e.kind}` }, gEdges);
      });

      N.forEach((n) => {
        const [x, y] = n[key];
        const g = mk("g", { class: `node ${n.k}`, transform: `translate(${x} ${y})` }, gNodes);
        const r = R[n.k];
        if (n.k === "source" || n.k === "output") {
          const box = { x: -r * 1.25, y: -r, width: r * 2.5, height: r * 2, rx: 8 };
          if (n.k === "output") mk("rect", { class: "burst", ...box }, g);
          mk("rect", { class: "tile", ...box }, g);
          mk("path", { class: "icon", d: ICONS[n.i], transform: "scale(.8)" }, g);
          if (n.k === "output") mk("text", { class: "count", x: r * 1.25 + 5, y: -r + 7 }, g);
        } else if (n.k === "agent") {
          mk("circle", { class: "glow", r: r + 8 }, g);
          mk("circle", { class: "disc", r }, g);
          mk("circle", { class: "ring", r: r - 3, pathLength: 1, transform: "rotate(-90)" }, g);
          mk("path", { class: "icon", d: ICONS[n.i], transform: "scale(.72)" }, g);
        } else if (n.k === "hub") {
          mk("circle", { class: "glow", r: r + 12 }, g);
          mk("circle", { class: "disc", r }, g);
          mk("circle", { class: "ring", r: r - 4, pathLength: 1, transform: "rotate(-90)" }, g);
          const rose = mk("g", { class: "rose" }, g);
          mk("path", { class: "icon", d: "M0 -19 L4.5 -4.5 L19 0 L4.5 4.5 L0 19 L-4.5 4.5 L-19 0 L-4.5 -4.5 Z" }, rose);
          mk("circle", { r: 2.6, fill: "#E0A458" }, rose);
        } else if (n.k === "decision") {
          const q = r * 1.2;
          mk("path", { class: "diamond", d: `M0 ${-q} L${q} 0 L0 ${q} L${-q} 0 Z` }, g);
          mk("path", { class: "icon", d: ICONS.person, transform: "scale(.85)" }, g);
          mk("path", { class: "check", d: "M-9 0 L-3 6 L10 -7" }, g);
        }
        const t = mk("text", { class: "label", y: r + (n.k === "decision" ? 22 : 15), "text-anchor": "middle" }, g);
        t.textContent = label(n, wide);
        nodesEl[n.id] = g;
      });
      Object.keys(counts).forEach(setCount);
    };

    const setCount = (id) => {
      const c = nodesEl[id] && nodesEl[id].querySelector(".count");
      if (c) c.textContent = counts[id] ? `✓${counts[id]}` : "";
    };

    // Moving pieces.
    let active = [];
    let works = [];
    const startPacket = (edgeId, kind, dur, now) => {
      const p = paths[edgeId];
      if (!p) return;
      const g = mk("g", {}, svg.packets);
      let head;
      const tails = [];
      if (kind === "info" || kind === "talk") {
        [0.07, 0.14].forEach((lag, i) => tails.push({ lag, el: mk("circle", { class: kind === "talk" ? "pk-talk-tail" : "pk-tail", r: 2.8 - i * 0.9, opacity: 0.55 - i * 0.2 }, g) }));
        head = mk("circle", { class: kind === "talk" ? "pk-talk" : "pk-info", r: kind === "talk" ? 4 : 4.5 }, g);
      } else if (kind === "ask") {
        head = mk("path", { class: "pk-ask", d: "M0 -7 L7 0 L0 7 L-7 0 Z" }, g);
      } else {
        head = mk("rect", { class: "pk-ship", x: -6, y: -6, width: 12, height: 12, rx: 2 }, g);
      }
      p.classList.add("hot");
      active.push({ edgeId, kind, p, g, head, tails, start: now, dur, len: p.getTotalLength() });
    };
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const place = (pk, f) => {
      const at = (x) => pk.p.getPointAtLength(pk.len * Math.max(0, Math.min(1, x)));
      const pt = at(ease(f));
      pk.head.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      pk.tails.forEach((tl) => {
        const q = at(ease(Math.max(0, f - tl.lag)));
        tl.el.setAttribute("cx", q.x);
        tl.el.setAttribute("cy", q.y);
      });
    };
    const startWork = (id, dur, now) => {
      const node = nodesEl[id];
      if (!node) return;
      const existing = works.find((w) => w.id === id);
      if (existing) { existing.start = now; existing.dur = dur; return; }
      node.classList.add("working");
      works.push({ id, node, ring: node.querySelector(".ring"), start: now, dur });
    };
    const arrive = (pk, now) => {
      pk.g.remove();
      if (!active.some((o) => o !== pk && o.edgeId === pk.edgeId)) pk.p.classList.remove("hot");
      const to = pk.edgeId.split(">")[1];
      const node = nodesEl[to];
      if (!node) return;
      if (node.classList.contains("agent")) startWork(to, pk.kind === "talk" ? 700 : 1100, now);
      if (to === "hub") startWork("hub", 2000, now);
      if (pk.kind === "ask") { node.classList.add("asking"); }
      if (pk.kind === "ship") {
        node.classList.remove("shipped");
        void node.getBoundingClientRect();
        node.classList.add("shipped");
        counts[to] = (counts[to] || 0) + 1;
        setCount(to);
      }
    };
    const decide = (id) => {
      const node = nodesEl[id];
      node.classList.add("asking");
      setTimeout(() => { node.classList.remove("asking"); node.classList.add("approved"); }, 600);
    };
    const resetLoop = () => {
      active.forEach((pk) => { pk.g.remove(); pk.p.classList.remove("hot"); });
      active = [];
      works = [];
      Object.values(nodesEl).forEach((n) => {
        n.classList.remove("working", "asking", "approved", "shipped");
        const ring = n.querySelector(".ring");
        if (ring) ring.style.strokeDashoffset = "1";
      });
    };

    // A finished morning, for reduced motion: everything done, nothing moving.
    const drawStill = () => {
      build();
      Object.values(nodesEl).forEach((n) => {
        const ring = n.querySelector(".ring");
        if (ring) ring.style.strokeDashoffset = "0";
      });
      nodesEl.you.classList.add("approved");
    };

    if (reduce) {
      drawStill();
      window.addEventListener("resize", () => { layout = null; drawStill(); });
    } else {
      build();
      let loopStart = null;
      let cursor = 0;
      const visible = () => {
        const b = flow.getBoundingClientRect();
        return b.bottom > 0 && b.top < window.innerHeight;
      };
      const tick = () => {
        const now = performance.now();
        if (!visible()) { setTimeout(tick, 250); return; }
        if (loopStart === null || now - loopStart >= LOOP) {
          resetLoop();
          loopStart = now;
          cursor = 0;
        }
        const t = now - loopStart;
        while (cursor < SCRIPT.length && SCRIPT[cursor][0] <= t) {
          const [, edge, kind, dur] = SCRIPT[cursor];
          if (edge === "decide") decide(kind);
          else startPacket(edge, kind, dur, now);
          cursor += 1;
        }
        active = active.filter((pk) => {
          const f = (now - pk.start) / pk.dur;
          if (f >= 1) { arrive(pk, now); return false; }
          place(pk, f);
          return true;
        });
        works = works.filter((w) => {
          const f = (now - w.start) / w.dur;
          if (w.ring) w.ring.style.strokeDashoffset = String(Math.max(0, 1 - f));
          if (f >= 1) { w.node.classList.remove("working"); return false; }
          return true;
        });
        setTimeout(tick, 16);
      };
      tick();
      let rt = null;
      window.addEventListener("resize", () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          const next = canvas.clientWidth >= 640 ? "w" : "t";
          if (next !== layout) { layout = null; build(); loopStart = null; }
        }, 200);
      });
    }
  }

  /* ---------- The board: split flaps ---------- */
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-";
  const groups = Array.from(document.querySelectorAll("[data-flaps]")).map((el) => {
    const len = Number(el.dataset.len) || el.dataset.flaps.length;
    const text = el.dataset.flaps.padEnd(len, " ");
    el.textContent = "";
    const cells = Array.from(text).map((ch) => {
      const cell = document.createElement("span");
      cell.className = "flap";
      cell.textContent = reduce ? ch : " ";
      el.appendChild(cell);
      return { cell, ch };
    });
    return { el, cells };
  });

  let flipRun = 0;
  const flipTo = ({ cell, ch }, delay) => {
    const run = flipRun;
    let steps = ch === " " ? (Math.random() < 0.4 ? 2 : 0) : 4 + Math.floor(Math.random() * 7);
    const tick = () => {
      if (run !== flipRun) return;
      cell.textContent = steps > 0 ? CHARS[Math.floor(Math.random() * CHARS.length)] : ch;
      cell.classList.remove("tick");
      void cell.offsetWidth;
      cell.classList.add("tick");
      if (steps-- > 0) setTimeout(tick, 62);
    };
    setTimeout(tick, delay);
  };

  // The example week lives in a pop-up, opened from the calendar sticker.
  const board = document.querySelector(".board-housing");
  const runBoard = () => {
    if (!board || reduce) return;
    flipRun += 1;
    groups.forEach((g) => g.cells.forEach((c) => { c.cell.textContent = " "; }));
    const title = groups.filter((g) => g.el.classList.contains("big"));
    title.forEach((g) => g.cells.forEach((c, i) => flipTo(c, 150 + i * 40)));
    const rows = Array.from(board.querySelectorAll("tbody tr")).filter((r) => r.getClientRects().length);
    rows.forEach((row, r) => {
      const base = 750 + r * 450;
      let k = 0;
      groups
        .filter((g) => row.contains(g.el))
        .forEach((g) => g.cells.forEach((c) => { flipTo(c, base + k * 18); k += 1; }));
    });
  };

  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => dlg.close()));
    // The pop-up's own frame is transparent, so a click that lands on it
    // (rather than on the board inside) is a click on the dimmed backdrop.
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  });
  openDialog = (id) => {
    const dlg = document.getElementById(id);
    if (!dlg || dlg.open) return;
    if (onOpen[id]) onOpen[id]();
    dlg.showModal();
    if (board && dlg.contains(board)) runBoard();
  };
  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.addEventListener("close", () => { if (onClose[dlg.id]) onClose[dlg.id](); });
  });

  /* ---------- Buttons that open a pop-up directly (keyboard friendly) ---------- */
  document.querySelectorAll("[data-open-dialog]").forEach((b) => {
    b.addEventListener("click", () => openDialog(b.dataset.openDialog));
  });

  /* ---------- Game: Hold up the world ---------- */
  const ga = document.querySelector("[data-ga]");
  if (ga) {
    const field = ga.querySelector("[data-ga-field]");
    const atlasEl = ga.querySelector("[data-ga-atlas]");
    const timeEl = ga.querySelector("[data-ga-time]");
    const scoreEl = ga.querySelector("[data-ga-score]");
    const bars = Array.from(ga.querySelectorAll(".ga-load i"));
    const intro = ga.querySelector("[data-ga-intro]");
    const end = ga.querySelector("[data-ga-end]");
    const resultEl = ga.querySelector("[data-ga-result]");
    const subEl = ga.querySelector("[data-ga-sub]");
    const CHORES = [
      "Payroll", "Follow-ups", "Weekly report", "Angry review", "Schedule", "Invoices",
      "Supplier order", "New hire forms", "Meeting prep", "Refund", "Taxes", "Inventory count",
      "Customer email", "Staff texts", "Bank rec",
    ];
    const LENGTH = 30000;
    const MAX_LOAD = 8;
    let st = null;
    const fmt = (ms) => `0:${String(Math.max(0, Math.ceil(ms / 1000))).padStart(2, "0")}`;

    // Where the sphere is, in field coordinates (it moves as Atlas sinks).
    const geom = () => {
      const f = field.getBoundingClientRect();
      const a = atlasEl.getBoundingClientRect();
      return {
        cx: a.left - f.left + a.width * 0.559,
        top: a.top - f.top + a.height * 0.235 - a.width * 0.347,
        r: a.width * 0.347,
        w: f.width,
      };
    };
    const put = (c) => { c.el.style.transform = `translate(${c.x}px, ${c.y}px)`; };

    const updateLoad = () => {
      const load = st.pile.length;
      bars.forEach((b, i) => {
        b.classList.toggle("on", i < load);
        b.classList.toggle("hot", i < load && load >= MAX_LOAD - 2);
      });
      atlasEl.style.setProperty("--sink", String(load * 6));
      atlasEl.style.setProperty("--tilt", `${load >= 3 ? (load - 2) * 1.4 : 0}deg`);
      atlasEl.classList.toggle("strain", load >= 5 && !reduce);
    };

    const clearField = () => {
      field.querySelectorAll(".ga-chip").forEach((n) => n.remove());
      atlasEl.classList.remove("strain", "dropped");
      atlasEl.style.setProperty("--sink", "0");
      atlasEl.style.setProperty("--tilt", "0deg");
      bars.forEach((b) => b.classList.remove("on", "hot"));
    };

    const stop = () => { if (st) { st.running = false; clearTimeout(st.timer); } };

    const finish = (held) => {
      stop();
      const elapsed = Math.min(LENGTH, performance.now() - st.t0);
      if (!held) atlasEl.classList.add("dropped");
      resultEl.textContent = held ? "Atlas held on." : "The world dropped.";
      const chores = `${st.score} ${st.score === 1 ? "chore" : "chores"}`;
      subEl.textContent = held
        ? `You handed off ${chores} in 30 seconds. Imagine every week feeling that light.`
        : `You handed off ${chores} before it got too heavy, ${Math.round(elapsed / 1000)} seconds in. That's a normal Tuesday for most owners.`;
      setTimeout(() => { end.hidden = false; }, held ? 300 : 900);
    };

    const handOff = (chip) => {
      if (!st || !st.running) return;
      let c = st.falling.find((x) => x.el === chip);
      if (c) st.falling = st.falling.filter((x) => x !== c);
      else {
        c = st.pile.find((x) => x.el === chip);
        if (!c) return;
        st.pile = st.pile.filter((x) => x !== c);
      }
      st.score += 1;
      scoreEl.textContent = String(st.score);
      chip.textContent = `✓ ${chip.textContent}`;
      chip.classList.add("gone");
      chip.style.transform = `translate(${c.x + 50}px, ${c.y - 150}px) rotate(8deg)`;
      setTimeout(() => chip.remove(), 750);
      updateLoad();
    };
    field.addEventListener("pointerdown", (e) => {
      const chip = e.target.closest(".ga-chip");
      if (!chip) return;
      e.preventDefault();
      handOff(chip);
    });
    field.addEventListener("keydown", (e) => {
      const chip = e.target.closest(".ga-chip");
      if (chip && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handOff(chip); }
    });

    const spawn = (g) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "ga-chip";
      el.textContent = CHORES[Math.floor(Math.random() * CHORES.length)];
      field.appendChild(el);
      const cw = el.offsetWidth;
      const x = Math.max(6, Math.min(g.w - cw - 6, g.cx - cw / 2 + (Math.random() * 2 - 1) * g.r * 0.75));
      const c = { el, x, y: -34, w: cw, jit: Math.random() * 30 - 15 };
      put(c);
      st.falling.push(c);
    };

    const tick = () => {
      if (!st || !st.running) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - st.last) / 1000);
      st.last = now;
      const elapsed = now - st.t0;
      const p = elapsed / LENGTH;
      timeEl.textContent = fmt(LENGTH - elapsed);
      const g = geom();

      if (now >= st.nextSpawn) {
        spawn(g);
        st.nextSpawn = now + (1250 - 780 * p) * (0.75 + Math.random() * 0.5);
      }
      const speed = 70 + 95 * p;
      st.falling = st.falling.filter((c) => {
        c.y += speed * dt;
        const landAt = g.top - 28 - st.pile.length * 22;
        if (c.y >= landAt) {
          st.pile.push(c);
          c.el.classList.add("landed");
          updateLoad();
          return false;
        }
        put(c);
        return true;
      });
      // The pile sits on the sphere and moves with Atlas.
      st.pile.forEach((c, i) => {
        c.x = Math.max(4, Math.min(g.w - c.w - 4, g.cx - c.w / 2 + c.jit));
        c.y = g.top - 28 - i * 22;
        put(c);
      });

      if (st.pile.length >= MAX_LOAD) { finish(false); return; }
      if (elapsed >= LENGTH) { finish(true); return; }
      st.timer = setTimeout(tick, 16);
    };

    const start = () => {
      stop();
      clearField();
      intro.hidden = true;
      end.hidden = true;
      scoreEl.textContent = "0";
      timeEl.textContent = "0:30";
      const now = performance.now();
      st = { running: true, t0: now, last: now, nextSpawn: now + 300, score: 0, falling: [], pile: [] };
      updateLoad();
      tick();
    };
    const resetGame = () => {
      stop();
      clearField();
      st = null;
      intro.hidden = false;
      end.hidden = true;
      scoreEl.textContent = "0";
      timeEl.textContent = "0:30";
    };
    ga.querySelectorAll("[data-ga-start]").forEach((b) => b.addEventListener("click", start));
    onOpen["game-atlas"] = resetGame;
    onClose["game-atlas"] = resetGame;
  }

  /* ---------- Game: Race the Agent ---------- */
  const gr = document.querySelector("[data-gr]");
  if (gr) {
    const items = Array.from(gr.querySelectorAll(".gr-msg"));
    const clock = gr.querySelector("[data-gr-clock]");
    const who = gr.querySelector("[data-gr-who]");
    const intro = gr.querySelector("[data-gr-intro]");
    const end = gr.querySelector("[data-gr-end]");
    const resultEl = gr.querySelector("[data-gr-result]");
    const DONE = { reply: "Replied", file: "Filed", flag: "Flagged for you" };
    let phase = "idle";
    let t0 = 0;
    let penalty = 0;
    let clockTimer = null;
    let timers = [];
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));

    const showClock = (s) => { clock.textContent = `${s.toFixed(1)} s`; };
    const runClock = () => {
      clearInterval(clockTimer);
      clockTimer = setInterval(() => showClock((performance.now() - t0) / 1000 + penalty), 50);
    };
    const clearItems = () => items.forEach((li) => {
      li.classList.remove("done", "wrong");
      li.querySelector(".gr-done").textContent = "";
    });
    const resetRace = () => {
      phase = "idle";
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(clockTimer);
      clearItems();
      gr.classList.remove("agent");
      who.textContent = "Your turn";
      showClock(0);
      intro.hidden = false;
      end.hidden = true;
    };
    const agentTurn = (yours) => {
      phase = "agent";
      clearInterval(clockTimer);
      later(900, () => {
        clearItems();
        gr.classList.add("agent");
        who.textContent = "The agent's turn";
        const total = 1600 + Math.random() * 500;
        t0 = performance.now();
        penalty = 0;
        runClock();
        items.forEach((li, i) => later(((i + 1) * total) / items.length, () => {
          li.classList.add("done");
          li.querySelector(".gr-done").textContent = li.dataset.note;
        }));
        later(total + 40, () => {
          clearInterval(clockTimer);
          const agent = total / 1000;
          showClock(agent);
          phase = "over";
          later(700, () => {
            resultEl.textContent = `You ${yours.toFixed(1)} s. The agent ${agent.toFixed(1)} s.`;
            end.hidden = false;
          });
        });
      });
    };
    gr.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pick]");
      if (!b || phase !== "you") return;
      const li = b.closest(".gr-msg");
      if (li.classList.contains("done")) return;
      if (b.dataset.pick === li.dataset.act) {
        li.classList.add("done");
        li.querySelector(".gr-done").textContent = DONE[b.dataset.pick];
        if (items.every((x) => x.classList.contains("done"))) {
          agentTurn((performance.now() - t0) / 1000 + penalty);
        }
      } else {
        penalty += 1;
        li.classList.remove("wrong");
        void li.offsetWidth;
        li.classList.add("wrong");
      }
    });
    const start = () => {
      resetRace();
      intro.hidden = true;
      phase = "you";
      t0 = performance.now();
      penalty = 0;
      runClock();
    };
    gr.querySelectorAll("[data-gr-start]").forEach((b) => b.addEventListener("click", start));
    onOpen["game-race"] = resetRace;
    onClose["game-race"] = resetRace;
  }

  /* ---------- "Text me. Or email me." ---------- */
  const contact = document.querySelector("[data-contact]");
  if (contact) {
    const dlg = contact.closest("dialog");
    const done = dlg.querySelector("[data-rm-done]");
    const doneText = dlg.querySelector("[data-rm-done-text]");
    const errorEl = contact.querySelector("[data-rm-error]");
    const send = contact.querySelector(".rm-send");
    const fields = Array.from(contact.querySelectorAll("[data-via-field]"));
    const via = () => contact.querySelector('[name="via"]:checked').value;
    const syncVia = () => fields.forEach((f) => { f.hidden = f.dataset.viaField !== via(); });
    contact.addEventListener("change", syncVia);
    syncVia();

    const fail = (msg) => { errorEl.textContent = msg; errorEl.hidden = false; };
    contact.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      const data = new FormData(contact);
      const name = String(data.get("name") || "").trim();
      if (name.length < 2) return fail("Please add your name.");
      if (via() === "text") {
        const digits = String(data.get("phone") || "").replace(/\D/g, "");
        if (digits.length < 10) return fail("Please add a mobile number we can text.");
        if (!data.get("sms_ok")) return fail("Please tick the box so we're allowed to text you.");
        data.delete("email");
      } else {
        const email = String(data.get("email") || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Please add an email address we can reach.");
        data.delete("phone");
        data.delete("sms_ok");
      }
      send.disabled = true;
      try {
        const res = await fetch("/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(data).toString(),
        });
        if (!res.ok) throw new Error(String(res.status));
        contact.hidden = true;
        doneText.textContent = `Thanks, ${name.split(" ")[0]}. One of us will ${via() === "text" ? "text" : "email"} you soon.`;
        done.hidden = false;
      } catch (_) {
        fail("That didn't go through. Try again in a minute, or use the booking button instead.");
      } finally {
        send.disabled = false;
      }
    });
  }

  /* ---------- Coffee: while your coffee brewed ---------- */
  const brew = document.querySelector("[data-brew]");
  if (brew) {
    const SVGNS = "http://www.w3.org/2000/svg";
    const ticks = brew.querySelector(".br-ticks");
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const l = document.createElementNS(SVGNS, "line");
      l.setAttribute("x1", String(Math.sin(a) * 44));
      l.setAttribute("y1", String(-Math.cos(a) * 44));
      l.setAttribute("x2", String(Math.sin(a) * 50));
      l.setAttribute("y2", String(-Math.cos(a) * 50));
      ticks.appendChild(l);
    }
    const hour = brew.querySelector("[data-br-hour]");
    const min = brew.querySelector("[data-br-min]");
    const timeEl = brew.querySelector("[data-br-time]");
    const counts = Array.from(brew.querySelectorAll("[data-br-count]"));
    const checks = Array.from(brew.querySelectorAll("[data-br-check]"));
    const end = brew.querySelector("[data-br-end]");
    const DUR = 4600;
    let timer = null;
    let wait = null;

    // f runs 0 to 1 across the night, 6 p.m. to 6 a.m.
    const show = (f) => {
      const mins = 18 * 60 + f * 12 * 60;
      const h24 = Math.floor(mins / 60) % 24;
      const m = Math.floor(mins % 60);
      hour.style.transform = `rotate(${(mins / 720) * 360}deg)`;
      min.style.transform = `rotate(${(mins % 60) * 6}deg)`;
      timeEl.textContent = `${((h24 + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h24 < 12 ? "a.m." : "p.m."}`;
      counts.forEach((b, i) => {
        const start = 0.05 + i * 0.1;
        const k = Math.max(0, Math.min(1, (f - start) / 0.5));
        const v = Math.round(Number(b.dataset.brCount) * k);
        b.textContent = String(v);
        b.closest("li").classList.toggle("lit", v > 0);
      });
      checks.forEach((li, i) => li.classList.toggle("lit", f >= 0.72 + i * 0.12));
    };
    const stopBrew = () => { clearTimeout(timer); clearTimeout(wait); };
    const playBrew = () => {
      stopBrew();
      end.hidden = true;
      if (reduce) { show(1); end.hidden = false; return; }
      show(0);
      const t0 = performance.now();
      const step = () => {
        const f = Math.min(1, (performance.now() - t0) / DUR);
        show(f);
        if (f < 1) timer = setTimeout(step, 30);
        else wait = setTimeout(() => { end.hidden = false; }, 350);
      };
      step();
    };
    brew.querySelector("[data-br-again]").addEventListener("click", playBrew);
    onOpen.brew = () => { show(0); end.hidden = true; wait = setTimeout(playBrew, 400); };
    onClose.brew = stopBrew;
  }

  /* ---------- Pre-read: messy to meeting-ready ---------- */
  const pr = document.querySelector("[data-pr]");
  if (pr) {
    const lines = Array.from(pr.querySelectorAll("[data-pr-line]"));
    const end = pr.closest("dialog").querySelector("[data-pr-end]");
    let steps = [];
    const at = (ms, fn) => steps.push(setTimeout(fn, ms));
    const stopPr = () => { steps.forEach(clearTimeout); steps = []; };
    const resetPr = () => {
      stopPr();
      pr.classList.remove("scatter", "gather", "merged");
      lines.forEach((l) => l.classList.remove("shown"));
      end.hidden = true;
    };
    const playPr = () => {
      resetPr();
      if (reduce) {
        pr.classList.add("merged");
        lines.forEach((l) => l.classList.add("shown"));
        end.hidden = false;
        return;
      }
      void pr.offsetWidth;
      at(80, () => pr.classList.add("scatter"));
      at(1300, () => { pr.classList.remove("scatter"); pr.classList.add("gather"); });
      at(2350, () => { pr.classList.remove("gather"); pr.classList.add("merged"); });
      lines.forEach((l, i) => at(2900 + i * 520, () => l.classList.add("shown")));
      at(2900 + lines.length * 520 + 300, () => { end.hidden = false; });
    };
    pr.closest("dialog").querySelector("[data-pr-again]").addEventListener("click", playPr);
    onOpen.preread = () => { resetPr(); steps.push(setTimeout(playPr, 300)); };
    onClose.preread = resetPr;
  }

  /* ---------- Spreadsheet: spot the mistake ---------- */
  const sp = document.querySelector("[data-sp]");
  if (sp) {
    const cells = Array.from(sp.querySelectorAll(".sp-cell"));
    const wrongCell = sp.querySelector("[data-wrong]");
    const clock = sp.querySelector("[data-sp-clock]");
    const intro = sp.querySelector("[data-sp-intro]");
    const agent = sp.querySelector("[data-sp-agent]");
    const end = sp.querySelector("[data-sp-end]");
    const resultEl = sp.querySelector("[data-sp-result]");
    const LIMIT = 15;
    let running = false;
    let t0 = 0;
    let tick = null;
    let later = [];

    const resetSp = () => {
      running = false;
      clearInterval(tick);
      later.forEach(clearTimeout);
      later = [];
      cells.forEach((c) => c.classList.remove("miss", "found", "reveal"));
      sp.classList.remove("over");
      agent.hidden = true;
      end.hidden = true;
      intro.hidden = false;
      clock.textContent = `${LIMIT.toFixed(1)} s`;
    };
    const finish = (found, secs) => {
      running = false;
      clearInterval(tick);
      sp.classList.add("over");
      wrongCell.classList.add(found ? "found" : "reveal");
      resultEl.textContent = found ? `You found it in ${secs.toFixed(1)} s.` : "Time's up.";
      later.push(setTimeout(() => {
        agent.textContent = "";
        const who = document.createElement("b");
        who.textContent = "Agent · 0.4 s  ";
        agent.append(who, "Thursday's labor is 31%, not 27%: $1,302 ÷ $4,200. The 27% was copied from Wednesday's row.");
        agent.hidden = false;
      }, reduce ? 0 : 450));
      later.push(setTimeout(() => { end.hidden = false; }, reduce ? 0 : 1000));
    };
    const startSp = () => {
      resetSp();
      intro.hidden = true;
      running = true;
      t0 = performance.now();
      tick = setInterval(() => {
        const left = LIMIT - (performance.now() - t0) / 1000;
        clock.textContent = `${Math.max(0, left).toFixed(1)} s`;
        if (left <= 0) finish(false, LIMIT);
      }, 50);
    };
    sp.addEventListener("click", (e) => {
      const cell = e.target.closest(".sp-cell");
      if (!cell || !running) return;
      if (cell === wrongCell) {
        finish(true, (performance.now() - t0) / 1000);
      } else {
        cell.classList.remove("miss");
        void cell.offsetWidth;
        cell.classList.add("miss");
      }
    });
    sp.querySelectorAll("[data-sp-start]").forEach((b) => b.addEventListener("click", startSp));
    onOpen.spot = resetSp;
    onClose.spot = resetSp;
  }
})();
