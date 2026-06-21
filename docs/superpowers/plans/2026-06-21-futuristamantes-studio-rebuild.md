# Futuristamantes Studio Rebuild — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline). Steps use checkbox (`- [ ]`) syntax. This is a static, zero-build site — "tests" are render/responsive/Lighthouse/Chrome verification, not unit tests.

**Goal:** Rebuild futuristamantes.com as a single-page cinematic-scroll media-studio site in the refined-transmission aesthetic, data-driven work rails, EmailJS contact, shipped to Cloudflare Pages.

**Architecture:** One `index.html` of full-bleed sections, a `style.css` design system, a `main.js` for motion + data-driven work rendering + lightbox, and a `work.json` data source. Zero build; auto-deploys on push to `main`.

**Tech Stack:** Static HTML/CSS/vanilla-JS, self-hosted fonts, EmailJS (client-side), Cloudflare Pages.

## Global Constraints

- Zero build step; deploy = push to `IASC-00/futuristamantes` `main` → Cloudflare Pages.
- Palette: base `#0A0B0D`, text `#ECECEC`, accent amber `#E8732B`. No neon, no glitch.
- Copy: no personal names; no AI-tool credit; human-first voice.
- Accessibility: WCAG AA contrast, visible focus states, semantic HTML, alt text.
- Motion honors `prefers-reduced-motion` (reveals default visible; motion is enhancement).
- Hero LCP = poster still, never an autoplaying video. Media lazy-loads.
- Keep `_headers`; assets self-hosted, small (clips ≤ ~5 MB).

---

## File structure

- `index.html` — single page, all sections (rebuild)
- `style.css` — design tokens + reset + all section styles (rebuild)
- `main.js` — timecode, scroll-reveal, parallax, work rendering, lightbox, form (rebuild)
- `work.json` — work item data (create)
- `fonts/` — self-hosted display + mono fonts (create)
- `images/` — posters, og image, favicon (exists; add assets)
- `media/` — demo clips from Cutroom track (create, populated in parallel)
- `_headers`, `wrangler.jsonc` — keep
- `sitemap.xml`, `robots.txt`, `site.webmanifest` — create

---

### Task 1: Design system + base shell

**Files:** Modify `style.css`, `index.html`; Create `fonts/`

- [ ] Self-host a display face (e.g. Space Grotesk / Clash-style grotesk) + a monospace (e.g. JetBrains Mono / IBM Plex Mono) under `fonts/`; `@font-face` with `font-display: swap`.
- [ ] CSS custom properties: `--bg:#0A0B0D; --fg:#ECECEC; --accent:#E8732B; --muted:#7A7C80; --hairline:rgba(236,236,236,.14)`; spacing/typescale (clamp-based); z-layers.
- [ ] Modern reset; `body` bg/fg/font; `::selection` accent.
- [ ] Global overlays: fixed film-grain layer (CSS/SVG noise, low opacity, `pointer-events:none`) + vignette; both gated behind `prefers-reduced-motion`/opacity so they never hurt contrast.
- [ ] `index.html` skeleton: semantic `<header>`/`<main>`/`<footer>`, section anchors, skip-link, meta charset/viewport.
- [ ] **Verify:** open in Chrome (devtools MCP) — fonts load, dark base renders, grain subtle, no console errors. Commit.

### Task 2: Signal / Hero

**Files:** Modify `index.html`, `style.css`, `main.js`

- [ ] Hero markup: full-viewport section; `<video>` (muted/loop/playsinline, `poster` attr, `preload="none"`) behind a gradient scrim; wordmark `FUTURISTAMANTES` using `clamp()` font-size, `white-space:nowrap`, never clips at 320px+; tagline "We remember the future."; scroll cue.
- [ ] HUD overlay (monospace, accent): top-left `REC ●` (pulsing dot, reduced-motion = static), top-right `FM · PHILADELPHIA`, a running timecode element `00:00:00:00`.
- [ ] `main.js`: timecode ticker (rAF, increments frames/sec; static if reduced-motion); start hero video play on canplay only if not reduced-motion + not save-data.
- [ ] **Verify:** Chrome at 390/768/1440 — wordmark never clips, poster shows before video, HUD legible, timecode runs. Commit.

### Task 3: Manifesto

**Files:** Modify `index.html`, `style.css`

- [ ] Section with 5–7 declarative `.line` paragraphs, large editorial type, generous spacing; no personal names. Copy drafted in voice (warm, direct, future-facing).
- [ ] Scroll-reveal hook (`.reveal` class) — styled here, wired in Task 8.
- [ ] **Verify:** Chrome — readable, well-spaced, default-visible. Commit.

### Task 4: Transmissions / Work (data-driven)

**Files:** Create `work.json`; Modify `index.html`, `style.css`, `main.js`

