/* Futuristamantes homepage intro, 3D scene (Three.js r169, self-hosted).
   A catalogue of plates riffles past a gliding camera; FM-000 comes forward, develops from the
   site's duotone hold to colour as a light passes over it, then lands exactly on the page's
   hero plate. Driven by intro.js through render(seconds). */
import * as THREE from "/vendor/three/three.module.min.js";
import { RoomEnvironment } from "/vendor/three/RoomEnvironment.js";

// The page's CSS duotone (--duo), sampled on a 256-step grey ramp, so the plates match it.
const RAMP = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQICAwMEBAQGBQYIBgcJCAkLCQoNCgsPCw0RDQ4TDhAUDxEWEBIYEhQaExUcFBceFRgfFhkhGBsjGRwlGh4nGx8pHSAqHiIsHyMuICUwIiYyIyc0JCk1JSo3Jyw5KC07KS49KjA/LDFALTNCLjRELzVGMTdIMjhKMzpLNDtNNj1PNz5ROD9TOUFVO0JWPERYPUVaPkZcQEheQUlgQkthQ0xjRU1lRk9nR1BpSFJrSVNsS1RuTFZwTVdyTll0UFp2UVt3Ul15U157VWB9VmF/V2KBWGSCWmWEW2eGXGiIXWmKX2uMYGyNYW6PYm+RZHCTZXKVZnOXZ3WYaXaaanica3mebHqgbnyib32jcH+lcYCnc4GpdIOrdYStdoaueIeweYiyeoq0e4u2fI24fo65f4+7gJG9gZK/g5TBhJXDhZbEhpjGiJnIiZvKipzMi53OjZ/PjqDRj6LTkKPVkqTXk6bZlKfalancl6remKvgma3imq7knLDlnbHnnrLpn7TrobXtorfvo7jwpLryprv0p7z2qL74qb/6qsH7rML9rcP/rsX/r8b/scj/ssn/s8r/tMz/ts3/t8//uND/udH/u9P/vNT/vdb/vtf/wNj/wdr/wtv/w93/xd7/xuD/x+H/yeP/yuT/y+b/zef/zun/0Or/0ez/0u3/1O//1vD/2fH/3PH/3/L/4/L/5vP/6fP/7PT/8PT/8/X/9vb/+vb//ff///f///j///j///j///j///n///n///n///n///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r///r/";
const PLATES = [
  ["/images/p-tech.webp", "FM-105"], ["/images/p-beauty.webp", "FM-104"],
  ["/images/p-fragrance.webp", "FM-103"], ["/images/hero.webp", "FM-000 · Establishing"],
  ["/images/p-food.webp", "FM-101"], ["/images/p-industrial.webp", "FM-106"],
  ["/images/c-waterfront.webp", "FM-003"],
];
const HERO = 3;
const PAPER = 0xeaedf1, INK = 0x15181d;

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const io = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const out = (x) => 1 - Math.pow(1 - x, 3);

function rampTexture() {
  const raw = atob(RAMP), n = raw.length / 3, data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = raw.charCodeAt(i * 3); data[i * 4 + 1] = raw.charCodeAt(i * 3 + 1);
    data[i * 4 + 2] = raw.charCodeAt(i * 3 + 2); data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function tabTexture(text) {
  const c = document.createElement("canvas"), g = c.getContext("2d");
  const fs = 44;
  g.font = "600 " + fs + "px Archivo, system-ui, sans-serif";
  const label = text.toUpperCase();
  const tw = Math.ceil(g.measureText(label).width + label.length * fs * 0.08);
  c.width = tw + fs * 1.4; c.height = Math.round(fs * 1.9);
  g.fillStyle = "#15181D"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "#EAEDF1"; g.font = "600 " + fs + "px Archivo, system-ui, sans-serif";
  g.textBaseline = "middle";
  let x = fs * 0.7;
  for (const ch of label) { g.fillText(ch, x, c.height / 2 + 2); x += g.measureText(ch).width + fs * 0.08; }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, aspect: c.width / c.height };
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = "async";
    im.onload = () => res(im); im.onerror = rej; im.src = src;
  });
}

