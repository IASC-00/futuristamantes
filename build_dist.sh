#!/usr/bin/env bash
# Build the PUBLIC deploy surface into dist/.
#
# ALLOWLIST approach: only files copied here ship to futuristamantes.com.
# Why: `wrangler pages deploy` does NOT honor .assetsignore, and with
# pages_build_output_dir="." it published source/internal files
# (gen_*.py, overview/ incl. an internal Hurdles PDF, scripts/, docs/, *.md).
# A denylist failed silently; an allowlist cannot leak a file it was never told to copy.
#
# After editing the site, run: ./build_dist.sh && npx wrangler pages deploy --project-name futuristamantes
set -euo pipefail
cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist/fonts dist/images dist/vendor

# Top-level public files
for f in index.html style.css main.js work.json favicon.svg \
         robots.txt sitemap.xml site.webmanifest _headers; do
  cp "$f" dist/
done

# Self-hosted fonts
cp fonts/archivo-var.woff2 \
   fonts/newsreader-var.woff2 \
   fonts/newsreader-italic-var.woff2 dist/fonts/

# Third-party vendored JS
cp vendor/emailjs.min.js dist/vendor/

# Homepage intro: controller + 3D scene, and Three.js r169 (MIT) for it
mkdir -p dist/intro dist/vendor/three
cp intro/intro.css intro/intro.js intro/intro3d.js dist/intro/
cp vendor/three/three.module.min.js vendor/three/RoomEnvironment.js vendor/three/LICENSE dist/vendor/three/

# Images: hero, social card, concept stills (c-*), product stills (p-*).
# NEVER copy images/gen, images/gen-demos, images/gen-products (FLUX source PNGs).
cp images/hero.webp images/og.jpg dist/images/
cp images/c-*.webp dist/images/
cp images/p-*.webp dist/images/

echo "dist/ built ($(find dist -type f | wc -l) files):"
find dist -type f | sort
