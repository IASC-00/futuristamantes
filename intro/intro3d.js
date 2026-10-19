/* Futuristamantes homepage intro, 3D scene (Three.js r169 + its jsm post-processing, self-hosted).

   The archive, after hours.
     1. A strip light draws on over a drawer of catalogue plates (dark room, cool light, dust).
     2. The camera rides a spline down the drawer while the plates riffle forward like cards in a
        file; focus racks plate to plate and the riffle decelerates onto FM-000, a blank sheet.
     3. FM-000 lifts out with weight into a projector beam. The beam locks with a flare and a light
        streak runs across the paper.
     4. It develops like a print in the tray: silver grains pop up in the densest shadows first,
        in uneven chemical patches, fuse into continuous tone, then colour blooms outward from the
        hot centre of the beam.
     5. The room lights come up to the page's paper, every effect eases to zero, and the print
        lands pixel for pixel on the page's hero plate; the overlay lets the page through.

   Rendering: plates are InstancedMesh (box, photo, back, tab) on atlases, physical paper
   materials lit by spot lights + a RoomEnvironment PMREM; additive beam cone + GPU dust points;
   post chain RenderPass > BokehPass (rack focus) > UnrealBloomPass > grade (ACES, vignette, film
   grain, slight chromatic aberration). Low tier (touch / small / few cores) drops DOF + MSAA and
   runs bloom at half resolution. From CONFIG.time.post[1] the post chain is neutral and the
   scene renders straight to a transparent canvas, so the handoff frame is the page's own pixels.

   Driven by intro.js through render(seconds) and backdrop(seconds). Every colour and timing a
   designer might want to touch is in CONFIG below. */
import * as THREE from "/vendor/three/three.module.min.js";
import { RoomEnvironment } from "/vendor/three/RoomEnvironment.js";
import { EffectComposer } from "/vendor/three/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "/vendor/three/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "/vendor/three/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "/vendor/three/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "/vendor/three/jsm/postprocessing/ShaderPass.js";

/* ============================== CONFIG ============================== */
export const CONFIG = {
  duration: 4.3,                       // seconds; intro.js ends the overlay here
  colors: {
    dark: [12, 15, 20],                // the archive at night (sRGB 0-255)
    paper: [234, 237, 241],            // --paper, the page the room lights up to
    ink: "#15181D",                    // --ink: plate frames, tabs
    tabText: "#EAEDF1",
    board: "#E6E9EE",                  // plate backs (archive board)
    edge: 0xeef0f3,                    // plate edges (board core)
    stamp: "#2233E6",                  // --accent, the ARCHIVED stamp on the backs
    tray: 0x1b1f27,
    photoPaper: [0.88, 0.89, 0.91],    // blank photo paper, linear (cool fibre base)
    latent: 0.1,                       // the faint rebate rule on the blank sheet, before it develops
    stripLight: 0xeaf0ff,
    stripGlow: [0.82, 0.9, 1.0],
    beamLight: 0xf4f7ff,
    beamGlow: [0.9, 0.94, 1.0],
    dust: [0.92, 0.95, 1.0],
    streak: [0.94, 0.97, 1.0],
    chemFront: [0.45, 0.6, 1.0],       // the cobalt edge of the colour as it spreads (the page's --duo)
  },
  time: {                              // [start, end] in seconds
    stripDraw: [0.06, 0.76],
    riffle: [0.44, 1.76],
    camera: [0.0, 2.56],               // spline from over the drawer to square on FM-000
    away: [1.68, 2.48],                // the rest of the drawer drops back into the dark
    awayPortrait: [1.4, 2.1],          // sooner on a phone, before FM-000 lifts through it
    lift: [1.64, 2.44],
    beamOn: [1.8, 2.36],
    beamOff: [2.96, 3.52],
    flare: 2.4,                        // the beam locking on
    streak: [2.34, 2.9],
    develop: [2.28, 3.08],
    colour: [2.64, 3.4],
    room: [2.84, 3.56],                // lights up: dark -> paper
    post: [2.96, 3.5],                 // post effects ease to zero with the lights; direct render after
    land: [3.08, 3.92],
    flat: [3.4, 3.88],                 // FM-000 becomes exactly the page's image
    overlay: [3.5, 3.95],              // the page comes through while the print is still landing
    vanish: [3.98, 4.24],
  },
  post: {
    bloom: { strength: 0.6, radius: 0.5, threshold: 1.0 },
    dof: { aperture: 0.009, maxblur: 0.009 },
    grain: 0.02, vignette: 0.38, aberration: 0.0016, exposure: 1.0,
  },
  light: { strip: 3.6, beam: 6, flare: 10, env: 0.35, stripGlow: 0.35 },
  portraitTip: 0.7,                    // phones: plates lean less as they riffle, so their backs don't fill the frame
};

/* ============================== layout constants ============================== */
const FRONT = [   // the drawer, front to back; FM-000 sits ninth
  ["/images/p-tech.webp", "FM-105"], ["/images/p-beauty.webp", "FM-104"],
  ["/images/p-fragrance.webp", "FM-103"], ["/images/p-food.webp", "FM-101"],
  ["/images/c-brand.webp", "FM-007"], ["/images/p-industrial.webp", "FM-106"],
  ["/images/c-waterfront.webp", "FM-003"], ["/images/p-auto.webp", "FM-108"],
];
const HERO_SRC = "/images/hero.webp", HERO_LABEL = "FM-000 · Establishing";
const HERO = FRONT.length, BEHIND = 5, N = HERO + 1 + BEHIND;
const PW = 4 / 3, PH = 1, THICK = 0.03, SP = 0.17;   // plate size (world), board, spacing
const STAGE_Y = 1.32;                                 // FM-000's centre height once lifted
// The page's CSS duotone (--duo), sampled on a 256-step grey ramp, so the plates match it.
const RAMP = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQICAwMEBAQGBQYIBgcJCAkLCQoNCgsPCw0RDQ4TDhAUDxEWEBIYEhQaExUcFBceFRgfFhkhGBsjGRwlGh4nGx8pHSAqHiIsHyMuICUwIiYyIyc0JCk1JSo3Jyw5KC07KS49KjA/LDFALTNCLjRELzVGMTdIMjhKMzpLNDtNNj1PNz5ROD9TOUFVO0JWPERYPUVaPkZcQEheQUlgQkthQ0xjRU1lRk9nR1BpSFJrSVNsS1RuTFZwTVdyTll0UFp2UVt3Ul15U157VWB9VmF/V2KBWGSCWmWEW2eGXGiIXWmKX2uMYGyNYW6PYm+RZHCTZXKVZnOXZ3WYaXaaanica3mebHqgbnyib32jcH+lcYCnc4GpdIOrdYStdoaueIeweYiyeoq0e4u2fI24fo65f4+7gJG9gZK/g5TBhJXDhZbEhpjGiJnIiZvKipzMi53OjZ/PjqDRj6LTkKPVkqTXk6bZlKfalancl6remKvgma3imq7knLDlnbHnnrLpn7TrobXtorfvo7jwpLryprv0p7z2qL74qb/6qsH7rML9rcP/rsX/r8b/scj/ssn/s8r/tMz/ts3/t8//uND/udH/u9P/vNT/vdb/vtf/wNj/wdr/wtv/w93/xd7/xuD/x+H/yeP/yuT/y+b/zef/zun/0Or/0ez/0u3/1O//1vD/2fH/3PH/3/L/4/L/5vP/6fP/7PT/8PT/8/X/9vb/+vb//ff///f///j///j///j///j///n///n///n///n///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r/";

