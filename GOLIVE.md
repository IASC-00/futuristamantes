# Futuristamantes — Go-Live Runbook

_Last updated 2026-06-21. The new studio site is built, verified locally, and pushed
to GitHub (`IASC-00/futuristamantes`, branch `main`). Two things stand between it and
`https://futuristamantes.com`: **publish to Cloudflare Pages**, then **point DNS**.
Both are dashboard/registrar steps (interactive logins) — they can't be automated from
the build environment._

---

## Current state

- **Code:** done, on GitHub `main`. Local verified in Chrome (1440 + 390), no console errors.
- **`futuristamantes.pages.dev`:** still serving the OLD build — the Pages project is
  **not git-connected**, so the GitHub push did NOT auto-deploy. Fix = Step 1.
- **`futuristamantes.com`:** still the OLD WordPress site on Namecheap hosting
  (`162.0.215.108`). Fix = Step 2.
- **Email:** the domain has live mail — MX `mx1/2/3-hosting.jellyfish.systems`,
  SPF `v=spf1 +a +mx +ip4:162.0.215.103 include:spf.web-hosting.com ~all`. These MUST
  be preserved during the DNS move or email breaks.

---

## Step 1 — Publish the new build to Cloudflare Pages

Pick ONE:

### Option A — Connect the repo for auto-deploy (recommended; every future push goes live)
1. dash.cloudflare.com → **Workers & Pages** → open the existing `futuristamantes` project.
2. **Settings → Builds & deployments → Connect to Git** → authorize GitHub → select
   `IASC-00/futuristamantes`.
3. Build config: **Framework preset = None**, **Build command = (empty)**,
   **Output directory = `/`**, **Production branch = `main`**.
4. **Save → Retry deployment** (or push any commit). ~30s later `futuristamantes.pages.dev`
   shows the new site (title "Futuristamantes — We remember the future.").

### Option B — One-time manual deploy via Wrangler (from `~/futuristamantes`)
```
npx wrangler login           # opens browser, authorize
npx wrangler pages deploy . --project-name futuristamantes
```
(Option A is better — it restores the auto-deploy the workflow assumes.)

**Verify:** open `https://futuristamantes.pages.dev` — you should see the viewfinder HUD,
the "Acquiring Signal" cold-open, and the new green-metropolis hero.

---

## Step 2 — Point futuristamantes.com at the Pages site

The apex domain can't CNAME to Pages on Namecheap's hosting DNS, so move the domain to
Cloudflare DNS (Cloudflare already emailed you to finish this on 2026-05-24).

1. **Cloudflare → futuristamantes.com zone → Overview:** note the two assigned
   nameservers (`xxx.ns.cloudflare.com`).
2. **Cloudflare → DNS → Records:** BEFORE switching, make sure these exist (re-add if the
   import missed them) so email survives:
   - `MX` → `mx1-hosting.jellyfish.systems` (priority 5), `mx2-` (10), `mx3-` (20)
   - `TXT` SPF → `v=spf1 +a +mx +ip4:162.0.215.103 include:spf.web-hosting.com ~all`
   - any webmail/autodiscover/DKIM records the old host published
3. **Namecheap → Domain List → futuristamantes.com → Manage → Nameservers → Custom DNS:**
   enter the two Cloudflare nameservers. Save. (Propagation: minutes–few hours.)
4. **Cloudflare → Pages project → Custom domains:** add `futuristamantes.com`, then
   `www.futuristamantes.com`. Cloudflare auto-creates records + issues HTTPS.

**Verify (or ping me to run it):**
```
dig +short futuristamantes.com         # should resolve to Cloudflare, not 162.0.215.108
dig +short MX futuristamantes.com       # should still show jellyfish.systems
curl -I https://futuristamantes.com     # 200, valid HTTPS, new site
```

---

## Step 3 — (Optional) Enable direct contact-form sending

The form already works via the visitor's email client (mailto). To send silently in the
background instead, add EmailJS keys:
1. Create a free account at emailjs.com → add an email service + a template.
2. In `main.js`, fill the `EJS` object: `PUBLIC_KEY`, `SERVICE_ID`, `TEMPLATE_ID`.
3. Commit + push (auto-deploys if Step 1 Option A is done).
Template should expose: `from_name`, `org`, `reply_to`, `project_type`, `budget`, `message`.

---

## After go-live
- Replace `hello@futuristamantes.com` placeholders (footer, form fallback) with the real
  inbox if different.
- Grow the reel: drop clips/stills into `media/` + `images/`, add entries to `work.json`
  (set `status:"live"`), push.
