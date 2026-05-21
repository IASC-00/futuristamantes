# Futuristamantes

Cinematic urban futures site. Static HTML / CSS / vanilla JavaScript.

## Stack
- `index.html` — single-page structure (Landing, Manifesto, Field Studies, Process, Apply, Archive)
- `style.css` — typography (EB Garamond + Space Mono), atmospheric grain + scanlines, route-aware section backgrounds
- `main.js` — scroll reveals, nav fade-in, form transmit handler
- `images/` — Firefly renders (hero, about, work, contact, alt-bridge)

## Media-ready
The landing section is wired to swap to video as soon as `images/hero.mp4` (or `hero.webm`) is dropped in. Until then, `images/hero.png` is the poster + fallback. Same pattern can be extended to each Field Study card via the `.field-card-media` slot in `index.html` + corresponding CSS in `style.css`.

## Deploy
TBD — currently a flat static site. Candidates: Cloudflare Pages, GitHub Pages, Render Static. Whichever Ian picks, just serve the root directory as static.