/* ============================== easing ============================== */
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, r) => clamp((t - r[0]) / (r[1] - r[0]));
const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out3 = (x) => 1 - Math.pow(1 - x, 3);
const out5 = (x) => 1 - Math.pow(1 - x, 5);
const smooth = (x) => x * x * (3 - 2 * x);
// a lift with weight: overshoots its mark a touch and settles back
const settle = (x) => (x >= 1 ? 1 : 1 - Math.pow(1 - x, 3) * Math.cos(x * Math.PI * 0.5) + Math.sin(x * Math.PI) * 0.035);
const T = CONFIG.time;

/* The room light, shared with intro.js so the CSS overlay under the canvas matches it. */
function room(t) { return io(seg(t, T.room)); }
export function backdrop(t) {
  const k = room(t), C = CONFIG.colors;
  return {
    rgb: C.dark.map((d, i) => Math.round(lerp(d, C.paper[i], k))),
    alpha: 1 - smooth(seg(t, T.overlay)),
    dark: 1 - k,
  };
}

/* ============================== procedural paper + print canvases ============================== */
function grainCanvas(size) {
  const c = document.createElement("canvas"); c.width = c.height = size;
  const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data;
  let s = 1234567;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < size * size; i++) {
    const v = 200 + rnd() * 40 + (rnd() < 0.02 ? -40 : 0);
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.globalAlpha = 0.07; g.lineWidth = 1;           // paper fibres
  for (let i = 0; i < 260; i++) {
    const x = rnd() * size, y = rnd() * size, a = rnd() * Math.PI, l = 6 + rnd() * 22;
    g.strokeStyle = rnd() < 0.5 ? "#000" : "#fff";
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  return c;
}

// the page's .tab: Archivo 600, .75rem, .08em tracking, uppercase, .42rem/.72rem padding
const TAB_K = 4, TAB_TW = 768, TAB_TH = 32 * TAB_K;
function drawTab(g, text, x0, y0) {
  const C = CONFIG.colors, fs = 12 * TAB_K, font = "600 " + fs + "px Archivo, system-ui, sans-serif";
  g.font = font;
  const label = text.toUpperCase(), track = fs * 0.08;
  let tw = 0; for (const ch of label) tw += g.measureText(ch).width + track;
  const w = Math.min(TAB_TW, Math.ceil(tw + 0.72 * 16 * TAB_K * 2));
  g.fillStyle = C.ink; g.fillRect(x0, y0, w, TAB_TH);
  g.fillStyle = C.tabText; g.textBaseline = "middle";
  let x = x0 + 0.72 * 16 * TAB_K;
  for (const ch of label) { g.fillText(ch, x, y0 + TAB_TH / 2 + TAB_K); x += g.measureText(ch).width + track; }
  return w;
}

// the reverse of a plate: archive board with the studio's stamp
function drawBack(g, label, grain, i, x0, y0, w, h) {
  const C = CONFIG.colors;
  g.save(); g.translate(x0, y0); g.scale(w / 640, h / 480);
  g.fillStyle = C.board; g.fillRect(0, 0, 640, 480);
  g.globalAlpha = 0.35; g.globalCompositeOperation = "multiply"; g.drawImage(grain, 0, 0, 640, 480);
  g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
  g.fillStyle = C.ink;
  g.font = "600 22px Archivo, system-ui, sans-serif"; g.fillText("FUTURISTAMANTES", 44, 70);
  g.font = "italic 400 34px Newsreader, Georgia, serif"; g.fillText("Catalogue of Futures", 44, 118);
  g.fillRect(44, 142, 552, 2);
  g.font = "600 20px Archivo, system-ui, sans-serif"; g.fillText("PLATE  " + label.toUpperCase(), 44, 186);
  g.globalAlpha = 0.55; g.font = "400 19px Archivo, system-ui, sans-serif";
  for (let r = 0; r < 4; r++) g.fillRect(44, 238 + r * 44, 552, 1);
  g.fillText("Concept  ·  Held in monochrome", 44, 226);
  g.globalAlpha = 0.75; g.strokeStyle = C.stamp; g.lineWidth = 4;
  g.translate(500 + (i % 3) * 14, 380 - (i % 2) * 16); g.rotate(-0.18 + (i % 4) * 0.07);
  g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(0, 0, 47, 0, Math.PI * 2); g.lineWidth = 1.5; g.stroke();
  g.fillStyle = C.stamp; g.font = "700 17px Archivo, system-ui, sans-serif"; g.textAlign = "center";
  g.fillText("ARCHIVED", 0, 6);
  g.restore();
}

// object-fit: cover into a tile
function drawCover(g, img, x, y, w, h) {
  const ia = img.naturalWidth / img.naturalHeight, ta = w / h;
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0;
  if (ia > ta) { sw = sh * ta; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / ta; sy = (img.naturalHeight - sh) / 2; }
  g.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => res(im); im.onerror = rej; im.src = src;
  });
}

/* ============================== shader snippets ============================== */
const NOISE = `
float fiHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fiNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fiHash(i), fiHash(i + vec2(1, 0)), f.x), mix(fiHash(i + vec2(0, 1)), fiHash(i + vec2(1, 1)), f.x), f.y); }
float fiFbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * fiNoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

// the grade: ACES (eases off at the end), sRGB, vignette, film grain, a breath of aberration
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uTone: { value: 1 }, uExposure: { value: 1 }, uGrain: { value: 0 },
    uVig: { value: 0 }, uCA: { value: 0 }, uTime: { value: 0 }, uAspect: { value: 1 },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `
