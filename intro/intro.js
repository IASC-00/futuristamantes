/* Futuristamantes homepage intro: controller.
   Decides whether the intro plays (homepage, first visit in this tab, no #link, no reduced
   motion), covers the first paint, tries the 3D scene (intro3d.js, loaded only now) and falls
   back to a flat version of the same idea when WebGL is missing, fails, or runs slowly.
   Skip button + Esc end it at once. ?introtest=1 exposes window.__introSeek(seconds). */
(function () {
  "use strict";
  var w = window, doc = document, html = doc.documentElement;
  var KEY = "fiIntroSeen";
  var Q = w.location.search;
  var TEST = /[?&]introtest=1/.test(Q);
  var GUARD = !/[?&]introguard=0/.test(Q) && !TEST;
  var FORCE2D = /[?&]intro2d=1/.test(Q);
  var DUR3D = 5.0, DUR2D = 3.6, LOAD_LIMIT = 2600, FAILSAFE = 9000;

  function store(f) { try { return f(); } catch (e) { return null; } }
  function shouldRun() {
    if (TEST) return true;
    var p = w.location.pathname;
    if (p !== "/" && p !== "/index.html") return false;
    if (w.location.hash && w.location.hash.length > 1) return false;
    if (w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (store(function () { return w.sessionStorage.getItem(KEY); })) return false;
    return true;
  }
  if (!shouldRun()) return;
  if (!TEST) store(function () { w.sessionStorage.setItem(KEY, "1"); });
  html.classList.add("fi-intro-on", "fi-intro-hold");

  var root, host, skip, ctrl = null, mode = "", ended = false, raf = 0, last = 0, clock = 0;
  var visible = 0, visTimer = 0, loadTimer = 0, inerted = [];

  function release() { html.classList.remove("fi-intro-hold"); }

  function finish() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    clearInterval(visTimer); clearTimeout(loadTimer);
    if (ctrl) { try { ctrl.dispose(); } catch (e) { /* already gone */ } ctrl = null; }
    release();
    html.classList.remove("fi-intro-on", "fi-mounted");
    doc.removeEventListener("keydown", onKey, true);
    w.removeEventListener("wheel", stop, { passive: false });
    w.removeEventListener("touchmove", stop, { passive: false });
    inerted.forEach(function (n) { n.removeAttribute("inert"); });
    if (root && root.parentNode) root.parentNode.removeChild(root);
  }
  function onKey(e) { if (e.key === "Escape") { e.preventDefault(); finish(); } }
  function stop(e) { if (!ended) e.preventDefault(); }

  /* the overlay's paper fades so the page shows through while the plate lands */
  function fade(t, a, b) {
    var f = Math.min(1, Math.max(0, (t - a) / (b - a)));
    root.style.backgroundColor = "rgba(234,237,241," + (1 - f).toFixed(3) + ")";
  }

  function mount() {
    if (ended || root) return;
    root = doc.createElement("div");
    root.className = "fi-intro";
    host = doc.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;inset:0";
    skip = doc.createElement("button");
    skip.type = "button";
    skip.className = "fi-skip";
    skip.textContent = "Skip intro";
    skip.addEventListener("click", finish);
    root.appendChild(host);
    root.appendChild(skip);
    for (var i = 0; i < doc.body.children.length; i++) {
      var n = doc.body.children[i];
      if (!n.hasAttribute("inert")) { n.setAttribute("inert", ""); inerted.push(n); }
    }
    doc.body.insertBefore(root, doc.body.firstChild);
    html.classList.add("fi-mounted");
    doc.addEventListener("keydown", onKey, true);
    w.addEventListener("wheel", stop, { passive: false });
    w.addEventListener("touchmove", stop, { passive: false });
    try { skip.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
    if (!TEST) {
      visTimer = setInterval(function () {
        if (!doc.hidden) visible += 250;
        if (visible >= FAILSAFE) finish();
      }, 250);
    }
    if (FORCE2D || !webglOK()) return start2D();
    loadTimer = setTimeout(function () { if (mode !== "3d") start2D(); }, LOAD_LIMIT);
    import("/intro/intro3d.js").then(function (m) {
      if (ended || mode === "2d") return;
      return m.create(host, { target: heroTarget, test: TEST }).then(function (c) {
        if (ended || mode === "2d") { c.dispose(); return; }
        clearTimeout(loadTimer);
        ctrl = c; mode = "3d";
        c.onLost(function () { if (mode === "3d") fail3D(); });
        run3D();
      });
    }).catch(function () { if (!ended && mode !== "3d") start2D(); else fail3D(); });
  }

  function webglOK() {
    try {
      var c = doc.createElement("canvas");
      var g = c.getContext("webgl2");
      if (!g) return false;
      var ext = g.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
      return true;
    } catch (e) { return false; }
  }

  /* where the page's hero plate sits, so the 3D plate can land exactly on it */
  function heroTarget() {
    var img = doc.querySelector(".plate-hero img");
    if (!img) return null;
    var r = img.getBoundingClientRect();
    if (r.width < 20 || r.top > w.innerHeight * 0.8 || r.bottom < 0) return null;
    return { x: r.left, y: r.top, w: r.width, h: r.height, vw: w.innerWidth, vh: w.innerHeight };
  }

  function fail3D() {
    if (ended) return;
    cancelAnimationFrame(raf);
    if (ctrl) { try { ctrl.dispose(); } catch (e) { /* gone */ } ctrl = null; }
    while (host.firstChild) host.removeChild(host.firstChild);
    start2D();
  }

  function apply3D(t) {
    fade(t, 4.15, 4.95);
    if (t >= 4.3) release();
  }

  function run3D() {
    if (TEST) { exposeSeek(); return; }
    var frames = 0, slowMs = 0, slowN = 0;
    clock = 0; last = 0;
    function tick(now) {
      if (ended || mode !== "3d") return;
      if (doc.hidden) { last = 0; raf = requestAnimationFrame(tick); return; }
      if (last) {
        var dt = Math.min(0.1, (now - last) / 1000);
        clock += dt; frames++;
        if (GUARD && frames > 3 && clock < 0.9) {
          slowMs += now - last; slowN++;
          if (slowN >= 8 && slowMs / slowN > 50) return fail3D();
        }
      }
      last = now;
      ctrl.render(clock);
      apply3D(clock);
      if (clock >= DUR3D) return finish();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  /* ---------------- 2D fallback: the same catalogue, flat ---------------- */
  var PLATES = [
    ["/images/p-tech.webp", "FM-105"], ["/images/p-beauty.webp", "FM-104"],
    ["/images/p-fragrance.webp", "FM-103"], ["/images/hero.webp", "FM-000 · Establishing"],
    ["/images/p-food.webp", "FM-101"], ["/images/c-waterfront.webp", "FM-003"]
  ];
  var cards2d = [], HERO2D = 3;
  function start2D() {
    if (ended || mode === "2d") return;
    clearTimeout(loadTimer);
    mode = "2d";
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = doc.createElement("div");
    wrap.className = "fi2d";
    var vw = w.innerWidth, vh = w.innerHeight, portrait = vw / vh < 0.8;
    var pw = portrait ? vw * 0.5 : Math.min(vw * 0.2, 300), ph = pw * 0.75;
    cards2d = PLATES.map(function (p, i) {
      var el = doc.createElement("div");
      el.className = "fi2d-plate";
      el.style.width = pw + "px"; el.style.height = ph + "px";
      el.style.marginLeft = -pw / 2 + "px"; el.style.marginTop = -ph / 2 + "px";
      var img = doc.createElement("img");
      img.alt = ""; img.decoding = "async"; img.src = p[0];
      var tab = doc.createElement("span");
      tab.className = "fi2d-tab"; tab.textContent = p[1];
      el.appendChild(img); el.appendChild(tab);
      wrap.appendChild(el);
      return el;
    });
    host.appendChild(wrap);
    if (TEST) { exposeSeek(); seek(0); return; }
    clock = 0; last = 0;
    function tick(now) {
      if (ended || mode !== "2d") return;
      if (doc.hidden) { last = 0; raf = requestAnimationFrame(tick); return; }
      if (last) clock += Math.min(0.1, (now - last) / 1000);
      last = now;
      apply2D(clock);
      if (clock >= DUR2D) return finish();
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }
  function ease(x) { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function apply2D(t) {
    var vw = w.innerWidth, portrait = vw / w.innerHeight < 0.8;
    var gap = (portrait ? vw * 0.56 : Math.min(vw * 0.23, 340));
    var slide = ease(t / 1.9);                       // the row glides past
    var pull = ease((t - 1.5) / 0.9);                // FM-000 comes forward
    var dev = ease((t - 1.9) / 0.9);                 // and develops to colour
    var land = ease((t - 2.55) / 0.75);              // then lands on the page's hero plate
    var tg = heroTarget(), pw0 = cards2d[HERO2D] ? cards2d[HERO2D].offsetWidth : 1;
    cards2d.forEach(function (el, i) {
      var off = (i - HERO2D) * gap + (1 - slide) * gap * 2.2;
      var face = Math.max(-1, Math.min(1, off / (gap * 1.4)));
      var hero = i === HERO2D;
      var s = hero ? 1 + pull * (portrait ? 0.45 : 0.9) : 1 - pull * 0.15;
      var op = Math.min(1, t / 0.35) * (hero ? 1 : 1 - pull);
      var tx = hero ? off * (1 - pull) : off * (1 + pull * 0.4), ty = 0;
      if (hero) {
        if (tg) {
          tx += (tg.x + tg.w / 2 - tg.vw / 2 - tx) * land;
          ty = (tg.y + tg.h / 2 - tg.vh / 2) * land;
          s += (tg.w / pw0 - s) * land;
        }
        op *= 1 - ease((t - 3.3) / 0.25);
      }
      el.style.opacity = op.toFixed(3);
      el.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) +
        "px) rotateY(" + (face * -62 * (hero ? 1 - pull : 1)).toFixed(1) + "deg) scale(" + s.toFixed(3) + ")";
      el.style.zIndex = hero ? 2 : 1;
    });
    var heroImg = cards2d[HERO2D] && cards2d[HERO2D].firstChild;
    if (heroImg) heroImg.style.filter = dev <= 0 ? "var(--duo)" : (dev >= 1 ? "none" :
      "grayscale(" + (1 - dev) + ") contrast(" + (1 + 0.32 * (1 - dev)) + ") sepia(" + (0.6 * (1 - dev)) +
      ") hue-rotate(" + (186 * (1 - dev)) + "deg) saturate(" + (1 + (1 - dev)) + ")");
    fade(t, 2.85, 3.55);
    if (t >= 2.9) release();
  }

  /* ---------------- test hook ---------------- */
  function seek(t) {
    if (ended) return;
    root.style.visibility = "";
    if (mode === "3d" && ctrl) {
      ctrl.render(t); apply3D(t);
      if (t >= DUR3D) root.style.visibility = "hidden";
    } else if (mode === "2d") {
      apply2D(t);
      if (t >= DUR2D) root.style.visibility = "hidden";
    }
  }
  function exposeSeek() { w.__introSeek = seek; w.__introMode = mode; }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
