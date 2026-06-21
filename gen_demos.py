#!/usr/bin/env python3
"""Futuristamantes demo stills (Brand/Doc/Social rails) + Unreal sky panoramas.
FLUX-dev via local ComfyUI. Cinematic, location-agnostic, NO text/signage.
Per-shot dimensions. Outputs:
  site demos -> ~/futuristamantes/images/gen-demos/<name>.png
  unreal sky -> ~/unreal-pilot/assets/sky/<name>.png
"""

import json, sys, time, urllib.request, os, shutil

API = "http://127.0.0.1:8188"
CKPT = "flux1-dev-fp8.safetensors"
SITE_OUT = "/home/ias/futuristamantes/images/gen-demos"
SKY_OUT = "/home/ias/unreal-pilot/assets/sky"
GUID = 2.6

STYLE = (
    "cinematic film still, anamorphic lens, volumetric light, warm amber and teal "
    "color grade, photoreal, highly detailed, no text, no signage, no logos, no lettering"
)

# name: (prompt, width, height, steps, out_dir)
SHOTS = {
    # --- site demo rails ---
    "brand": (
        "a premium brand-film hero still: a single sculptural matte product form on a lit "
        "pedestal in a vast dark studio, soft volumetric rim light, faint reflection on a "
        "polished floor, elegant and minimal, " + STYLE,
        1344,
        768,
        28,
        SITE_OUT,
    ),
    "doc": (
        "a candid documentary film still: a thriving community garden at golden hour, two or "
        "three people tending tall raised vegetable beds seen at medium distance from behind, "
        "warm natural light, gentle film grain, authentic, " + STYLE,
        1344,
        768,
        28,
        SITE_OUT,
    ),
    "social": (
        "a punchy vertical cinematic still: a lone figure silhouetted on a rooftop at dusk "
        "overlooking a glowing green-futurist city, dramatic sky, bold negative space, "
        "shot for vertical social video, " + STYLE,
        768,
        1344,
        28,
        SITE_OUT,
    ),
    # --- unreal sky panoramas (2:1) ---
    "sky_dusk": (
        "equirectangular 360 panorama sky, golden-hour dusk, soft layered clouds, a "
        "distant green-futurist city skyline low on the horizon, warm amber light, "
        "seamless HDRI environment, no text",
        1536,
        768,
        26,
        SKY_OUT,
    ),
    "sky_day": (
        "equirectangular 360 panorama sky, bright clear morning, soft cumulus clouds, a "
        "faint distant city skyline on the horizon, cool clean light, seamless HDRI "
        "environment, no text",
        1536,
        768,
        26,
        SKY_OUT,
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
    os.makedirs(SITE_OUT, exist_ok=True)
    os.makedirs(SKY_OUT, exist_ok=True)
    want = sys.argv[1:] or list(SHOTS)
    for i, name in enumerate(want):
        if name not in SHOTS:
            continue
        prompt, w, h, steps, outdir = SHOTS[name]
        seed = 8300 + i * 41
        print(f"[{i + 1}/{len(want)}] {name} ({w}x{h}, seed {seed}) ...", flush=True)
        pid = submit(graph(prompt, seed, f"fmdemo/{name}", w, h, steps))
        res = wait(pid)
        if not res:
            print(f"  ! timeout {name}")
            continue
        for node in res.get("outputs", {}).values():
            for im in node.get("images", []):
                sub = im.get("subfolder", "")
                src = f"/home/ias/ComfyUI/output/{sub + '/' if sub else ''}{im['filename']}"
                dst = os.path.join(outdir, f"{name}.png")
                try:
                    shutil.copy(src, dst)
                    print(f"  -> {dst}", flush=True)
                except Exception as e:
                    print(f"  ! copy {src}: {e}")
    print("done")


if __name__ == "__main__":
    main()
