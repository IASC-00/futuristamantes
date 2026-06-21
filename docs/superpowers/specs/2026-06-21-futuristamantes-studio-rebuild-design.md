# Futuristamantes — Studio Rebuild Design

**Date:** 2026-06-21
**Status:** Approved (brainstorm complete) → ready for implementation plan
**Repo:** `IASC-00/futuristamantes` (public, `main`) · Local `~/futuristamantes/`
**Deploy:** Cloudflare Pages, zero-build, auto-deploy on push to `main`
**Domain:** `futuristamantes.com` (go-live = DNS cutover, see §8)

---

## 1. Purpose

Rebuild `futuristamantes.com` as a **media production studio** site — the public face
of the Cutroom production engine, in the Futuristamantes "we remember the future"
brand. It presents media services for potential clients and showcases in-house +
client work: short films, documentaries, brand films, and clips.

The body of work is thin today, so the **aesthetic and design carry the impression**
while a reel of short demos is produced in parallel (§7). Ship fast, iterate.

**Primary job:** make a visitor feel the studio's talent and worldview, and convert
serious inquiries into a "start a transmission" contact.

**Non-goals (YAGNI):** no CMS, no framework/build step, no per-project pages at launch
(designed-for but deferred), no Cloudflare Stream at launch, no blog, no e-commerce.

## 2. Constraints

- Stay on the existing **zero-build Cloudflare Pages** pipeline (no new infra).
- **Budget cap** — self-hosted small media, free-tier EmailJS; no paid services.
- **Equal-partnership copy** — no personal names (no Ian/Harry) in public copy.
- **No AI credit** — never name AI tools in the site or its content.
- **Human-first copy** — warm, direct; no keyword stuffing.
- Carry the prior **accessibility/security audit standard** (WCAG contrast, focus
  states, semantic HTML, alt text, `_headers`).

## 3. Approach (chosen)

**Single-page cinematic scroll**, static HTML/CSS/vanilla-JS, zero build. Each work
item is data-driven (§5) so it can graduate to its own `/work/<slug>` page later
without restructuring. (Rejected: multi-page studio — premature while content is
thin; Astro/framework — adds a build step to a pipeline that is already optimal.)

## 4. Page structure (top → bottom)

1. **Signal / Hero** — near-black full-bleed. Wordmark `FUTURISTAMANTES` (responsive
   clamp, never clips), tagline *"We remember the future."* Background = strongest
   demo clip looping muted, **poster-still first** (poster is the LCP, not the video).
   Restrained HUD overlay: `REC ●`, running timecode, `FM · PHILADELPHIA`. Scroll cue.
2. **Manifesto** — tightened declarative lines, large editorial type, generous black
   space. The worldview. No personal names.
3. **Transmissions / Work** — four labeled rails: *Concept / Future Films · Brand
   Films · Documentaries · Social & Vertical.* Each piece = card (poster, monospace
   tag `FM-001 · 0:32 · CONCEPT`, title, one line). Hover = scrub/preview; click =
   lightbox player. Thin rails show real demos + an intentional `// transmission
   incoming` slot (designed, not apologetic).
4. **Capability** — what the studio does + working method (SIGNAL → SIMULATION →
   ALIGNMENT → EXECUTION), framed as the client offering across the four categories.
5. **Start a Transmission** — inquiry form: name, org, project type (4 categories),
   budget range, message → EmailJS to a real inbox.
6. **Footer** — wordmark, tagline, email/social, ©.

## 5. Content model

Work items are **data, not hardcoded HTML** — a single source array (`work.json` or an
inline `<script type="application/json">`) drives all rails via one render function:

```json
{ "id": "FM-001", "title": "Brave New Philadelphia", "category": "concept",
  "runtime": "0:45", "poster": "images/work/bnp-poster.jpg",
  "clip": "media/bnp-teaser.mp4", "blurb": "A city remembers...",
  "status": "live", "slug": "brave-new-philadelphia" }
```

- `category` ∈ `concept | brand | doc | social` → routes to the correct rail.
- `status: "incoming"` renders the placeholder slot; `status: "live"` renders the
  player card.
- `slug` is dormant at launch; the same object later feeds a generated
  `/work/<slug>` case-study page (the deferred multi-page graduation).
- Adding a project = add one object + assets, push. No template surgery.

## 6. Visual & motion system (refined transmission)

- **Palette:** base `#0A0B0D`, text `#ECECEC`, single warm signal accent `#E8732B`
  (amber) used sparingly (tags, REC dot, key lines). Warm/cinematic, not neon/sci-fi.
- **Type:** strong display face for headlines + a monospace for technical labels /
  HUD / IDs. Self-hosted (no FOUT, fast).
- **Motifs (restrained):** fine film grain, subtle vignette, hairline brackets framing
  content like a viewfinder, monospace metadata (REC, timecodes, `FM-###`,
  "frequencies"). **No glitch, no scanline noise, no neon.**
- **Motion:** slow scroll-reveals (IntersectionObserver), gentle hero parallax,
  hover-scrub on cards, a live timecode — 60fps, all honoring
  `prefers-reduced-motion` (reveals default to visible, motion is enhancement).

## 7. Demo production track (parallel, feeds §4.3)

Produce **3–4 short pieces (~15–45s)** via the Cutroom transmission pipeline in the
Futuristamantes look, exercising the committed film scripts:

- **Concept/Future** — *Brave New Philadelphia* teaser (script exists in `scripts/`)
  → hero clip + concept rail.
- **Brand** — a spec promo spot.
- **Doc** — a mini-doc fragment (civic/food-systems b-roll + VO).
- **Social** — a vertical cut repurposed from the above.

Media is self-hosted optimized MP4/WebM, poster-first, lazy-loaded, ≤~5 MB each.
The site ships with whatever is ready; empty rails use the `// incoming` slot. This
track also advances the Cutroom software + script-to-film workflow.

## 8. Tech, contact, go-live

- **Stack:** static HTML/CSS/vanilla-JS, zero build, auto-deploy on push.
- **Contact:** EmailJS (free tier, client-side, matches the portfolio) → real inbox;
  `mailto:` fallback. Requires EmailJS service/template/public key (user-provided).
  Formspree placeholder is removed.
- **Plumbing:** keep `_headers`; add OG/Twitter meta, favicon, `sitemap.xml`,
  `robots.txt`; canonical already set.
- **Go-live (ship-fast):** build → push (auto-deploys to `futuristamantes.pages.dev`)
  → verify → **then cut DNS**: move nameservers to Cloudflare, **preserve MX
  (`mx1/2/3-hosting.jellyfish.systems`) + SPF** so email survives, attach
  `futuristamantes.com` + `www` as custom domains in the Pages project. Dashboard +
  registrar steps are the user's; agent verifies apex/www/HTTPS/email after.

## 9. Verification / done criteria

- Responsive at 390 / 768 / 1440; wordmark never clips.
- `prefers-reduced-motion` path verified.
- Lighthouse: strong perf/a11y/SEO; hero LCP = poster still.
- Chrome render-verify before claiming live (pre-ship standard).
- Contact form delivers a test inquiry to the real inbox.
- After DNS: `https://futuristamantes.com` + `www` serve the new site with valid
  HTTPS; `dig MX` still resolves jellyfish mail.

## 10. Open inputs needed from user (non-blocking for build)

- EmailJS service/template/public key + destination inbox.
- Final accent confirmation (amber `#E8732B` proposed).
- Cloudflare + Namecheap dashboard actions at cutover time.
