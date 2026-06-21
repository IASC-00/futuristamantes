/* ============================================================
   FUTURISTAMANTES — main.js
   ============================================================ */
(function () {
  "use strict";
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- COLD OPEN ---------- */
  (function coldOpen() {
    var el = document.getElementById("coldopen");
    if (!el) return;
    if (RM) { el.remove(); return; }
    var kill = function () {
      el.classList.add("done");
      window.setTimeout(function () { el && el.remove(); }, 650);
      window.removeEventListener("wheel", kill);
      window.removeEventListener("touchstart", kill);
      window.removeEventListener("keydown", kill);
    };
    window.setTimeout(kill, 1350);
    window.addEventListener("wheel", kill, { passive: true });
    window.addEventListener("touchstart", kill, { passive: true });
    window.addEventListener("keydown", kill);
  })();

  /* ---------- LIVE TIMECODE (HH:MM:SS:FF @ 24fps) ---------- */
  (function timecode() {
    var tc = document.getElementById("timecode");
    if (!tc) return;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    if (RM) { tc.textContent = "00:00:00:00"; return; }
    var start = null;
    function frame(t) {
      if (start === null) start = t;
      var s = (t - start) / 1000;
      var ff = Math.floor((s * 24) % 24);
      var ss = Math.floor(s % 60);
      var mm = Math.floor((s / 60) % 60);
      var hh = Math.floor(s / 3600);
      tc.textContent = pad(hh) + ":" + pad(mm) + ":" + pad(ss) + ":" + pad(ff);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  })();

  /* ---------- SCROLL REVEAL ---------- */
  (function reveal() {
    var items = document.querySelectorAll(".reveal");
    if (RM || !("IntersectionObserver" in window)) {
      items.forEach(function (n) { n.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.16 });
    items.forEach(function (n) { io.observe(n); });
  })();

  /* ---------- HERO 3D CAMERA DRIFT (scroll + pointer) ---------- */
  (function heroMotion() {
    if (RM) return;
    var media = document.getElementById("heroMedia");
    if (!media) return;
    var fine = window.matchMedia("(pointer:fine)").matches;
    var px = 0, py = 0, ticking = false;
    function update() {
      var y = window.scrollY;
      var ty = (y < window.innerHeight ? y : window.innerHeight) * 0.14;
      media.style.transform =
        "translate3d(" + px.toFixed(2) + "px," + (ty + py).toFixed(2) + "px,0) scale(1.06)" +
        " rotateX(" + (-py * 0.05).toFixed(3) + "deg) rotateY(" + (px * 0.05).toFixed(3) + "deg)";
      ticking = false;
    }
    function req() { if (!ticking) { requestAnimationFrame(update); ticking = true; } }
    window.addEventListener("scroll", req, { passive: true });
    if (fine) {
      window.addEventListener("pointermove", function (e) {
        if (window.scrollY > window.innerHeight) return;
        px = ((e.clientX / window.innerWidth) - 0.5) * 28;
        py = ((e.clientY / window.innerHeight) - 0.5) * 18;
        req();
      }, { passive: true });
    }
    update();
  })();

  /* ---------- 3D CURSOR TILT ON WORK CARDS ---------- */
  (function cardTilt() {
    if (RM || !window.matchMedia("(pointer:fine)").matches) return;
    var last = null;
    function reset(c) { if (c) { c.classList.remove("is-tilting"); c.style.transform = ""; } }
    document.addEventListener("pointermove", function (e) {
      var card = e.target.closest ? e.target.closest(".card:not(.card--incoming)") : null;
      if (card !== last) { reset(last); last = card; if (card) card.classList.add("is-tilting"); }
      if (!card) return;
      var r = card.getBoundingClientRect();
      var rx = (e.clientY - r.top) / r.height - 0.5;
      var ry = (e.clientX - r.left) / r.width - 0.5;
      card.style.transform =
        "rotateX(" + (-rx * 6).toFixed(2) + "deg) rotateY(" + (ry * 8).toFixed(2) + "deg) translateZ(6px)";
    }, { passive: true });
    document.addEventListener("pointerleave", function () { reset(last); last = null; });
  })();

  /* ---------- WORK RAILS (data-driven) ---------- */
  var CATS = [
    { key: "concept", name: "Concept / Future" },
    { key: "brand",   name: "Brand" },
    { key: "doc",     name: "Documentary" },
    { key: "social",  name: "Social / Vertical" }
  ];

  function cardEl(item) {
    var live = item.status === "live";
    var card = document.createElement(live ? "button" : "div");
    card.className = "card" + (live ? "" : " card--incoming");
    if (live) {
      card.type = "button";
      card.setAttribute("aria-label", "Open " + item.title);
      var meta = item.runtime || "Still";
      card.innerHTML =
        '<div class="card-poster"><img src="' + item.poster + '" alt="' + (item.alt || item.title) + '" loading="lazy"></div>' +
        '<span class="card-tag"><span class="id">' + item.id + '</span> · ' + meta + ' · ' + catName(item.category) + '</span>' +
        '<span class="card-play" aria-hidden="true">' + (item.clip ? "▶" : "◱") + '</span>' +
        '<div class="card-body"><h3 class="card-title">' + item.title + '</h3>' +
        '<p class="card-blurb">' + (item.blurb || "") + '</p></div>';
      card.addEventListener("click", function () { openLightbox(item); });
    } else {
      card.innerHTML =
        '<div class="card-poster"><span class="incoming-mark">// Transmission Incoming<b>' +
        catName(item.category) + '</b></span></div>' +
        '<div class="card-body"><h3 class="card-title" style="color:var(--faint)">In production</h3>' +
        '<p class="card-blurb">New work is being rendered for this frequency.</p></div>';
    }
    return card;
  }

  function catName(k) {
    var c = CATS.filter(function (x) { return x.key === k; })[0];
    return c ? c.name : k;
  }

  function buildRails(data) {
    var root = document.getElementById("rails");
    if (!root) return;
    CATS.forEach(function (cat) {
      var items = data.filter(function (d) { return d.category === cat.key; });
      var liveCount = items.filter(function (d) { return d.status === "live"; }).length;
      if (!items.length) items = [{ category: cat.key, status: "incoming" }];

      var head = document.createElement("div");
      head.className = "rail-head";
      head.innerHTML = '<span class="rail-name">' + cat.name + '</span>' +
        '<span class="rail-count">' + (liveCount ? String(liveCount).padStart(2, "0") + " Transmission" + (liveCount > 1 ? "s" : "") : "Incoming") + '</span>';

      var track = document.createElement("div");
      track.className = "rail-track";
      items.forEach(function (it) { track.appendChild(cardEl(it)); });

      root.appendChild(head);
      root.appendChild(track);
    });
  }

  fetch("/work.json")
    .then(function (r) { return r.json(); })
    .then(buildRails)
    .catch(function () {
      var root = document.getElementById("rails");
      if (root) buildRails([]); // render incoming slots if data missing
    });

  /* ---------- LIGHTBOX ---------- */
  var lb = document.getElementById("lightbox");
  var lbStage = document.getElementById("lbStage");
  var lbCap = document.getElementById("lbCap");

  function openLightbox(item) {
    if (!lb || !lbStage) return;
    if (item.clip) {
      lbStage.innerHTML = '<video src="' + item.clip + '" controls autoplay playsinline poster="' + (item.poster || "") + '"></video>';
    } else {
      lbStage.innerHTML = '<img src="' + (item.full || item.poster) + '" alt="' + (item.alt || item.title) + '">';
    }
    lbCap.innerHTML = "<b>" + item.id + "</b> " + item.title + (item.blurb ? " — " + item.blurb : "");
    if (typeof lb.showModal === "function") lb.showModal(); else lb.setAttribute("open", "");
  }
  function closeLightbox() {
    var v = lbStage && lbStage.querySelector("video");
    if (v) v.pause();
    if (lbStage) lbStage.innerHTML = "";
    if (lb && lb.open) lb.close();
  }
  if (lb) {
    $(".lb-close", lb).addEventListener("click", closeLightbox);
    lb.addEventListener("cancel", function (e) { e.preventDefault(); closeLightbox(); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
  }

  /* ---------- CONTACT FORM ---------- */
  (function form() {
    var f = document.getElementById("inquiry");
    if (!f) return;
    var status = document.getElementById("formStatus");
    var btn = $(".btn", f);

    // EmailJS config — fill these in to enable direct send; until then the
    // form composes an email via the visitor's mail client (mailto fallback).
    var EJS = { PUBLIC_KEY: "", SERVICE_ID: "", TEMPLATE_ID: "" };
    var ejsReady = EJS.PUBLIC_KEY && EJS.SERVICE_ID && EJS.TEMPLATE_ID && window.emailjs;
    if (ejsReady) { try { window.emailjs.init({ publicKey: EJS.PUBLIC_KEY }); } catch (e) { ejsReady = false; } }

    function val(n) { var el = f.elements[n]; return el ? el.value.trim() : ""; }
    function say(msg, cls) { status.textContent = msg; status.className = "form-status" + (cls ? " " + cls : ""); }

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!val("from_name") || !val("reply_to") || !val("message")) {
        say("Add your name, email, and a line about the project.", "err"); return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("reply_to"))) {
        say("That email doesn't look right — check it and resend.", "err"); return;
      }

      if (ejsReady) {
        btn.disabled = true; say("Transmitting…");
        window.emailjs.sendForm(EJS.SERVICE_ID, EJS.TEMPLATE_ID, f)
          .then(function () { f.reset(); btn.disabled = false; say("Received. We'll be in touch shortly.", "ok"); })
          .catch(function () { btn.disabled = false; mailtoSend(); });
        return;
      }
      mailtoSend();
    });

    function mailtoSend() {
      var body =
        "Name: " + val("from_name") + "\n" +
        "Organization: " + val("org") + "\n" +
        "Email: " + val("reply_to") + "\n" +
        "Project type: " + val("project_type") + "\n" +
        "Budget: " + val("budget") + "\n\n" +
        val("message");
      var href = "mailto:hello@futuristamantes.com" +
        "?subject=" + encodeURIComponent("New transmission — " + val("from_name")) +
        "&body=" + encodeURIComponent(body);
      window.location.href = href;
      say("Opening your email app to send. Prefer to copy us directly? hello@futuristamantes.com", "ok");
    }
  })();
})();
