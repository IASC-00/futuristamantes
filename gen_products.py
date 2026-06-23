#!/usr/bin/env python3
"""Futuristamantes BRAND & PRODUCT portfolio stills — FLUX-dev via local ComfyUI.

A marketing-reel of cinematic product films across categories (food, drink,
fragrance, beauty, tech, industrial, spirits, automotive). Premium product
photography energy, each with its OWN grade (not the warm city grade) — the
site holds them in monochrome and reveals colour on hover, so they read as a
cohesive catalogue regardless of subject. NO text / signage / logos / branding.

  python3 gen_products.py                 # full set
  python3 gen_products.py food fragrance  # named shots

When done, convert to webp into images/ as p-<name>.webp (see tail of file).
"""

import json, sys, time, urllib.request, os, shutil

API = "http://127.0.0.1:8188"
CKPT = "flux1-dev-fp8.safetensors"
OUT = "/home/ias/futuristamantes/images/gen-products"
GUID = 2.6

# shared product-film tuning — clean, premium, photoreal, and strictly text-free
STYLE = (
    "cinematic product film still, anamorphic lens, shallow depth of field, "
    "premium commercial product photography, controlled studio lighting, "
    "immaculate surfaces, photoreal, ultra detailed, crisp focus on the hero object, "
    "no text, no signage, no logos, no lettering, no readable branding, no labels"
)

# name: (prompt, width, height, steps)
SHOTS = {
    "food": (
        "a luxurious artisan dark chocolate bar on a dark honed-stone slab, one shard "
        "breaking away mid-air, glossy tempered sheen and fine cocoa dust, a single "
        "dramatic raking side light with deep soft falloff, warm rich tones, macro elegance, "
        + STYLE,
        1024,
        1280,
        28,
    ),
    "drink": (
        "a frosted glass bottle of a clear sparkling beverage beaded with condensation, "
        "backlit on a dark wet reflective surface, a crisp splash of liquid frozen in "
        "mid-motion beside it, cool clean cyan-white highlights, bubbles catching light, "
        + STYLE,
        1024,
        1280,
        28,
    ),
    "fragrance": (
        "a sculptural faceted glass perfume bottle on a lit pale-stone pedestal in a vast "
        "dark studio, soft volumetric rim light raking across the facets, a faint drifting "
        "mist of scent in the air, elegant mirror reflection on a polished floor, minimal "
        "and expensive, " + STYLE,
        1024,
        1280,
        28,
    ),
    "beauty": (
        "a glass skincare serum dropper bottle with a single golden droplet falling from "
        "the pipette, on a wet polished off-white surface, soft diffused beauty light, "
        "dewy luminous highlights, clean minimal spa palette, cinematic macro, "
        + STYLE,
        1024,
        1280,
        28,
    ),
    "tech": (
        "a pair of minimalist wireless earbuds and their case floating just above a dark "
        "matte pedestal, precise edge-lit highlights on brushed aluminium and glass, cool "
        "clean key light with a hard rim, deep shadow, levitation product hero, "
        + STYLE,
        1024,
        1280,
        28,
    ),
    "industrial": (
        "a cinematic factory film still: a precision robotic arm at work on a spotless "
        "modern production line, a shower of sparks and motion blur, dramatic volumetric "
        "shafts of light through faint haze, polished steel machinery receding in scale, "
        "cool industrial teal-grey grade, " + STYLE,
        1344,
        768,
        28,
    ),
    "spirits": (
        "a crystal whiskey decanter and a heavy lowball glass holding amber spirit over a "
        "single large clear ice sphere, warm backlight glowing through the liquid, a dark "
        "moody bar setting, a slow curl of smoke, rich amber-and-shadow grade, "
        + STYLE,
        1024,
        1280,
        28,
    ),
    "auto": (
        "a sculptural sports-car detail — the wet curved rear quarter-panel and wheel of a "
        "dark luxury car reflecting long studio strip-lights in a black room, beads of "
        "water, chiaroscuro highlights tracing the bodyline, motion implied, " + STYLE,
        1344,
        768,
        28,
    ),
}


def graph(prompt, seed, prefix, w, h, steps):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["1", 1]},
        },
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {
            "class_type": "FluxGuidance",
            "inputs": {"conditioning": ["2", 0], "guidance": GUID},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": w, "height": h, "batch_size": 1},
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["4", 0],
                "negative": ["3", 0],
                "seed": seed,
                "steps": steps,
                "cfg": 1.0,
                "sampler_name": "euler",
                "scheduler": "simple",
                "denoise": 1.0,
                "latent_image": ["5", 0],
            },
        },
        "7": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["6", 0], "vae": ["1", 2]},
        },
        "8": {
            "class_type": "SaveImage",
            "inputs": {"images": ["7", 0], "filename_prefix": prefix},
        },
    }


def submit(g):
    data = json.dumps({"prompt": g}).encode()
    req = urllib.request.Request(
        API + "/prompt", data=data, headers={"Content-Type": "application/json"}
    )
    return json.loads(urllib.request.urlopen(req).read())["prompt_id"]


def wait(pid, timeout=600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = json.loads(urllib.request.urlopen(API + f"/history/{pid}").read())
            if pid in h:
                return h[pid]
        except Exception:
            pass
        time.sleep(2)
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    want = sys.argv[1:] or list(SHOTS)
    for i, name in enumerate(want):
        if name not in SHOTS:
            print(f"  ? unknown shot {name}")
            continue
        prompt, w, h, steps = SHOTS[name]
        seed = 9200 + i * 53
        print(f"[{i + 1}/{len(want)}] {name} ({w}x{h}, seed {seed}) ...", flush=True)
        pid = submit(graph(prompt, seed, f"fmprod/{name}", w, h, steps))
        res = wait(pid)
        if not res:
            print(f"  ! timeout {name}")
            continue
        for node in res.get("outputs", {}).values():
            for im in node.get("images", []):
                sub = im.get("subfolder", "")
                src = f"/home/ias/ComfyUI/output/{sub + '/' if sub else ''}{im['filename']}"
                dst = os.path.join(OUT, f"{name}.png")
                try:
                    shutil.copy(src, dst)
                    print(f"  -> {dst}", flush=True)
                except Exception as e:
                    print(f"  ! copy {src}: {e}")
    print("done")
    print("\nNext: convert to webp ->")
    print(
        "  cd ~/futuristamantes && for f in images/gen-products/*.png; do "
        'n=$(basename "$f" .png); cwebp -q 82 "$f" -o "images/p-$n.webp"; done'
    )


if __name__ == "__main__":
    main()
