/* ============================================================
   FUTURISTAMANTES — main.js
   Catalogue of Futures: data-driven two-track catalogue,
   filter, duotone→colour lightbox, develop-on-load, reveals.
   ============================================================ */
(function () {
  "use strict";
  var RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------- DEVELOP ON LOAD (hero duotone → colour + underline) ---------- */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { document.body.classList.add("loaded"); });
  });

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
    }, { threshold: 0, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (n) { io.observe(n); });
  })();

  /* ---------- CATALOGUE (data-driven, two tracks) ---------- */
  function cardEl(it) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "card";
    b.setAttribute("aria-label", "Open " + it.title);
    b.innerHTML =
      '<div class="shot"><span class="no-tag">' + esc(it.category) + '</span>' +
      '<img src="' + esc(it.img) + '" alt="' + esc(it.alt || it.title) + '" loading="lazy"></div>' +
      '<div class="meta"><span class="no">' + esc(it.id) + '</span>' +
      '<span class="ttl">' + esc(it.title) + '</span></div>' +
      '<p class="blurb">' + esc(it.blurb || "") + '</p>';
    b.addEventListener("click", function () { openLightbox(it); });
    return b;
  }

  function build(data) {
    var tracks = (data && data.tracks) || [];
    var works = (data && data.works) || [];
    var filters = document.getElementById("filters");
    var mount = document.getElementById("tracks");
    if (!mount) return;

    // filter chips: All + one per track
    var chips = [{ key: "all", label: "All" }].concat(
      tracks.map(function (t) { return { key: t.key, label: t.label }; })
    );
    chips.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (i === 0 ? " active" : "");
      b.textContent = c.label;
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      b.addEventListener("click", function () { setFilter(c.key, b); });
      filters.appendChild(b);
    });

    // track sections
    tracks.forEach(function (t) {
      var items = works.filter(function (w) { return w.track === t.key; });
      if (!items.length) return;
      var sec = document.createElement("section");
      sec.className = "track";
      sec.setAttribute("data-key", t.key);

      var head = document.createElement("div");
      head.className = "track-label";
      head.innerHTML =
        "<h3>" + esc(t.label) + "</h3><span class=\"rule\"></span>" +
        '<span class="meta">' + String(items.length).padStart(2, "0") +
        " · " + esc(t.note || "") + "</span>";

      var grid = document.createElement("div");
      grid.className = "grid";
      items.forEach(function (it) { grid.appendChild(cardEl(it)); });

      sec.appendChild(head);
      sec.appendChild(grid);
      mount.appendChild(sec);
    });
  }

  function setFilter(key, btn) {
    document.querySelectorAll("#filters .chip").forEach(function (c) {
      var on = c === btn;
      c.classList.toggle("active", on);
      c.setAttribute("aria-pressed", on ? "true" : "false");
    });
    document.querySelectorAll("#tracks .track").forEach(function (sec) {
      sec.hidden = !(key === "all" || sec.getAttribute("data-key") === key);
    });
  }

  fetch("/work.json")
    .then(function (r) { return r.json(); })
    .then(build)
    .catch(function () {/* leave catalogue empty if data missing */ });

  /* ---------- LIGHTBOX (full colour) ---------- */
  var lb = document.getElementById("lightbox");
  var lbStage = document.getElementById("lbStage");
  var lbCap = document.getElementById("lbCap");

  function openLightbox(item) {
    if (!lb || !lbStage) return;
    lbStage.innerHTML = '<img src="' + esc(item.img) + '" alt="' + esc(item.alt || item.title) + '">';
    lbCap.innerHTML =
      "<b>" + esc(item.id) + '</b><span class="ttl">' + esc(item.title) + "</span>" +
      (item.blurb ? "<span>— " + esc(item.blurb) + "</span>" : "");
    if (typeof lb.showModal === "function") { if (!lb.open) lb.showModal(); }
    else lb.setAttribute("open", "");
  }
  function closeLightbox() {
    if (lbStage) lbStage.innerHTML = "";
    if (lb && lb.open) lb.close();
  }
  if (lb) {
    var x = $(".lb-close", lb);
    if (x) x.addEventListener("click", closeLightbox);
    lb.addEventListener("cancel", function (e) { e.preventDefault(); closeLightbox(); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });
  }

  /* ---------- CONTACT FORM ---------- */
  (function form() {
    var f = document.getElementById("inquiry");
    if (!f) return;
    var status = document.getElementById("formStatus");
    var btn = $(".btn", f);

    // EmailJS — fill to enable direct send; until then, mailto fallback.
    var EJS = { PUBLIC_KEY: "", SERVICE_ID: "", TEMPLATE_ID: "" };
    var ejsReady = EJS.PUBLIC_KEY && EJS.SERVICE_ID && EJS.TEMPLATE_ID && window.emailjs;
    if (ejsReady) { try { window.emailjs.init({ publicKey: EJS.PUBLIC_KEY }); } catch (e) { ejsReady = false; } }

    function val(n) { var el = f.elements[n]; return el ? el.value.trim() : ""; }
    function say(msg) { if (status) status.textContent = msg; }

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!val("from_name") || !val("reply_to") || !val("message")) {
        say("Add your name, email, and a line about the project."); return;
      }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(val("reply_to"))) {
        say("That email doesn't look right — check it and resend."); return;
      }
      if (ejsReady) {
        btn.disabled = true; say("Sending…");
        window.emailjs.sendForm(EJS.SERVICE_ID, EJS.TEMPLATE_ID, f)
          .then(function () { f.reset(); btn.disabled = false; say("Received. We'll be in touch shortly."); })
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
        "?subject=" + encodeURIComponent("New commission — " + val("from_name")) +
        "&body=" + encodeURIComponent(body);
      window.location.href = href;
      say("Opening your email app to send. Prefer to copy us directly? hello@futuristamantes.com");
    }
  })();
})();
