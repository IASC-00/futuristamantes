/* Futuristamantes homepage intro: controller.
   The archive after hours: a drawer of plates riffles to FM-000, a blank print that develops in
   a projector beam while the room lights come up, then lands on the page's hero plate.
   Decides whether the intro plays (homepage, first visit in this tab, no #link, no reduced
   motion), covers the first paint, tries the 3D scene (intro3d.js, loaded only now) and falls
   back to a flat version of the same idea when WebGL is missing, fails, or runs slowly.
   Skip button + Esc end it at once.
   ?introtest=1  exposes window.__introSeek(seconds) (no autoplay)
   ?introtest=rt plays in real time on any visit (for recordings); ?introtest=2d the same, flat */
(function () {
  "use strict";
  var w = window, doc = document, html = doc.documentElement;
  var KEY = "fiIntroSeen";
  var Q = w.location.search;
  var TEST = /[?&]introtest=1(&|$)/.test(Q);
  var RT = /[?&]introtest=(rt|2d)(&|$)/.test(Q);
  var GUARD = !/[?&]introguard=0/.test(Q) && !TEST;
  var FORCE2D = /[?&](intro2d=1|introtest=2d)(&|$)/.test(Q);
  var DUR3D = 4.3, REL3D = 3.25, DOCK3D = 3.92, DUR2D = 4.1, LOAD_LIMIT = 2600, FAILSAFE = 9500;   // 3D values come from intro3d.js

  function store(f) { try { return f(); } catch (e) { return null; } }
  function shouldRun() {
    if (TEST || RT) return true;
    var p = w.location.pathname;
    if (p !== "/" && p !== "/index.html") return false;
    if (w.location.hash && w.location.hash.length > 1) return false;
    if (w.matchMedia && w.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (store(function () { return w.sessionStorage.getItem(KEY); })) return false;
    return true;
  }
  if (!shouldRun()) return;
  if (!TEST && !RT) store(function () { w.sessionStorage.setItem(KEY, "1"); });
  html.classList.add("fi-intro-on", "fi-intro-hold");

  var root, host, vig, skip, ctrl = null, mode = "", ended = false, raf = 0, last = 0, clock = 0;
  var visible = 0, visTimer = 0, loadTimer = 0, inerted = [];

  function release() { html.classList.remove("fi-intro-hold"); }
  function dock(on) { html.classList.toggle("fi-docked", on); }

  function finish() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    clearInterval(visTimer); clearTimeout(loadTimer);
    if (ctrl) { try { ctrl.dispose(); } catch (e) { /* already gone */ } ctrl = null; }
    release();
    html.classList.remove("fi-intro-on", "fi-mounted", "fi-docked");
    doc.removeEventListener("keydown", onKey, true);
    inerted.forEach(function (n) { n.removeAttribute("inert"); });
    var hadFocus = root && root.contains(doc.activeElement), kbd = root && root.classList.contains("fi-kbd");
    if (root && root.parentNode) root.parentNode.removeChild(root);
    // keyboard users carry on from the top of the page instead of being dropped on <body>
    if (hadFocus && kbd) {
      var next = doc.querySelector("a.skip, header a[href], a[href]");
      if (next) try { next.focus({ preventScroll: true }); } catch (e) { next.focus(); }
    }
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); finish(); return; }
    if (root) root.classList.add("fi-kbd");
  }
  function stop(e) { if (!ended) e.preventDefault(); }

  /* the room: dark archive, lights up to the page's paper, then the overlay lets the page through */
  function room(rgb, alpha, dark, vigOn) {
    root.style.backgroundColor = "rgba(" + rgb.join(",") + "," + alpha.toFixed(3) + ")";
    vig.style.opacity = vigOn === false ? "0" : (dark * alpha).toFixed(3);   // 3D draws its own
    root.classList.toggle("fi-lit", dark < 0.5);
  }
  function mix(a, b, k) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * k); }); }
  var DARK = [12, 15, 20], PAPER = [234, 237, 241];

  function mount() {
    if (ended || root) return;
    root = doc.createElement("div");
    root.className = "fi-intro";
    host = doc.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:absolute;inset:0";
    vig = doc.createElement("div");
    vig.className = "fi-vig";
    vig.setAttribute("aria-hidden", "true");
    skip = doc.createElement("button");
    skip.type = "button";
    skip.className = "fi-skip";
    skip.textContent = "Skip intro";
    skip.addEventListener("click", finish);
    root.appendChild(host);
    root.appendChild(vig);
    root.appendChild(skip);
    room(DARK, 1, 1);
    for (var i = 0; i < doc.body.children.length; i++) {
      var n = doc.body.children[i];
      if (!n.hasAttribute("inert")) { n.setAttribute("inert", ""); inerted.push(n); }
    }
    doc.body.insertBefore(root, doc.body.firstChild);
    html.classList.add("fi-mounted");
    doc.addEventListener("keydown", onKey, true);
    // the overlay covers the viewport; it alone swallows scroll so the hero stays where the plate lands
    root.addEventListener("wheel", stop, { passive: false });
    root.addEventListener("touchmove", stop, { passive: false });
    try { skip.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
    if (!TEST && !RT) {
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
        ctrl = c; mode = "3d"; w.__introTier = c.tier; w.__introMode = mode;
        if (c.duration) DUR3D = c.duration;
        if (c.release) REL3D = c.release;
        if (c.docked) DOCK3D = c.docked;
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
    if (r.width < 20 || r.top > w.innerHeight - 48 || r.bottom < 0) return null;   // some of it must be on screen
    var tab = doc.querySelector(".plate-hero .tab"), tr = tab ? tab.getBoundingClientRect() : null;
    return { x: r.left, y: r.top, w: r.width, h: r.height, vw: w.innerWidth, vh: w.innerHeight,
      tw: tr ? tr.width : 181, th: tr ? tr.height : 32 };
  }

  function fail3D() {
    if (ended) return;
    cancelAnimationFrame(raf);
    if (ctrl) { try { ctrl.dispose(); } catch (e) { /* gone */ } ctrl = null; }
    while (host.firstChild) host.removeChild(host.firstChild);
    start2D();
  }

  function apply3D(t) {
    var b = ctrl.backdrop(t);
    room(b.rgb, b.alpha, b.dark, false);
    if (t >= REL3D) release();
    dock(t >= DOCK3D);
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

  /* ---------------- 2D fallback: the same drawer, flat ---------------- */
  var PLATES = [
    ["/images/p-tech.webp", "FM-105"], ["/images/p-beauty.webp", "FM-104"],
    ["/images/p-fragrance.webp", "FM-103"], ["/images/p-food.webp", "FM-101"],
    ["/images/c-waterfront.webp", "FM-003"], ["/images/hero.webp", "FM-000 · Establishing"],
    ["/images/p-industrial.webp", "FM-106"]
  ];
  var cards2d = [], HERO2D = 5, paper2d = null, beam2d = null, line2d = null;
  function start2D() {
    if (ended || mode === "2d") return;
    clearTimeout(loadTimer);
    mode = "2d"; w.__introMode = mode;
    while (host.firstChild) host.removeChild(host.firstChild);
    var wrap = doc.createElement("div");
    wrap.className = "fi2d";
    line2d = doc.createElement("div"); line2d.className = "fi2d-line";
    beam2d = doc.createElement("div"); beam2d.className = "fi2d-beam";
    wrap.appendChild(line2d);
    cards2d = PLATES.map(function (p, i) {
      var el = doc.createElement("div");
      el.className = "fi2d-plate";
      var img = doc.createElement("img");
      img.alt = ""; img.decoding = "async"; img.src = p[0];
      var tab = doc.createElement("span");
      tab.className = "fi2d-tab"; tab.textContent = p[1];
      el.appendChild(img);
      if (i === HERO2D) { paper2d = doc.createElement("div"); paper2d.className = "fi2d-paper"; el.appendChild(paper2d); }
      el.appendChild(tab);
      return el;
    });
    // the back of the drawer is drawn first so the front plates sit over it
    for (var i = cards2d.length - 1; i >= 0; i--) wrap.appendChild(cards2d[i]);
    wrap.appendChild(beam2d);
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
  function cl(x) { return Math.min(1, Math.max(0, x)); }
  function ease(x) { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function out3(x) { x = cl(x); return 1 - Math.pow(1 - x, 3); }
  function apply2D(t) {
    var vw = w.innerWidth, vh = w.innerHeight, portrait = vw / vh < 0.8;
    var pw = portrait ? vw * 0.62 : Math.min(vw * 0.3, 420), ph = pw * 0.75;
    var cur = HERO2D * out3((t - 0.35) / 1.3);           // riffle down the drawer
    var lift = out3((t - 1.55) / 0.75);                  // FM-000 comes up out of it
    var dev = ease((t - 2.0) / 0.75);                    // develops: shadows first
    var col = ease((t - 2.35) / 0.7);                    // then colour
    var lit = ease((t - 2.65) / 0.7);                    // the room lights come up
    var land = ease((t - 2.95) / 0.75);                  // and it lands on the page
    var tg = heroTarget();
    var stageW = portrait ? vw * 0.84 : Math.min(vw * 0.5, 700), stageS = stageW / pw;
    cards2d.forEach(function (el, i) {
      el.style.width = pw + "px"; el.style.height = ph + "px";
      el.style.marginLeft = -pw / 2 + "px"; el.style.marginTop = -ph / 2 + "px";
      var depth = i - cur, hero = i === HERO2D;
      var tip = i < HERO2D ? cl(cur - i + 0.15) : 0;
      var ty = depth * -ph * 0.11 + ph * 0.2, sc = Math.pow(0.93, Math.max(-1, depth));
      var rx = tip * 78, tx = 0, op = Math.min(1, t / 0.4) * (1 - lift * (hero ? 0 : 1));
      if (hero) {
        ty = lerp2(ty, -ph * 0.05, lift) - Math.sin(Math.min(1, lift) * Math.PI) * ph * 0.12;
        sc = lerp2(sc, stageS, lift);
        if (tg) {
          tx = (tg.x + tg.w / 2 - vw / 2) * land;
          ty = lerp2(ty, tg.y + tg.h / 2 - vh / 2, land);
          sc = lerp2(sc, tg.w / pw, land);
        }
        op = Math.min(1, t / 0.4) * (1 - ease((t - 3.75) / 0.3));
      }
      el.style.opacity = op.toFixed(3);
      el.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px) scale(" + sc.toFixed(4) +
        ") rotateX(" + rx.toFixed(1) + "deg)";
      el.style.zIndex = hero ? 20 : 10 - i;
      el.style.filter = hero ? "none" : "brightness(" + (0.55 + 0.45 * Math.max(0, 1 - Math.abs(depth) * 0.5)).toFixed(3) + ")";
    });
    var heroImg = cards2d[HERO2D] && cards2d[HERO2D].firstChild;
    if (heroImg) heroImg.style.filter = col >= 1 ? "none" :
      "grayscale(" + (1 - col) + ") contrast(" + (1 + 0.32 * (1 - col)) + ") sepia(" + (0.6 * (1 - col)) +
      ") hue-rotate(" + (186 * (1 - col)) + "deg) saturate(" + (1 + (1 - col)) + ")";
    if (paper2d) paper2d.style.opacity = (1 - dev).toFixed(3);
    line2d.style.transform = "scaleX(" + out3(t / 0.8).toFixed(3) + ")";
    line2d.style.opacity = (Math.min(1, t / 0.15) * (1 - cl((t - 1.4) / 0.6))).toFixed(3);
    beam2d.style.opacity = (cl((t - 1.7) / 0.4) * (1 - lit)).toFixed(3);
    var a = 1 - ease((t - 3.3) / 0.45);                  // the page comes through as it docks
    room(mix(DARK, PAPER, lit), a, 1 - lit);
    if (t >= 3.05) release();
    dock(t >= 3.7);
  }
  function lerp2(a, b, k) { return a + (b - a) * k; }

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