uniform sampler2D tDiffuse; uniform float uTone, uExposure, uGrain, uVig, uCA, uTime, uAspect; varying vec2 vUv;
vec3 rrt(vec3 v){ vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c){
  const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= uExposure / 0.6; c = I * c; c = rrt(c); c = O * c; return clamp(c, 0.0, 1.0); }
vec3 srgb(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec2 d = vUv - 0.5;
  vec3 c = vec3(texture2D(tDiffuse, vUv - d * uCA).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv + d * uCA).b);
  c = mix(c, aces(c), uTone);
  c = srgb(c);
  float r = length(d * vec2(uAspect, 1.0)) / length(vec2(uAspect, 1.0) * 0.5);
  c *= 1.0 - uVig * smoothstep(0.35, 1.05, r);
  c += (h(vUv * 917.0 + fract(uTime * 7.3) * 31.0) - 0.5) * uGrain;
  gl_FragColor = vec4(c, 1.0);
}`,
};

/* ============================== the scene ============================== */
export async function create(host, opts) {
  const C = CONFIG.colors, P = CONFIG.post;
  const touch = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(innerWidth, innerHeight) < 600;
  const HIGH = !touch && !small && (navigator.hardwareConcurrency || 4) >= 4;   // quality tier

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  const PR = Math.min(devicePixelRatio || 1, HIGH ? 2 : 1.5);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;   // tone mapping lives in the grade pass
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;

  if (document.fonts && document.fonts.load) {
    try {
      await Promise.race([Promise.all([
        document.fonts.load('600 44px "Archivo"'), document.fonts.load('italic 400 34px "Newsreader"'),
      ]), new Promise((r) => setTimeout(r, 700))]);
    } catch (e) { /* system font */ }
  }
  const images = await Promise.all(FRONT.map((p) => p[0]).concat([HERO_SRC]).map(loadImage));

  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  // additive light that never writes alpha (the canvas goes transparent for the handoff)
  const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
  const canvasTex = (cv, mips = true) => {
    const t = keep(new THREE.CanvasTexture(cv));
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = mips;
    return t;
  };

  const scene = new THREE.Scene();
  const bgCol = new THREE.Color();
  scene.background = bgCol;
  scene.fog = new THREE.Fog(0x000000, 2.6, 7.5);
  const pmrem = keep(new THREE.PMREMGenerator(renderer));
  const envRT = keep(pmrem.fromScene(new RoomEnvironment(), 0.04));
  scene.environment = envRT.texture;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 40);

  const ramp = (() => {
    const raw = atob(RAMP), n = raw.length / 3, data = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      data[i * 4] = raw.charCodeAt(i * 3); data[i * 4 + 1] = raw.charCodeAt(i * 3 + 1);
      data[i * 4 + 2] = raw.charCodeAt(i * 3 + 2); data[i * 4 + 3] = 255;
    }
    const t = keep(new THREE.DataTexture(data, n, 1, THREE.RGBAFormat));
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  })();
  const grainC = grainCanvas(512);
  const grain = keep(new THREE.CanvasTexture(grainC));
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.repeat.set(2, 1.5);

  /* ---------- light ---------- */
  const hemi = new THREE.HemisphereLight(0x9fb2d8, 0x0b0d12, 0.25);
  scene.add(hemi);
  const strip = new THREE.SpotLight(C.stripLight, 0, 9, 0.75, 1.0, 1.6);     // over the drawer
  strip.castShadow = true;
  strip.shadow.mapSize.set(HIGH ? 1024 : 512, HIGH ? 1024 : 512);
  strip.shadow.bias = -0.0006; strip.shadow.radius = 4;
  strip.shadow.camera.near = 0.3; strip.shadow.camera.far = 9;
  scene.add(strip, strip.target);
  const proj = new THREE.SpotLight(C.beamLight, 0, 0, 0.8, 1.0, 1.4);       // the projector
  scene.add(proj, proj.target);

  /* ---------- the drawer ---------- */
  const zOf = (i) => -i * SP;
  const zH = zOf(HERO), PLANE_Z = zH + 0.6;   // FM-000 is presented and lands in this plane
  const len = N * SP + 0.6;
  const trayMat = keep(new THREE.MeshStandardMaterial({ color: C.tray, roughness: 0.62, metalness: 0.25, transparent: true }));
  const tray = new THREE.Group();
  const floorGeo = keep(new THREE.BoxGeometry(PW + 0.34, 0.05, len));
  const floor = new THREE.Mesh(floorGeo, trayMat);
  floor.position.set(0, -0.025, zOf(N - 1) / 2 + 0.05); floor.receiveShadow = true;
  const wallGeo = keep(new THREE.BoxGeometry(0.04, 0.34, len));
  const wl = new THREE.Mesh(wallGeo, trayMat), wr = new THREE.Mesh(wallGeo, trayMat);
  wl.position.set(-(PW / 2 + 0.15), 0.17, floor.position.z); wr.position.set(PW / 2 + 0.15, 0.17, floor.position.z);
  wl.receiveShadow = wr.receiveShadow = true;
  const rodGeo = keep(new THREE.CylinderGeometry(0.012, 0.012, len, 10));
  const rodMat = keep(new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.25, metalness: 0.95, transparent: true }));
  const rod = new THREE.Mesh(rodGeo, rodMat);
  rod.rotation.x = Math.PI / 2; rod.position.set(0, 0.07, floor.position.z);
  tray.add(floor, wl, wr);
  scene.add(tray);

  // the strip light's tube, drawn on over the drawer, plus its glow (bloom picks it up)
  const tubeMat = keep(new THREE.MeshBasicMaterial({ color: new THREE.Color(C.stripLight).multiplyScalar(2.6), transparent: true, fog: false }));
  const tubeGeo = keep(new THREE.BoxGeometry(0.012, 0.012, 1));
  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  const haloMat = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD,
    uniforms: { uA: { value: 0 } },
    vertexShader: "varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform float uA; varying vec2 vU; void main(){ float d = abs(vU.y - 0.5) * 2.0; float e = smoothstep(0.0, 0.12, vU.x) * smoothstep(1.0, 0.88, vU.x); float g = exp(-d * d * 18.0) * 0.9 + exp(-d * 5.0) * 0.25; gl_FragColor = vec4(vec3(" + C.stripGlow.join(", ") + ") * g * e * uA, 1.0); }",
  }));
  const haloGeo = keep(new THREE.PlaneGeometry(1, 0.26));
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  const stripRig = new THREE.Group();
  stripRig.add(tube, halo);
  scene.add(stripRig);

  /* ---------- shared uniforms ---------- */
  const U = {
    uRamp: { value: ramp }, uGrain: { value: grain }, uDev: { value: 0 }, uCol: { value: 0 },
    uFlat: { value: 0 }, uStreak: { value: -1 }, uStreakA: { value: 0 }, uFade: { value: 1 },
  };
  const tgt0 = opts.target ? opts.target() : null;
  const bd = PW / (tgt0 ? tgt0.w : 515);   // the page's 1px ink frame, in world units

  /* ---------- atlases for the instanced drawer ---------- */
  const others = [];   // every plate but FM-000, front to back
  for (let i = 0; i < N; i++) if (i !== HERO) others.push(i);
  const labelOf = (i) => (i === HERO ? HERO_LABEL : i < HERO ? FRONT[i][1] : "FM-0" + (10 + i));
  // photos: 4 x 2 tiles of 640 x 480, backs: 4 x 4 tiles of 512 x 384 (half that on the low tier)
  const AQ = HIGH ? 1 : 0.5, PTW = 640 * AQ, PTH = 480 * AQ, BTW = 512 * AQ, BTH = 384 * AQ;
  const photoC = document.createElement("canvas"); photoC.width = PTW * 4; photoC.height = PTH * 2;
  { const g = photoC.getContext("2d"); FRONT.forEach((p, k) => drawCover(g, images[k], (k % 4) * PTW, Math.floor(k / 4) * PTH, PTW, PTH)); }
  const backC = document.createElement("canvas"); backC.width = BTW * 4; backC.height = BTH * 4;
  { const g = backC.getContext("2d"); others.concat([HERO]).forEach((i, k) => drawBack(g, labelOf(i), grainC, i, (k % 4) * BTW, Math.floor(k / 4) * BTH, BTW, BTH)); }
  // tabs: one row each
  const tabC = document.createElement("canvas"); tabC.width = TAB_TW; tabC.height = TAB_TH * (N + 1);
  const tabW = [];
  { const g = tabC.getContext("2d"); others.concat([HERO]).forEach((i, k) => { tabW[k] = drawTab(g, labelOf(i), 0, k * TAB_TH); }); }
  const photoAtlas = canvasTex(photoC), backAtlas = canvasTex(backC), tabAtlas = canvasTex(tabC);
  // uv rects (offset.xy, scale.zw), v flipped for flipY textures
  const rect = (x, y, w, h, W, H) => [x / W, 1 - (y + h) / H, w / W, h / H];

  /* ---------- materials ---------- */
  const tileVert = (s) => "attribute vec4 aTile;\nvarying vec2 vTile;\nvarying vec2 vPlain;\n" +
    s.replace("#include <uv_vertex>", "#include <uv_vertex>\nvPlain = uv; vTile = aTile.xy + uv * aTile.zw;");
  // a material whose map is read through the per-instance atlas rect
  function tiled(m, extraFrag) {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = tileVert(sh.vertexShader);
      sh.fragmentShader = "varying vec2 vTile;\nvarying vec2 vPlain;\nuniform sampler2D uRamp, uGrain; uniform float uFade;\n" +
        sh.fragmentShader.replace("#include <map_fragment>", extraFrag ||
          "vec4 sampledDiffuseColor = texture2D( map, vTile ); diffuseColor *= sampledDiffuseColor;");
    };
    return m;
  }
  const otherPhotoMat = keep(tiled(new THREE.MeshPhysicalMaterial({
    map: photoAtlas, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3, bumpMap: grain, bumpScale: 0.6, transparent: true,
  }), [
    // the catalogue is held in the page's duotone
    "vec3 lin = texture2D( map, vTile ).rgb;",
    "float ls = pow( clamp( dot( lin, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.0, 1.0 ), 1.0 / 2.2 );",
    "float gr = texture2D( uGrain, vPlain * vec2( 3.0, 2.25 ) ).r;",
    "diffuseColor.rgb *= texture2D( uRamp, vec2( ls, 0.5 ) ).rgb * ( 0.95 + 0.06 * gr );",
  ].join("\n")));
  otherPhotoMat.customProgramCacheKey = () => "fi-other-photo";
  const backMat = keep(tiled(new THREE.MeshStandardMaterial({ map: backAtlas, roughness: 0.85, bumpMap: grain, bumpScale: 0.8, transparent: true })));
  backMat.customProgramCacheKey = () => "fi-back";
  const tabMat = keep(tiled(new THREE.MeshStandardMaterial({ map: tabAtlas, roughness: 0.6, transparent: true })));
  tabMat.customProgramCacheKey = () => "fi-tab";
  const sideMat = keep(new THREE.MeshStandardMaterial({ color: C.edge, roughness: 0.9, transparent: true }));
  const inkMat = keep(new THREE.MeshStandardMaterial({ color: C.ink, roughness: 0.7, transparent: true }));

  // FM-000: blank photo paper that develops
  const heroTex = keep(new THREE.Texture(images[HERO]));
  heroTex.colorSpace = THREE.SRGBColorSpace; heroTex.anisotropy = 8;
  heroTex.minFilter = THREE.LinearMipmapLinearFilter; heroTex.needsUpdate = true;
  { const img = images[HERO], ia = img.naturalWidth / img.naturalHeight, a = PW / PH;   // object-fit: cover
    if (ia > a) { heroTex.repeat.set(a / ia, 1); heroTex.offset.set((1 - a / ia) / 2, 0); }
    else { heroTex.repeat.set(1, ia / a); heroTex.offset.set(0, (1 - ia / a) / 2); } }
  const heroMat = keep(new THREE.MeshPhysicalMaterial({
    map: heroTex, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.22, bumpMap: grain, bumpScale: 0.5, transparent: true, fog: false,
  }));
  const pp = C.photoPaper.map((v) => v.toFixed(3)).join(", "), cf = C.chemFront.join(", "), sk = C.streak.join(", ");
  heroMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = "varying vec2 vPlain;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\nvPlain = uv;");
    sh.fragmentShader = "uniform sampler2D uRamp, uGrain; uniform float uDev, uCol, uFlat, uStreak, uStreakA;\nvarying vec2 vPlain;\nvec3 fiTex;\n" +
      NOISE + sh.fragmentShader
      .replace("#include <map_fragment>", `
  vec3 lin = texture2D( map, vMapUv ).rgb; fiTex = lin;
  float ls = pow( clamp( dot( lin, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.0, 1.0 ), 1.0 / 2.2 );
  vec3 duo = texture2D( uRamp, vec2( ls, 0.5 ) ).rgb;
  float gr = texture2D( uGrain, vPlain * vec2( 3.0, 2.25 ) ).r;
  vec3 paper = vec3( ${pp} ) * ( 0.93 + 0.09 * gr );
  // a faint rebate rule, so the blank sheet reads as unexposed paper, not a missing image
  vec2 eu = min( vPlain, 1.0 - vPlain ) * vec2( 1.333, 1.0 );
  float rule = 1.0 - smoothstep( 0.0, 0.004, abs( min( eu.x, eu.y ) - 0.045 ) );
  paper *= 1.0 - ${C.latent.toFixed(3)} * rule * ( 1.0 - smoothstep( 0.0, 0.5, uDev ) );
  // developer: uneven chemical patches; dense shadows come up first, highlights last
  float chem = fiFbm( vPlain * vec2( 5.0, 3.75 ) + 1.7 );
  float dens = 1.0 - ls;
  float th = 0.02 + ( 1.0 - dens ) * 0.45 + ( chem - 0.5 ) * 0.3;
  float appear = smoothstep( th, th + 0.5, uDev ) * smoothstep( 0.0, 0.12, uDev );
  // silver-halide grains: each grain has its own threshold and pops up, then they fuse
  float g1 = mix( fiHash( floor( vPlain * vec2( 340.0, 255.0 ) ) ), fiNoise( vPlain * vec2( 120.0, 90.0 ) ), 0.5 );
  // grain lives inside the developing tone and fuses away as it reaches full density
  float m = appear * mix( 0.45 + 0.75 * g1, 1.0, smoothstep( 0.45, 0.9, uDev ) );
  vec3 mono = mix( paper, duo * ( 0.96 + 0.05 * gr ), m );
  // colour returns from the hot centre of the beam, along a ragged chemical front
  float r = length( ( vPlain - vec2( 0.52, 0.55 ) ) * vec2( 1.333, 1.0 ) ) / 0.86;
  r += ( fiFbm( vPlain * 4.0 + 3.1 ) - 0.5 ) * 0.28;
  float reach = uCol * 1.45;
  float cs = smoothstep( r - 0.3, r + 0.02, reach ) * smoothstep( 0.0, 0.06, uCol );
  vec3 col = mix( mono, lin, cs );
  float fx = ( reach - r - 0.06 ) * 7.0;
  float front = exp( -fx * fx ) * ( 1.0 - uCol ) * step( 0.001, uCol );
  col = mix( col, col * vec3( ${cf} ) * 1.6, front * 0.22 );
  diffuseColor.rgb *= col;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
  float sx = vPlain.x + ( 1.0 - vPlain.y ) * 0.42 - uStreak;
  totalEmissiveRadiance += vec3( ${sk} ) * ( exp( -sx * sx * 140.0 ) * 1.1 + exp( -sx * sx * 9.0 ) * 0.14 ) * uStreakA;`)
      // the last beat: exactly the page's pixels, so the handoff has no seam
      .replace("#include <colorspace_fragment>", "gl_FragColor.rgb = mix( gl_FragColor.rgb, fiTex, uFlat );\n#include <colorspace_fragment>");
  };
  heroMat.customProgramCacheKey = () => "fi-hero";
  const sideHero = keep(sideMat.clone()), inkHero = keep(inkMat.clone());
  sideHero.fog = inkHero.fog = false;
  const heroTabMat = keep(new THREE.MeshBasicMaterial({ map: tabAtlas, transparent: true, fog: false }));
  const heroBackMat = keep(new THREE.MeshStandardMaterial({ map: backAtlas, roughness: 0.85, transparent: true, fog: false }));

  /* ---------- geometry (pivot on the bottom edge, so plates tip like cards in a file) ---------- */
  const boxGeo = keep(new THREE.BoxGeometry(PW + bd * 2, PH + bd * 2, THICK)); boxGeo.translate(0, PH / 2, 0);
  const faceGeo = () => { const g = keep(new THREE.PlaneGeometry(PW, PH)); g.translate(0, PH / 2, 0); return g; };
  const backGeo = () => { const g = keep(new THREE.PlaneGeometry(PW + bd * 2, PH + bd * 2)); g.translate(0, PH / 2, 0); return g; };
  const tabGeo = () => keep(new THREE.PlaneGeometry(1, 1));
  const NO = others.length;
  const inst = (geo, mat, tiles) => {
    if (tiles) geo.setAttribute("aTile", new THREE.InstancedBufferAttribute(new Float32Array(tiles.flat()), 4));
    const m = new THREE.InstancedMesh(geo, mat, NO);
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    scene.add(m); return m;
  };
  const boxI = inst(boxGeo, [sideMat, sideMat, sideMat, sideMat, inkMat, sideMat]);
  const photoI = inst(faceGeo(), otherPhotoMat, others.map((i) => { const k = i % FRONT.length; return rect((k % 4) * PTW, Math.floor(k / 4) * PTH, PTW, PTH, photoC.width, photoC.height); }));
  const backI = inst(backGeo(), backMat, others.map((i, k) => rect((k % 4) * BTW, Math.floor(k / 4) * BTH, BTW, BTH, backC.width, backC.height)));
  const tabI = inst(tabGeo(), tabMat, others.map((i, k) => rect(0, k * TAB_TH, tabW[k], TAB_TH, TAB_TW, tabC.height)));
  tabI.castShadow = false;

  // FM-000 as its own group
  const hero = new THREE.Group();
  const hBox = new THREE.Mesh(boxGeo, [sideHero, sideHero, sideHero, sideHero, inkHero, sideHero]);
  hBox.castShadow = hBox.receiveShadow = true;
  const hPhoto = new THREE.Mesh(faceGeo(), heroMat);
  hPhoto.position.z = THICK / 2 + 0.0008; hPhoto.receiveShadow = true;
  const hBackGeo = backGeo();
  { const kk = NO, r = rect((kk % 4) * BTW, Math.floor(kk / 4) * BTH, BTW, BTH, backC.width, backC.height), uv = hBackGeo.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, r[0] + uv.getX(j) * r[2], r[1] + uv.getY(j) * r[3]); }
  const hBack = new THREE.Mesh(hBackGeo, heroBackMat);
  hBack.rotation.y = Math.PI; hBack.position.z = -THICK / 2 - 0.0008;
  const hTabGeo = tabGeo();
  { const r = rect(0, NO * TAB_TH, tabW[NO], TAB_TH, TAB_TW, tabC.height), uv = hTabGeo.attributes.uv;
    for (let j = 0; j < uv.count; j++) uv.setXY(j, r[0] + uv.getX(j) * r[2], r[1] + uv.getY(j) * r[3]); }
  const hTab = new THREE.Mesh(hTabGeo, heroTabMat);
  hero.add(hBox, hPhoto, hBack, hTab);
  scene.add(hero);

  // local offsets of each part inside a plate
  const L_PHOTO = new THREE.Matrix4().makeTranslation(0, 0, THICK / 2 + 0.0008);
  const L_BACK = new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, 0, -THICK / 2 - 0.0008);
  const L_TAB = [];
  function sizeTabs(tg) {
    const k = PW / (tg ? tg.w : 515);   // tabs are fixed CSS pixels against the hero's width
    others.forEach((i, j) => {
      const th = 32 * k, tw = th * (tabW[j] / TAB_TH);
      L_TAB[j] = new THREE.Matrix4().makeScale(tw, th, 1).setPosition(-PW / 2 + tw / 2, PH - th / 2, THICK / 2 + 0.0016);
    });
    const th = (tg ? tg.th : 32) * k, tw = tg ? tg.tw * k : th * (tabW[NO] / TAB_TH);
    hTab.scale.set(tw, th, 1);
    hTab.position.set(-PW / 2 + tw / 2, PH - th / 2, THICK / 2 + 0.0016);
  }

  /* ---------- the projector beam + the dust in it ---------- */
  const BEAM_L = 6;
  const beamMat = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD, side: THREE.DoubleSide, fog: false,
    uniforms: { uA: { value: 0 }, uT: { value: 0 } },
    vertexShader: "varying float vY; varying vec3 vN; varying vec3 vV; varying vec2 vU; void main(){ vY = 1.0 - uv.y; vU = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
    fragmentShader: NOISE + `uniform float uA, uT; varying float vY; varying vec3 vN; varying vec3 vV; varying vec2 vU;
void main(){ float f = abs(dot(normalize(vN), normalize(vV)));
  float haze = 0.75 + 0.5 * fiFbm(vec2(vU.x * 6.0 + uT * 0.05, vY * 3.0 - uT * 0.12));
  float a = (pow(f, 2.4) * pow(max(1.0 - vY, 0.0), 0.7) * smoothstep(0.0, 0.2, vY) + pow(f, 9.0) * 0.2) * haze;
  gl_FragColor = vec4(vec3(${C.beamGlow.join(", ")}) * a * uA * 0.2, 1.0); }`,
  }));
  const beamGeo = keep(new THREE.CylinderGeometry(0.03, 1.25, BEAM_L, 64, 1, true));
  beamGeo.translate(0, -BEAM_L / 2, 0); beamGeo.rotateX(-Math.PI / 2);   // apex at origin, opening along +z
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.renderOrder = 5;
  scene.add(beam);

  const DUST = HIGH ? 900 : 420;
  const dPos = new Float32Array(DUST * 3), dSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    const a = Math.random() * Math.PI * 2, along = 0.2 + Math.random() * 0.78, rr = Math.sqrt(Math.random());
    dPos[i * 3] = Math.cos(a) * rr * 1.2 * along; dPos[i * 3 + 1] = Math.sin(a) * rr * 1.2 * along;
    dPos[i * 3 + 2] = along * BEAM_L * 0.9; dSeed[i] = Math.random();
  }
  const dustGeo = keep(new THREE.BufferGeometry());
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  dustGeo.setAttribute("seed", new THREE.BufferAttribute(dSeed, 1));
  const dustMat = keep(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, ...ADD, fog: false,
    uniforms: { uA: { value: 0 }, uT: { value: 0 }, uPx: { value: 1 } },
    vertexShader: "attribute float seed; uniform float uT, uPx; varying float vA; void main(){ vec3 p = position; p.x += sin(uT * 0.6 + seed * 40.0) * 0.05; p.y += sin(uT * 0.45 + seed * 23.0) * 0.06 + uT * 0.02 * (seed - 0.5); p.z += cos(uT * 0.3 + seed * 9.0) * 0.05; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = uPx * (1.0 + seed * 2.8) * (3.0 / -mv.z); vA = (0.3 + 0.7 * fract(seed * 7.13)) * (0.6 + 0.4 * sin(uT * 3.0 + seed * 60.0)); }",
    fragmentShader: `uniform float uA; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); if (d > 0.25) discard; float g = exp(-d * 16.0); gl_FragColor = vec4(vec3(${C.dust.join(", ")}) * g * vA * uA, 1.0); }`,
  }));
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.renderOrder = 6; dust.frustumCulled = false;
  scene.add(dust);

  /* ---------- post-processing ---------- */
  const rt = keep(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: HIGH ? 4 : 0 }));
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  let bokeh = null;
  const FX = (location.search.match(/[?&]introfx=([a-z,]+)/) || [])[1] || "";   // debug: introfx=nobokeh,nobloom
  if (HIGH && !/nobokeh/.test(FX)) {
    bokeh = new BokehPass(scene, camera, { focus: 3, aperture: P.dof.aperture, maxblur: P.dof.maxblur });
    // the depth pre-pass must not see the light effects
    const bokehRender = bokeh.render.bind(bokeh);
    bokeh.render = (...a) => { beam.visible = dust.visible = stripRig.visible = false; bokehRender(...a); beam.visible = dust.visible = stripRig.visible = true; };
    composer.addPass(bokeh);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), P.bloom.strength, P.bloom.radius, P.bloom.threshold);
  if (!/nobloom/.test(FX)) composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  /* ---------- framing ---------- */
  let vw = 1, vh = 1, portrait = false, target = null;
  const camF = new THREE.Vector3();
  let camPath = null, lookPath = null;
  function layout() {
    vw = host.clientWidth || innerWidth; vh = host.clientHeight || innerHeight;
    portrait = vw / vh < 0.8;
    renderer.setSize(vw, vh, false);
    composer.setPixelRatio(PR); composer.setSize(vw, vh);
    bloom.resolution.set(vw * (HIGH ? 1 : 0.5), vh * (HIGH ? 1 : 0.5));
    camera.aspect = vw / vh;
    camera.fov = portrait ? 50 : 32;
    camera.updateProjectionMatrix();
    grade.uniforms.uAspect.value = vw / vh;
    dustMat.uniforms.uPx.value = PR * (portrait ? 1.6 : 2.2);
    target = opts.target ? opts.target() : null;
    sizeTabs(target);
    // the final camera: square to FM-000, so its landing maps to page pixels
    camF.set(0, STAGE_Y, PLANE_Z + (portrait ? 3.4 : 3.6));
    // the spline: in over the front of the drawer, down it, then up square to the print
    const back = portrait ? 3.0 : 2.35, lift0 = portrait ? 0.7 : 0;
    camPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.7, 2.55 + lift0, zOf(0) + back + 1.5),
      new THREE.Vector3(1.0, 2.0 + lift0, zOf(3) + back + 0.45),
      new THREE.Vector3(0.52, 1.62 + lift0 * 0.6, zOf(6.6) + back),
      new THREE.Vector3(0.22, 1.55, zH + back + 0.55),
      camF.clone(),
    ], false, "centripetal");
    lookPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.3, zOf(2.5)), new THREE.Vector3(0, 0.36, zOf(3.5)),
      new THREE.Vector3(0, 0.4, zOf(6.6) - lift0 * 0.3), new THREE.Vector3(0, 0.95, zH + 0.25),
      new THREE.Vector3(0, STAGE_Y, PLANE_Z),
    ], false, "centripetal");
  }
  layout();
  addEventListener("resize", layout);
  host.appendChild(canvas);

  const tanH = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function stagePose() {
    const D = camF.z - PLANE_Z, worldH = 2 * D * tanH(), worldW = worldH * camera.aspect;
    const s = Math.min((worldW * (portrait ? 0.84 : 0.56)) / PW, (worldH * (portrait ? 0.42 : 0.62)) / PH);
    return { pos: new THREE.Vector3(0, STAGE_Y - (PH * s) / 2 + (portrait ? 0.06 : 0.02), PLANE_Z), s };
  }
  function landingPose() {
    if (!target) return null;
    // the photo face sits THICK/2 in front of the pivot and scales with the plate
    const D0 = camF.z - PLANE_Z, c = THICK / 2 + 0.0008, A = (2 * tanH() * target.w) / (vh * PW);
    const s = (A * D0) / (1 + A * c), k = (PW * s) / target.w;
    const cx = target.x + target.w / 2, by = target.y + target.h;   // bottom edge = the pivot
    return { pos: new THREE.Vector3((cx - vw / 2) * k, STAGE_Y - (by - vh / 2) * k, PLANE_Z), s };
  }

  let lostCb = null;
  const onLost = (e) => { e.preventDefault(); if (lostCb) lostCb(); };
  canvas.addEventListener("webglcontextlost", onLost);

  const look = new THREE.Vector3(), tmp = new THREE.Vector3(), dummy = new THREE.Object3D(), mtx = new THREE.Matrix4();
  const focusPt = new THREE.Vector3();
  let resampled = false;
  function render(t) {
    if (!resampled && t >= T.land[0] && opts.target) {
      resampled = true;
      const tg = opts.target();
      if (tg) { target = tg; sizeTabs(tg); }
    }
    const dark = 1 - room(t);
    const bdc = backdrop(t);
    bgCol.setRGB(bdc.rgb[0] / 255, bdc.rgb[1] / 255, bdc.rgb[2] / 255, THREE.SRGBColorSpace);
    scene.fog.color.copy(bgCol);
    const toF = io(seg(t, [1.56, T.camera[1]]));
    scene.fog.near = lerp(2.6, 5, toF); scene.fog.far = lerp(7.5, 12, toF);
    scene.environmentIntensity = lerp(0.06, CONFIG.light.env, 1 - dark);

    /* the riffle: a cursor runs down the drawer and decelerates onto FM-000 */
    const cur = HERO * out3(seg(t, T.riffle));
    const lift = seg(t, T.lift), liftE = settle(lift);
    const land = io(seg(t, T.land));
    const away = io(seg(t, portrait ? T.awayPortrait : T.away));
    const tipK = portrait ? CONFIG.portraitTip : 1;

    /* camera on its spline; the spline's progress follows the riffle, then rises to the print */
    const u = clamp(0.06 * seg(t, [0, 0.4]) + 0.69 * out3(seg(t, [0.36, 1.76])) + 0.25 * io(seg(t, [1.56, T.camera[1]])));
    camPath.getPoint(u, camera.position);
    camera.position.y += Math.sin(t * 1.1) * 0.012 * (1 - toF);
    lookPath.getPoint(u, look);
    camera.lookAt(look);

    /* the strip light draws on over the drawer, front to back */
    const draw = out5(seg(t, T.stripDraw));
    const zf = 0.45, zb = zOf(N - 1) - 0.3, zEnd = lerp(zf, zb, draw), sLen = Math.max(0.001, zf - zEnd);
    stripRig.position.set(-(PW / 2 + 0.28), 1.3, zf - sLen / 2);   // runs along the drawer's left edge, clear of the lens path
    tube.scale.set(1, 1, sLen); halo.scale.set(sLen + 0.1, 1, 1);
    const stripOn = (0.25 + 0.75 * seg(t, [0.1, 0.64])) * (1 - 0.85 * seg(t, [1.32, 1.84])) * dark;
    tubeMat.opacity = seg(t, [0.04, 0.16]) * dark * (1 - seg(t, [1.32, 1.68]));
    stripRig.visible = tubeMat.opacity > 0.003; haloMat.uniforms.uA.value = stripOn * CONFIG.light.stripGlow;
    const zc = zOf(cur);
    strip.intensity = CONFIG.light.strip * stripOn * draw * (1 - smooth(seg(t, [1.52, 1.88])));
    strip.position.set(-0.1, 1.42, zc + 0.55);
    strip.target.position.set(0, 0, zc - 0.25);

    /* the drawer (instanced) */
    others.forEach((i, j) => {
      const jit = Math.sin(i * 12.9898) * 0.5;
      const tip = i < HERO ? smooth(clamp(cur - i + 0.15)) : 0;
      // on a phone a plate that has been passed sinks out of the frame instead of lying face-up in it
      const sink = portrait && i < HERO ? smooth(clamp((cur - i - 0.9) / 1.1)) : 0;
      dummy.position.set(jit * 0.02, -away * 1.1 - sink * 0.9, zOf(i));
      dummy.rotation.set(i < HERO ? tip * tipK * (1.22 + jit * 0.08) : -0.05 - (i - HERO) * 0.01, jit * 0.012, jit * 0.006);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      boxI.setMatrixAt(j, dummy.matrix);
      photoI.setMatrixAt(j, mtx.multiplyMatrices(dummy.matrix, L_PHOTO));
      backI.setMatrixAt(j, mtx.multiplyMatrices(dummy.matrix, L_BACK));
      tabI.setMatrixAt(j, mtx.multiplyMatrices(dummy.matrix, L_TAB[j]));
    });
    [boxI, photoI, backI, tabI].forEach((m) => { m.instanceMatrix.needsUpdate = true; });
    const o = 1 - away;
    [sideMat, inkMat, otherPhotoMat, backMat, tabMat, trayMat, rodMat].forEach((m) => { m.opacity = o; });
    const vis = o > 0.003;
    boxI.visible = photoI.visible = backI.visible = tabI.visible = tray.visible = vis;

    /* FM-000: out of the drawer, into the beam, onto the page */
    const stage = stagePose(), lp = landingPose();
    const pos = tmp.set(0, 0, zH).lerp(stage.pos, liftE);
    pos.y = lerp(0, stage.pos.y, liftE) + Math.sin(lift * Math.PI) * 0.18;
    let s = lerp(1, stage.s, out3(lift));
    if (lp) { pos.lerp(lp.pos, land); s = lerp(s, lp.s, land); }
    else { pos.y -= land * 0.2; s *= 1 - land * 0.1; }
    hero.position.copy(pos);
    hero.scale.setScalar(s);
    // it comes up tilted back, then squares to the lens; a slow float while it develops
    const fl = Math.sin(t * 1.4) * 0.03 * (1 - land) * seg(t, [2.32, 2.64]);
    hero.rotation.set(-0.22 * (1 - out3(lift)) + fl * 0.4, 0.28 * Math.sin(lift * Math.PI) * (1 - land) + fl * 0.3, -0.03 * Math.sin(lift * Math.PI));
    const vanish = 1 - smooth(seg(t, T.vanish));
    heroMat.opacity = sideHero.opacity = inkHero.opacity = heroTabMat.opacity = heroBackMat.opacity = vanish;
    // the tab is unlit ink: dim it with the room, full value once the lights are up
    heroTabMat.color.setScalar(lerp(lerp(0.3, 0.8, seg(t, [1.92, 2.4])), 1, 1 - dark));

    /* the beam: it finds the print, flares as it locks, then the room light takes over */
    const beamOn = smooth(seg(t, T.beamOn)) * (1 - io(seg(t, T.beamOff)));
    const flare = Math.exp(-Math.pow((t - T.flare) * 5.5, 2));
    proj.position.set(camF.x + 2.4, camF.y + 2.1, camF.z - 0.4);
    proj.target.position.set(hero.position.x, hero.position.y + (PH * s) / 2, hero.position.z);
    proj.intensity = (CONFIG.light.beam + flare * CONFIG.light.flare) * beamOn;
    beam.position.copy(proj.position);
    beam.lookAt(proj.target.position);
    const bl = proj.position.distanceTo(proj.target.position), br = (s * 0.95) / 1.25;
    beam.scale.set(br, br, (bl / BEAM_L) * 1.08);
    beamMat.uniforms.uA.value = beamOn * (1 + flare * 1.4);
    beamMat.uniforms.uT.value = t;
    dust.position.copy(beam.position); dust.quaternion.copy(beam.quaternion); dust.scale.copy(beam.scale);
    dustMat.uniforms.uA.value = beamOn * 0.9 + 0.3 * stripOn * (1 - toF);
    dustMat.uniforms.uT.value = t;

    /* develop, then colour; the streak runs across it as the beam locks */
    U.uDev.value = smooth(seg(t, T.develop));
    U.uCol.value = io(seg(t, T.colour));
    U.uStreak.value = lerp(-0.6, 1.9, out3(seg(t, T.streak)));
    U.uStreakA.value = Math.sin(seg(t, T.streak) * Math.PI);
    U.uFlat.value = smooth(seg(t, T.flat));

    hemi.intensity = lerp(0.28, 2.4, 1 - dark);
    hemi.color.setRGB(lerp(0.62, 1, 1 - dark), lerp(0.7, 1, 1 - dark), lerp(0.85, 1, 1 - dark));

    /* post: rack focus down the drawer then onto FM-000; everything eases to zero at the end */
    const post = 1 - smooth(seg(t, T.post));
    if (post <= 0) {
      // the handoff: straight to a transparent canvas, the page's paper is the CSS overlay
      scene.background = null;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      scene.background = bgCol;
      return;
    }
    if (bokeh) {
      focusPt.set(0, 0.5, zOf(Math.min(HERO, Math.ceil(cur - 0.05))) + 0.02).lerp(tmp.set(hero.position.x, hero.position.y + (PH * s) / 2, hero.position.z), smooth(seg(t, [1.52, 2.16])));
      const bu = bokeh.uniforms;
      bu.focus.value = camera.position.distanceTo(focusPt);
      bu.aperture.value = P.dof.aperture * lerp(1, 0.45, seg(t, [2.08, 2.72])) * post;
      bu.maxblur.value = P.dof.maxblur * post;
    }
    bloom.strength = P.bloom.strength * post * lerp(0.3, 1, dark) * (1 + flare * 0.6);
    const gu = grade.uniforms;
    gu.uTone.value = post; gu.uExposure.value = P.exposure;
    gu.uGrain.value = P.grain * post * lerp(0.6, 1, dark);
    gu.uVig.value = P.vignette * post * lerp(0.35, 1, dark);
    gu.uCA.value = P.aberration * post;
    gu.uTime.value = t;
    composer.render();
  }

  function dispose() {
    removeEventListener("resize", layout);
    canvas.removeEventListener("webglcontextlost", onLost);
    disposables.forEach((d) => { try { d.dispose(); } catch (e) { /* already gone */ } });
    try { composer.dispose(); bloom.dispose(); if (bokeh) bokeh.dispose(); grade.dispose(); } catch (e) { /* gone */ }
    [boxI, photoI, backI, tabI].forEach((m) => m.dispose());
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  // compile every program up front so the first visible frames don't stall
  render(0); render(T.camera[1]); render(CONFIG.duration - 0.2); render(0); resampled = false;
  return { render, backdrop, dispose, onLost: (cb) => { lostCb = cb; }, duration: CONFIG.duration,
    release: T.overlay[0] - 0.25, docked: T.land[1], tier: HIGH ? "high" : "low" };
}