export async function create(host, opts) {
  const touch = matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, touch ? 1.5 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const canvas = renderer.domElement;

  if (document.fonts && document.fonts.load) {
    try { await Promise.race([document.fonts.load('600 44px "Archivo"'), new Promise((r) => setTimeout(r, 700))]); } catch (e) { /* system font */ }
  }
  const images = await Promise.all(PLATES.map((p) => loadImage(p[0])));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PAPER, 9, 24);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.42;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  const disposables = [envRT, pmrem];
  const ramp = rampTexture(); disposables.push(ramp);
  const uDevelop = { value: 0 };

  // light: a soft key from upper left that casts the plates' shadows on the paper behind
  scene.add(new THREE.HemisphereLight(0xf5f7f9, 0xc9cfd8, 0.42));
  const key = new THREE.DirectionalLight(0xfff6ec, 1.65);
  key.position.set(-4, 6, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -12; key.shadow.camera.right = 12;
  key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 1; key.shadow.camera.far = 30;
  key.shadow.radius = 6; key.shadow.bias = -0.0004;
  scene.add(key);
  // the light that passes over FM-000 while it develops
  const sweep = new THREE.PointLight(0xffffff, 0, 6, 1.6);
  scene.add(sweep);

  const wallMat = new THREE.ShadowMaterial({ color: INK, opacity: 0.12 });
  const wallGeo = new THREE.PlaneGeometry(60, 30);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.z = -2.2; wall.receiveShadow = true;
  scene.add(wall);
  disposables.push(wallMat, wallGeo);

  const cardMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55, metalness: 0 });
  disposables.push(cardMat);

  function photoMaterial(img, aspect) {
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    // object-fit: cover
    const ia = img.naturalWidth / img.naturalHeight;
    if (ia > aspect) { tex.repeat.set(aspect / ia, 1); tex.offset.set((1 - aspect / ia) / 2, 0); }
    else { tex.repeat.set(1, ia / aspect); tex.offset.set(0, (1 - ia / aspect) / 2); }
    tex.needsUpdate = true;
    const m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3, transparent: true });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uRamp = { value: ramp };
      sh.uniforms.uDevelop = uDevelop;
      sh.uniforms.uMine = { value: 0 };
      m.userData.shader = sh;
      sh.fragmentShader = "uniform sampler2D uRamp;\nuniform float uDevelop;\nuniform float uMine;\n" +
        sh.fragmentShader.replace("#include <map_fragment>", [
          "#ifdef USE_MAP",
          "  vec4 sampledDiffuseColor = texture2D( map, vMapUv );",
          "  vec3 lin = sampledDiffuseColor.rgb;",
          "  float ls = pow( clamp( dot( lin, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.0, 1.0 ), 1.0 / 2.2 );",
          "  vec3 duo = texture2D( uRamp, vec2( ls, 0.5 ) ).rgb;",
          "  diffuseColor.rgb *= mix( duo, lin, uDevelop * uMine );",
          "#endif",
        ].join("\n"));
    };
    disposables.push(tex, m);
    return m;
  }

  // the plates
  const plates = PLATES.map((p, i) => {
    const hero = i === HERO;
    const aspect = hero ? 4 / 3 : 3 / 4;
    const h = hero ? 1.5 : 1.9, wdt = h * aspect;
    const g = new THREE.Group();
    const bd = 0.018;
    const cardGeo = new THREE.BoxGeometry(wdt + bd * 2, h + bd * 2, 0.02);
    const card = new THREE.Mesh(cardGeo, cardMat);
    card.castShadow = true;
    const photoGeo = new THREE.PlaneGeometry(wdt, h);
    const mat = photoMaterial(images[i], aspect);
    if (hero) mat.userData.hero = true;
    const photo = new THREE.Mesh(photoGeo, mat);
    photo.position.z = 0.0105;
    const tab = tabTexture(p[1]);
    const th = h * (hero ? 0.085 : 0.075), tw = th * tab.aspect;
    const tabGeo = new THREE.PlaneGeometry(tw, th);
    const tabMat = new THREE.MeshBasicMaterial({ map: tab.tex, transparent: true, toneMapped: false });
    const tabMesh = new THREE.Mesh(tabGeo, tabMat);
    tabMesh.position.set(-wdt / 2 + tw / 2, h / 2 - th / 2, 0.012);
    g.add(card, photo, tabMesh);
    scene.add(g);
    disposables.push(cardGeo, photoGeo, tab.tex, tabGeo, tabMat);
    return { g, mat, tabMat, w: wdt, h, hero, base: new THREE.Vector3() };
  });
  // FM-000 alone develops
  const heroPlate = plates[HERO];
  const prevCompile = heroPlate.mat.onBeforeCompile;
  heroPlate.mat.onBeforeCompile = (sh, r) => { prevCompile(sh, r); sh.uniforms.uMine.value = 1; };
  heroPlate.mat.customProgramCacheKey = () => "fi-hero";

  let vw = 1, vh = 1, portrait = false, target = null;
  const FINAL = new THREE.Vector3(0, 0, 7.2);
  function layout() {
    vw = host.clientWidth || innerWidth; vh = host.clientHeight || innerHeight;
    portrait = vw / vh < 0.8;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.fov = portrait ? 52 : 35;
    camera.updateProjectionMatrix();
    const gap = portrait ? 1.7 : 2.25;
    plates.forEach((p, i) => p.base.set((i - HERO) * gap, (i % 2 ? 0.12 : -0.1), (i % 3) * -0.35));
    target = opts.target ? opts.target() : null;
  }
  layout();
  addEventListener("resize", layout);
  host.appendChild(canvas);

  // world transform that puts the hero photo exactly over the page's hero plate
  function landingPose() {
    const z = 0.8, D = FINAL.z - z;
    const worldH = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const s = worldH / vh;
    if (!target) return null;
    const cx = target.x + target.w / 2, cy = target.y + target.h / 2;
    return {
      pos: new THREE.Vector3((cx - vw / 2) * s, -(cy - vh / 2) * s, z),
      scale: (target.w * s) / heroPlate.w,
    };
  }
  function stagePose() {
    // FM-000 front and centre, about 62% of the frame's width (82% on a phone)
    const z = 2.4, D = FINAL.z - z;
    const worldH = 2 * D * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const worldW = worldH * camera.aspect;
    const sc = (worldW * (portrait ? 0.82 : 0.62)) / heroPlate.w;
    return { pos: new THREE.Vector3(0, portrait ? 0.15 : 0.05, z), scale: Math.min(sc, (worldH * 0.62) / heroPlate.h) };
  }

  let lostCb = null;
  const onLost = (e) => { e.preventDefault(); if (lostCb) lostCb(); };
  canvas.addEventListener("webglcontextlost", onLost);

  const look = new THREE.Vector3();
  function render(t) {
    // camera: glides along the catalogue from the left, settling square to it
    const glide = io(seg(t, 0, 2.7));
    const camX = lerp(portrait ? -4.6 : -6.2, 0, glide);
    camera.position.set(camX, lerp(0.7, 0, glide) + Math.sin(t * 1.3) * 0.03 * (1 - glide), lerp(5.4, FINAL.z, io(seg(t, 0.4, 3.0))));
    look.set(lerp(camX + (portrait ? 1.3 : 2.2), 0, glide), 0, lerp(-0.6, 0, glide));
    camera.lookAt(look);

    const come = io(seg(t, 2.05, 3.15));   // FM-000 steps forward
    const fall = out(seg(t, 2.2, 3.3));    // the rest fall back into the paper
    const land = io(seg(t, 3.75, 4.6));    // and FM-000 lands on the page
    const dev = io(seg(t, 2.75, 3.75));
    uDevelop.value = dev;

    plates.forEach((p, i) => {
      const enter = out(seg(t, 0.05 + Math.abs(i - HERO) * 0.07, 0.75 + Math.abs(i - HERO) * 0.07));
      // riffle: each plate turns from edge-on to face the lens as the camera passes it
      const rel = (p.base.x - camera.position.x) / (portrait ? 2.2 : 3.2);
      const turn = clamp(rel, -1, 1) * -1.25 * (1 - glide * 0.8);
      if (!p.hero) {
        p.g.position.set(p.base.x * (1 + fall * 0.35), p.base.y - (1 - enter) * 0.6 - fall * 0.4, p.base.z - fall * 3.2);
        p.g.rotation.set(0, turn * (1 - fall) + fall * Math.sign(p.base.x) * -0.5, (i - HERO) * 0.012);
        const o = enter * (1 - fall);
        p.mat.opacity = o; p.tabMat.opacity = o; p.g.visible = o > 0.003;
        p.g.scale.setScalar(1);
        return;
      }
      const st = stagePose(), lp = landingPose();
      const pos = new THREE.Vector3(p.base.x, p.base.y - (1 - enter) * 0.6, p.base.z).lerp(st.pos, come);
      let sc = lerp(1, st.scale, come);
      let rotY = turn * (1 - come), rotX = Math.sin(t * 0.9) * 0.025 * (1 - land);
      if (lp) { pos.lerp(lp.pos, land); sc = lerp(sc, lp.scale, land); }
      else { pos.z = lerp(pos.z, st.pos.z - 0.6, land); sc *= 1 - land * 0.06; }
      p.g.position.copy(pos);
      p.g.rotation.set(rotX, rotY, 0);
      p.g.scale.setScalar(sc);
      const vanish = 1 - seg(t, 4.62, 4.9);
      p.mat.opacity = enter * vanish; p.tabMat.opacity = enter * vanish;
      p.g.visible = p.mat.opacity > 0.003;
    });

    // the light that passes over FM-000 as it develops
    const sw = seg(t, 2.6, 3.9);
    sweep.intensity = Math.sin(sw * Math.PI) * 14;
    sweep.position.set(lerp(-2.6, 2.6, io(sw)), 1.2, heroPlate.g.position.z + 1.3);
    // shadows belong to the catalogue; they leave as FM-000 steps forward
    wallMat.opacity = 0.12 * (1 - io(seg(t, 1.9, 2.8)));

    renderer.render(scene, camera);
  }

  function dispose() {
    removeEventListener("resize", layout);
    canvas.removeEventListener("webglcontextlost", onLost);
    disposables.forEach((d) => { try { d.dispose(); } catch (e) { /* already gone */ } });
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  // compile shaders up front so the first visible frames don't stall
  render(0);
  return { render, dispose, onLost: (cb) => { lostCb = cb; }, duration: 5.0 };
}
