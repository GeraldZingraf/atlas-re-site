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

    // Small line icons, drawn around (0, 0).
    const ICONS = {
      mail: "M-11 -7 H11 V7 H-11 Z M-11 -7 L0 2 L11 -7",
      chart: "M-10 8 V-1 M-3 8 V-8 M4 8 V-4 M11 8 V2 M-12 8 H12",
      cal: "M-10 -6 H10 V9 H-10 Z M-10 -1 H10 M-5 -10 V-4 M5 -10 V-4",
      person: "M0 -6 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M-8 9 C-8 2 8 2 8 9",
      send: "M-10 0 L10 -8 L4 9 L1 2 Z M1 2 L10 -8",
      phone: "M-6 -11 H6 V11 H-6 Z M-2 8 H2",
      calok: "M-10 -6 H10 V9 H-10 Z M-10 -1 H10 M-5 3 L-1 6 L5 0",
    };

    // Who's on the map. Positions for a wide screen and for a phone.
    const NODES = [
      { id: "email", kind: "source", icon: "mail", label: "Email", w: [90, 110], t: [70, 70] },
      { id: "sales", kind: "source", icon: "chart", label: "Sales data", w: [90, 250], t: [200, 70] },
      { id: "cal", kind: "source", icon: "cal", label: "Calendar", w: [90, 390], t: [330, 70] },
      { id: "reply", kind: "agent", icon: "mail", label: "Reply agent", short: "Replies", w: [360, 110], t: [70, 250] },
      { id: "score", kind: "agent", icon: "chart", label: "Scorecard agent", short: "Numbers", w: [360, 250], t: [200, 250] },
      { id: "sched", kind: "agent", icon: "cal", label: "Scheduling agent", short: "Schedule", w: [360, 390], t: [330, 250] },
      { id: "hub", kind: "hub", label: "Coordinator", w: [590, 250], t: [200, 430] },
      { id: "you", kind: "decision", icon: "person", label: "You decide", w: [765, 110], t: [80, 600] },
      { id: "sent", kind: "output", icon: "send", label: "Reply sent", w: [925, 110], t: [80, 785] },
      { id: "report", kind: "output", icon: "phone", label: "Report to you", w: [925, 250], t: [200, 785] },
      { id: "booked", kind: "output", icon: "calok", label: "Week booked", w: [925, 390], t: [330, 785] },
    ];
    const EDGES = [
      ["e1", "email", "reply"], ["e2", "sales", "score"], ["e3", "cal", "sched"],
      ["x1", "score", "sched", "exchange"], ["x2", "reply", "hub"], ["x3", "score", "hub"], ["x4", "sched", "hub"],
      ["h1", "hub", "you"], ["d1", "you", "sent"], ["h2", "hub", "report"], ["h3", "hub", "booked"],
    ];
    // One morning, on a loop (milliseconds).
    const LOOP = 11000;
    const SCRIPT = [
      [0, "packet", "e1", "info", 1300], [250, "packet", "e2", "info", 1300], [500, "packet", "e3", "info", 1300],
      [1300, "work", "reply", 1400], [1550, "work", "score", 1400], [1800, "work", "sched", 1100],
      [2950, "packet", "x1", "info", 900], [3000, "packet", "x2", "info", 1200],
      [3850, "work", "sched", 700], [3900, "packet", "x3", "info", 1200], [4550, "packet", "x4", "info", 1100],
      [4200, "work", "hub", 2100],
      [6300, "packet", "h1", "ask", 1000], [7300, "decide", "you"],
      [7500, "packet", "h2", "ship", 1300], [7900, "packet", "h3", "ship", 1300], [8150, "packet", "d1", "ship", 1000],
    ];

    let layout = null;
    let svg = null;
    let paths = {};
    let nodesEl = {};
    let counts = { sent: 0, report: 0, booked: 0 };

    const radius = (n, s) => ({ source: 26, output: 26, agent: 30, hub: 40, decision: 30 }[n.kind] * s);

    const build = () => {
      const wide = canvas.clientWidth >= 640;
      const key = wide ? "w" : "t";
      if (layout === key && svg) return;
      layout = key;
      const s = wide ? 1 : 0.92;
      canvas.textContent = "";
      svg = mk("svg", { viewBox: wide ? "0 0 1010 470" : "0 0 400 850" }, canvas);
      const gEdges = mk("g", {}, svg);
      const gNodes = mk("g", {}, svg);
      svg.packets = mk("g", {}, svg);
      paths = {};
      nodesEl = {};
      const pos = Object.fromEntries(NODES.map((n) => [n.id, n[key]]));

      EDGES.forEach(([id, a, b, style]) => {
        const [x1, y1] = pos[a];
        const [x2, y2] = pos[b];
        const na = NODES.find((n) => n.id === a);
        const nb = NODES.find((n) => n.id === b);
        const horiz = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
        let d;
        if (horiz) {
          const sx = x1 + Math.sign(x2 - x1) * radius(na, s);
          const ex = x2 - Math.sign(x2 - x1) * radius(nb, s);
          const mx = (sx + ex) / 2;
          d = `M${sx} ${y1} C${mx} ${y1} ${mx} ${y2} ${ex} ${y2}`;
        } else {
          // Going down, leave from below the node's label.
          const sy = y1 + Math.sign(y2 - y1) * (radius(na, s) + (y2 > y1 ? (na.kind === "decision" ? 40 : 30) : 0));
          const ey = y2 - Math.sign(y2 - y1) * radius(nb, s);
          const my = (sy + ey) / 2;
          d = `M${x1} ${sy} C${x1} ${my} ${x2} ${my} ${x2} ${ey}`;
        }
        paths[id] = mk("path", { d, class: `edge${style ? ` ${style}` : ""}` }, gEdges);
      });

      NODES.forEach((n) => {
        const [x, y] = pos[n.id];
        const g = mk("g", { class: `node ${n.kind}`, transform: `translate(${x} ${y})` }, gNodes);
        const r = radius(n, s);
        if (n.kind === "source" || n.kind === "output") {
          if (n.kind === "output") mk("rect", { class: "burst", x: -r * 1.2, y: -r * 0.9, width: r * 2.4, height: r * 1.8, rx: 12 }, g);
          mk("rect", { class: "tile", x: -r * 1.2, y: -r * 0.9, width: r * 2.4, height: r * 1.8, rx: 10 }, g);
          mk("path", { class: "icon", d: ICONS[n.icon] }, g);
          if (n.kind === "output") {
            const c = mk("text", { class: "count", x: r * 1.2 + 6, y: -r * 0.9 + 9 }, g);
            c.textContent = "";
          }
        } else if (n.kind === "agent") {
          mk("circle", { class: "glow", r: r + 10 }, g);
          mk("circle", { class: "disc", r }, g);
          mk("circle", { class: "ring", r: r - 4, pathLength: 1, transform: "rotate(-90)" }, g);
          mk("path", { class: "icon", d: ICONS[n.icon], transform: "scale(.85)" }, g);
        } else if (n.kind === "hub") {
          mk("circle", { class: "glow", r: r + 14 }, g);
          mk("circle", { class: "disc", r }, g);
          mk("circle", { class: "ring", r: r - 5, pathLength: 1, transform: "rotate(-90)" }, g);
          const rose = mk("g", { class: "rose" }, g);
          mk("path", { class: "icon", d: "M0 -22 L5 -5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5 -5 Z" }, rose);
          mk("circle", { r: 3, fill: "#E0A458" }, rose);
        } else if (n.kind === "decision") {
          mk("path", { class: "diamond", d: `M0 ${-r * 1.15} L${r * 1.15} 0 L0 ${r * 1.15} L${-r * 1.15} 0 Z` }, g);
          mk("path", { class: "icon", d: ICONS[n.icon] }, g);
          mk("path", { class: "check", d: "M-10 0 L-3 7 L11 -8" }, g);
        }
        const label = mk("text", { class: "label", y: r + (n.kind === "decision" ? 30 : 22), "text-anchor": "middle" }, g);
        label.textContent = !wide && n.short ? n.short : n.label;
        nodesEl[n.id] = g;
      });
      Object.entries(counts).forEach(([id, n]) => setCount(id, n));
    };

    const setCount = (id, n) => {
      const c = nodesEl[id] && nodesEl[id].querySelector(".count");
      if (c) c.textContent = n ? `✓${n}` : "";
    };

    // Moving pieces.
    let active = [];
    const startPacket = (edge, kind, dur, now) => {
      const p = paths[edge];
      if (!p) return;
      const g = mk("g", {}, svg.packets);
      const tails = kind === "info"
        ? [0.06, 0.12].map((lag, i) => ({ lag, el: mk("circle", { class: "pk-tail", r: 3.2 - i, opacity: 0.5 - i * 0.2 }, g) }))
        : [];
      let head;
      if (kind === "info") head = mk("circle", { class: "pk-info", r: 5.5 }, g);
      else if (kind === "ask") head = mk("path", { class: "pk-ask", d: "M0 -8 L8 0 L0 8 L-8 0 Z" }, g);
      else head = mk("rect", { class: "pk-ship", x: -7, y: -7, width: 14, height: 14, rx: 2.5 }, g);
      p.classList.add("hot");
      active.push({ edge, kind, p, g, head, tails, start: now, dur, len: p.getTotalLength() });
    };
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const place = (pk, t) => {
      const at = (f) => pk.p.getPointAtLength(pk.len * Math.max(0, Math.min(1, f)));
      const pt = at(ease(t));
      pk.head.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      pk.tails.forEach((tl) => {
        const q = at(ease(Math.max(0, t - tl.lag)));
        tl.el.setAttribute("cx", q.x);
        tl.el.setAttribute("cy", q.y);
      });
    };
    const arrive = (pk) => {
      pk.g.remove();
      if (!active.some((o) => o !== pk && o.edge === pk.edge)) pk.p.classList.remove("hot");
      if (pk.kind === "ship") {
        const to = EDGES.find((e) => e[0] === pk.edge)[2];
        const node = nodesEl[to];
        node.classList.remove("shipped");
        void node.getBoundingClientRect();
        node.classList.add("shipped");
        counts[to] += 1;
        setCount(to, counts[to]);
      }
    };

    let works = [];
    const startWork = (id, dur, now) => {
      const node = nodesEl[id];
      if (!node) return;
      node.classList.add("working");
      works.push({ id, node, ring: node.querySelector(".ring"), start: now, dur });
    };
    const decide = (id) => {
      const node = nodesEl[id];
      node.classList.add("asking");
      setTimeout(() => { node.classList.remove("asking"); node.classList.add("approved"); }, 800);
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
      ["reply", "score", "sched", "hub"].forEach((id) => {
        const ring = nodesEl[id].querySelector(".ring");
        if (ring) ring.style.strokeDashoffset = "0";
      });
      nodesEl.you.classList.add("approved");
      Object.keys(paths).forEach((id) => paths[id].classList.add("hot"));
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
          const [, type, a, b, c] = SCRIPT[cursor];
          if (type === "packet") startPacket(a, b, c, now);
          else if (type === "work") startWork(a, b, now);
          else if (type === "decide") decide(a);
          cursor += 1;
        }
        active = active.filter((pk) => {
          const f = (now - pk.start) / pk.dur;
          if (f >= 1) { arrive(pk); return false; }
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
      SCRIPT.sort((x, y) => x[0] - y[0]);
      tick();
      let rt = null;
      window.addEventListener("resize", () => {
        clearTimeout(rt);
        rt = setTimeout(() => {
          const before = layout;
          layout = canvas.clientWidth >= 640 ? "w" : "t";
          if (before !== layout) { layout = null; build(); loopStart = null; }
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
