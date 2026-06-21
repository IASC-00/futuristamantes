#!/usr/bin/env python3
"""Futuristamantes concept stills — FLUX-dev txt2img via local ComfyUI.
CINEMATIC (the opposite of the exonerated photojournalism tuning): warm,
graded, atmospheric, biophilic-future architecture. LOCATION-AGNOSTIC — no
named landmarks, and explicitly NO readable text/signage/logos so nothing
reads as a specific city.

  python3 gen_concepts.py             # full set
  python3 gen_concepts.py hero plaza  # named shots
"""

import json, sys, time, urllib.request, os, shutil

API = "http://127.0.0.1:8188"
CKPT = "flux1-dev-fp8.safetensors"
OUT = "/home/ias/futuristamantes/images/gen"
W, H, STEPS, GUIDANCE = 1344, 768, 28, 2.6

STYLE = (
    "cinematic film still, anamorphic lens, shallow depth of field, volumetric "
    "golden-hour light, soft atmospheric haze, lush biophilic green architecture, "
    "vertical forests and hanging gardens, solar canopies, clean futurist forms, "
    "warm amber and teal color grade, photoreal, highly detailed, epic scale, "
    "no people in foreground, absolutely no text, no signage, no logos, no lettering"
)

SHOTS = {
    # hero — wide establishing future metropolis (replaces the Philadelphia hero)
    "hero": (
        "a sweeping wide establishing shot of a reborn green metropolis at golden "
        "hour, skyscrapers wrapped in vertical forests, an elevated curving maglev "
        "line threading between towers, terraced rooftop gardens and reflecting "
        "pools below, distant figures small in vast plazas, " + STYLE
    ),
    "plaza": (
        "a grand civic plaza reclaimed as terraced gardens and water channels, "
        "people walking at a distance, trees and wildflowers between stone paths, "
        "warm late-afternoon sun, a contained one-or-two building scene, " + STYLE
    ),
    "market": (
        "the cathedral-like interior of a historic market hall reborn as a vertical "
        "farm, towering green walls of vegetables and herbs, golden sun shafts "
        "through a steel-and-glass roof, wooden produce stalls, " + STYLE
    ),
    "waterfront": (
        "a regenerated river waterfront at sunset, floating wetlands and boardwalks, "
        "an elevated transit line crossing the water, low green towers reflected on "
        "the calm river, lanterns beginning to glow, " + STYLE
    ),
    "tower": (
        "a single immense residential green megastructure, a vertical neighborhood "
        "with cascading planted terraces and balconies, warm interior lights "
        "switching on at dusk, soft mist at its base, " + STYLE
    ),
    "transit": (
        "the serene interior of a future transit station, daylight pouring through "
        "a vaulted living roof of plants, clean curved platforms, a sleek train at "
        "rest, a few traveler silhouettes far down the platform, " + STYLE
    ),
}


def flux_graph(prompt, seed, prefix):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["1", 1]},
        },
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "", "clip": ["1", 1]}},
        "4": {
            "class_type": "FluxGuidance",
            "inputs": {"conditioning": ["2", 0], "guidance": GUIDANCE},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": W, "height": H, "batch_size": 1},
        },
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["4", 0],
                "negative": ["3", 0],
                "seed": seed,
                "steps": STEPS,
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


def submit(graph):
    data = json.dumps({"prompt": graph}).encode()
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
            continue
        seed = 7100 + i * 37
        print(f"[{i + 1}/{len(want)}] {name} (seed {seed}) ...", flush=True)
        pid = submit(flux_graph(SHOTS[name], seed, f"fmconcept/{name}"))
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


if __name__ == "__main__":
    main()