- [ ] `work.json`: array of items per spec schema (`id,title,category,runtime,poster,clip,blurb,status,slug`). Seed: 1 `concept` (Brave New Philadelphia, status per asset availability) + one `incoming` per other category (brand/doc/social).
- [ ] `index.html`: Work section with 4 rail containers labeled CONCEPT / BRAND / DOCUMENTARY / SOCIAL, each with an empty `.rail-track`.
- [ ] `style.css`: card (poster `background-size:cover`, monospace tag `FM-### · runtime · CATEGORY`, title, blurb), hover lift + accent hairline, `// transmission incoming` placeholder card variant, horizontal-scroll rail with snap.
- [ ] `main.js`: fetch `work.json`, render cards into rails by category, render incoming slots; click `live` card → lightbox (`<dialog>` with `<video controls>`), Esc/backdrop close, focus trap, body scroll lock.
- [ ] **Verify:** Chrome — cards render from data, incoming slots styled intentionally, lightbox opens/plays/closes, keyboard works. Commit.

### Task 5: Capability / Process

**Files:** Modify `index.html`, `style.css`

- [ ] Section: short studio offering line + the four-stage method SIGNAL → SIMULATION → ALIGNMENT → EXECUTION as a numbered grid with monospace step IDs and one-line each, framed for client media work across the four categories.
- [ ] **Verify:** Chrome — grid responsive (4→2→1 col), hairline framing reads as viewfinder. Commit.

### Task 6: Start a Transmission (contact)

**Files:** Modify `index.html`, `style.css`, `main.js`

- [ ] Form: name, org, project type `<select>` (Concept/Future · Brand · Documentary · Social), budget range `<select>`, message; labels associated, required where sensible, visible focus.
- [ ] EmailJS: load SDK from CDN; `main.js` init with placeholder constants `EMAILJS_PUBLIC_KEY / SERVICE_ID / TEMPLATE_ID` (clearly marked TODO for user keys); submit handler → `emailjs.sendForm`, success/error states inline; **`mailto:` fallback link** always present.
- [ ] **Verify:** Chrome — validation works, success/error UI shows (stub), mailto fallback present. Commit. (Live send tested once user provides keys.)

### Task 7: Footer + meta/SEO plumbing

**Files:** Modify `index.html`, `_headers`; Create `sitemap.xml`, `robots.txt`, `site.webmanifest`, favicon + og image

- [ ] Footer: wordmark, tagline, email + social links, ©2026.
- [ ] `<head>`: title, description, canonical (set), OG + Twitter card meta (image = `images/og.jpg`), theme-color, manifest link, favicon set.
- [ ] Create `sitemap.xml`, `robots.txt` (allow + sitemap), `site.webmanifest`, generate favicon + a 1200×630 `og.jpg` (graded still + wordmark).
- [ ] Confirm `_headers` security headers intact.
- [ ] **Verify:** Chrome — meta present (devtools), favicon shows. Commit.

### Task 8: Motion system consolidation

**Files:** Modify `main.js`, `style.css`

- [ ] IntersectionObserver adds `.is-visible` to `.reveal` elements (staggered); CSS transitions translate/opacity; reduced-motion → instantly visible.
- [ ] Gentle hero parallax on scroll (transform only, rAF-throttled; off for reduced-motion).
- [ ] Card hover-scrub (seek preview video on pointer) where a clip exists.
- [ ] **Verify:** Chrome — reveals fire once, smooth ~60fps; toggle reduced-motion in devtools → all motion off, content visible. Commit.

### Task 9: Full verification pass

- [ ] Responsive sweep 390 / 768 / 1440 (Chrome MCP screenshots) — no clipping/overflow.
- [ ] Lighthouse audit (perf/a11y/best-practices/SEO) — address regressions; hero LCP = poster.
- [ ] Link/asset check (no 404s, no console errors).
- [ ] Final Chrome render-verify (pre-ship standard). Commit any fixes.

### Task 10: Deploy + go-live handoff

- [ ] Push `main` → confirm auto-deploy serves new site at `https://futuristamantes.pages.dev`.
- [ ] Verify pages.dev live render.
- [ ] Produce go-live handoff: DNS cutover steps (Cloudflare NS + preserve MX/SPF + attach custom domain) and EmailJS key insertion — the user-gated actions. Write CURRENT_STATE + SESSION handoff.

---

## Parallel Track P: Cutroom demo media

Independent of Tasks 1–9; assets drop into `media/` + `images/work/` and flip `work.json` items `incoming`→`live`.

- [ ] P1: Brave New Philadelphia teaser (~30–45s) via Cutroom from committed script → hero clip + concept card.
- [ ] P2: spec brand promo spot (~15–30s).
- [ ] P3: mini-doc fragment (~30s).
- [ ] P4: vertical social cut repurposed from the above.

---

## Self-review

- **Spec coverage:** §4 page structure → Tasks 2–7; §5 content model → Task 4; §6 visual/motion → Tasks 1,8; §7 demos → Track P; §8 tech/contact/go-live → Tasks 6,7,10; §9 verification → Task 9. ✓ no gaps.
- **Placeholders:** EmailJS keys are intentionally user-provided (flagged); all else concrete.
- **Consistency:** `work.json` schema identical in spec §5 and Task 4; category keys `concept|brand|doc|social` consistent across Tasks 4–6.
