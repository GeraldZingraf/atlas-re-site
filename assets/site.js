// agent-atlas.co: the word reel and Atlas, the card deck, the stickers, the split-flap board.
// Every animation here is decoration: the real text is already in the page.
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isDesktop = () => window.matchMedia("(min-width: 720px)").matches;

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
  const react = (el) => {
    el.classList.add("is-touched");
    el.classList.remove("nudge");
    const art = el.querySelector(".sticker-art");
    const fx = `fx-${el.dataset.fx || "pop"}`;
    if (!reduce) {
      art.classList.remove(fx);
      void art.offsetWidth; // restart the animation on repeat clicks
      art.classList.add(fx);
      art.addEventListener("animationend", () => art.classList.remove(fx), { once: true });
    }
    // Keep the speech bubble on screen: anchor it to the sticker's inner side.
    const box = el.getBoundingClientRect();
    const mid = box.left + box.width / 2;
    el.classList.toggle("say-left", mid < window.innerWidth * 0.3);
    el.classList.toggle("say-right", mid > window.innerWidth * 0.7);
    el.classList.add("saying");
    clearTimeout(el.sayTimer);
    el.sayTimer = setTimeout(() => el.classList.remove("saying"), 2400);
  };

  stickers.forEach((el) => {
    // Each one drifts on its own rhythm until someone touches it.
    el.style.setProperty("--dur", `${(4.5 + Math.random() * 3).toFixed(2)}s`);
    el.style.setProperty("--delay", `${(-Math.random() * 6).toFixed(2)}s`);
    const bubble = document.createElement("span");
    bubble.className = "sticker-say";
    bubble.textContent = el.dataset.say || "";
    el.appendChild(bubble);

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
      { id: "s-mail", k: "source", i: "mail", l: "Email", w: [70, 60], t: [50, 60] },
      { id: "s-text", k: "source", i: "text", l: "Texts", w: [70, 130], t: [150, 60] },
      { id: "s-rev", k: "source", i: "star", l: "Reviews", w: [70, 200], t: [250, 60] },
      { id: "s-pos", k: "source", i: "chart", l: "Sales", w: [70, 270], t: [350, 60] },
      { id: "s-inv", k: "source", i: "box", l: "Inventory", sl: "Stock", w: [70, 340], t: [50, 150] },
      { id: "s-cal", k: "source", i: "cal", l: "Calendar", w: [70, 410], t: [150, 150] },
      { id: "s-time", k: "source", i: "clock", l: "Timeclock", w: [70, 480], t: [250, 150] },
      { id: "s-acct", k: "source", i: "ledger", l: "Accounting", sl: "Books", w: [70, 550], t: [350, 150] },
      // agents
      { id: "a-reply", k: "agent", i: "mail", l: "Reply agent", sl: "Replies", w: [290, 75], t: [50, 300] },
      { id: "a-rev", k: "agent", i: "star", l: "Reviews agent", sl: "Reviews", w: [410, 150], t: [150, 300] },
      { id: "a-score", k: "agent", i: "chart", l: "Scorecard agent", sl: "Numbers", w: [290, 225], t: [250, 300] },
      { id: "a-order", k: "agent", i: "cart", l: "Ordering agent", sl: "Orders", w: [410, 300], t: [350, 300] },
      { id: "a-prep", k: "agent", i: "doc", l: "Meeting-prep agent", sl: "Prep", w: [290, 375], t: [50, 400] },
      { id: "a-sched", k: "agent", i: "cal", l: "Scheduling agent", sl: "Shifts", w: [410, 450], t: [150, 400] },
      { id: "a-pay", k: "agent", i: "clock", l: "Payroll agent", sl: "Payroll", w: [290, 525], t: [250, 400] },
      { id: "a-coll", k: "agent", i: "coin", l: "Collections agent", sl: "Collect", w: [410, 590], t: [350, 400] },
      // coordinator and you
      { id: "hub", k: "hub", l: "Coordinator", w: [610, 320], t: [160, 560] },
      { id: "you", k: "decision", i: "person", l: "You decide", w: [775, 320], t: [240, 690] },
      // work shipped
      { id: "o-reply", k: "output", i: "send", l: "Replies sent", sl: "Replied", w: [935, 60], t: [70, 820] },
      { id: "o-rev", k: "output", i: "star", l: "Reviews answered", sl: "Reviewed", w: [935, 130], t: [70, 890] },
      { id: "o-refund", k: "output", i: "coin", l: "Refund issued", sl: "Refund", w: [935, 200], t: [330, 820] },
      { id: "o-order", k: "output", i: "cart", l: "Order placed", sl: "Ordered", w: [935, 270], t: [330, 890] },
      { id: "o-shifts", k: "output", i: "cal", l: "Shifts posted", sl: "Shifts", w: [935, 340], t: [330, 960] },
      { id: "o-pay", k: "output", i: "check", l: "Payroll ready", sl: "Payroll", w: [935, 410], t: [330, 1030] },
      { id: "o-remind", k: "output", i: "bell", l: "Reminders sent", sl: "Chased", w: [935, 480], t: [70, 960] },
      { id: "o-report", k: "output", i: "phone", l: "Report to you", sl: "Report", w: [935, 550], t: [70, 1030] },
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
      svg = mk("svg", { viewBox: wide ? "0 0 1010 640" : "0 0 400 1075" }, canvas);
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

  const flipTo = ({ cell, ch }, delay) => {
    let steps = ch === " " ? (Math.random() < 0.4 ? 2 : 0) : 4 + Math.floor(Math.random() * 7);
    const tick = () => {
      cell.textContent = steps > 0 ? CHARS[Math.floor(Math.random() * CHARS.length)] : ch;
      cell.classList.remove("tick");
      void cell.offsetWidth;
      cell.classList.add("tick");
      if (steps-- > 0) setTimeout(tick, 62);
    };
    setTimeout(tick, delay);
  };

  const board = document.querySelector(".board-housing");
  if (board && !reduce) {
    const run = () => {
      const title = groups.filter((g) => g.el.classList.contains("big"));
      title.forEach((g) => g.cells.forEach((c, i) => flipTo(c, i * 40)));
      const rows = Array.from(board.querySelectorAll("tbody tr"));
      rows.forEach((row, r) => {
        const base = 700 + r * 520;
        let k = 0;
        groups
          .filter((g) => row.contains(g.el))
          .forEach((g) => g.cells.forEach((c) => { flipTo(c, base + k * 18); k += 1; }));
      });
    };
    let ran = false;
    const runWhenSeen = () => {
      if (ran) return;
      const box = board.getBoundingClientRect();
      if (box.top < window.innerHeight * 0.75 && box.bottom > 0) {
        ran = true;
        window.removeEventListener("scroll", runWhenSeen);
        run();
      }
    };
    window.addEventListener("scroll", runWhenSeen, { passive: true });
    runWhenSeen();
  }
})();
