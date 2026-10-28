// agent-atlas.co: the word reel, the card deck, the stickers, the split-flap board.
// Every animation here is decoration: the real text is already in the page.
(() => {
  "use strict";

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isDesktop = () => window.matchMedia("(min-width: 720px)").matches;

  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Hero: the cycling word ---------- */
  const reel = document.querySelector("[data-reel]");
  if (reel && !reduce) {
    const last = reel.children.length - 1;
    let i = 0;
    reel.style.setProperty("--i", "0");
    const step = () => {
      i += 1;
      reel.style.setProperty("--i", String(i));
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
          c += 1 + (Math.random() < 0.3 ? 1 : 0);
          item.node.textContent = item.text.slice(0, c);
          item.node.parentNode.appendChild(caret);
          if (c >= item.text.length) { n += 1; c = 0; timer = setTimeout(tick, 140); return; }
          const ch = item.text[c - 1];
          timer = setTimeout(tick, /[.,:]/.test(ch) ? 120 : 14 + Math.random() * 16);
        };
        timer = setTimeout(tick, 260);
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

  /* ---------- Stickers: drag them, they settle where you drop them ---------- */
  document.querySelectorAll(".sticker").forEach((el) => {
    let ox = 0;
    let oy = 0;
    let sx = 0;
    let sy = 0;
    let dragging = false;
    el.addEventListener("pointerdown", (e) => {
      if (!isDesktop()) return;
      e.preventDefault();
      dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* pointer already gone */ }
      sx = e.clientX - ox;
      sy = e.clientY - oy;
      el.classList.add("is-dragging");
    });
    el.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      ox = e.clientX - sx;
      oy = e.clientY - sy;
      el.style.setProperty("--dx", `${ox}px`);
      el.style.setProperty("--dy", `${oy}px`);
    });
    const drop = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("is-dragging");
      el.style.setProperty("--r", `${(Math.random() * 18 - 9).toFixed(1)}deg`);
    };
    el.addEventListener("pointerup", drop);
    el.addEventListener("pointercancel", drop);
  });

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
