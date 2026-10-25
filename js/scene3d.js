/*
  3D-galleriet: tegningene henger som papirark i et rom tegnet med tusj.
  Kameraet går fra verk til verk, og hvert ark «tegner seg frem» første gang
  det kommer i fokus.
*/
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

const AVSTAND = 7;          // avstand mellom verkene i rommet
const GULV = -2.45;
const TAK = 2.75;
const VEGG = -0.9;
const STANDARD_FORHOLD = 1 / Math.SQRT2; // A4 stående

const vertexShader = /* glsl */ `
  uniform float uTid;
  uniform float uFase;
  uniform float uBevegelse;
  varying vec2 vUv;
  varying float vLys;
  void main() {
    vUv = uv;
    vec3 p = position;
    float bue = sin(uv.x * 3.14159);
    float hjorne = pow(max(0.0, uv.x - 0.72) * 3.6, 2.0) * pow(max(0.0, 0.28 - uv.y) * 3.6, 2.0);
    float vind = sin(uTid * 0.7 + uv.y * 2.2 + uFase) * 0.010 * uv.x * uBevegelse;
    p.z += bue * 0.045 + hjorne * 0.07 + vind;
    vLys = 0.955 + 0.045 * bue - hjorne * 0.05 + vind * 1.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uKart;
  uniform float uHarKart;
  uniform float uAvslor;
  uniform float uKartSynlig;
  uniform vec2 uMarg;
  varying vec2 vUv;
  varying float vLys;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float stoy(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec3 papir = vec3(0.994, 0.990, 0.977);
    vec3 farge = papir + (hash(floor(vUv * 1400.0)) - 0.5) * 0.016;

    vec2 tuv = (vUv - uMarg) / (1.0 - 2.0 * uMarg);
    float inne = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
    vec3 t = texture2D(uKart, clamp(tuv, 0.0, 1.0)).rgb;
    // Mørk strek = blekk. Lyse papirtoner i skannet bilde blir rent papir.
    float blekk = clamp((1.0 - dot(t, vec3(0.299, 0.587, 0.114)) - 0.05) / 0.95, 0.0, 1.0);

    // Avsløringen: en ujevn front som beveger seg over arket, som en penn.
    float n = stoy(vUv * vec2(6.0, 8.0)) * 0.20 + stoy(vUv * 38.0) * 0.05;
    float k = vUv.x * 0.28 + (1.0 - vUv.y) * 0.72 + n;
    float front = uAvslor * 1.5 - 0.14;
    float maske = 1.0 - smoothstep(front - 0.12, front, k);
    float aktiv = step(0.001, uAvslor) * (1.0 - step(0.999, uAvslor));
    float penn = (smoothstep(front - 0.035, front, k) - smoothstep(front, front + 0.01, k)) * aktiv;

    float synlig = maske * uHarKart * uKartSynlig * inne;
    farge = mix(farge, vec3(0.07), blekk * synlig);
    farge -= penn * 0.045 * inne * uHarKart;
    farge *= vLys;
    gl_FragColor = vec4(farge, 1.0);
  }
`;

function frø(n) {
  return function () {
    n |= 0; n = (n + 0x6d2b79f5) | 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// En håndtegnet strek i 3D: mange punkter med små avvik.
function skjevStrek(fra, til, r, utslag = 0.012, punkter = 18) {
  const ut = [];
  const fase = r() * 10;
  for (let i = 0; i <= punkter; i++) {
    const t = i / punkter;
    const p = new THREE.Vector3().lerpVectors(fra, til, t);
    const s = Math.sin(t * Math.PI) * (Math.sin(t * 5 + fase) * utslag + (r() - 0.5) * utslag * 0.5);
    p.x += s; p.y += s * 0.8;
    ut.push(p);
  }
  return ut;
}

// Ramme rundt arket som én sammenhengende strek med små løkker i hjørnene.
function rammePunkter(b, h, r) {
  const m = 0.13;
  const x0 = -b / 2 - m, x1 = b / 2 + m, y0 = -h / 2 - m, y1 = h / 2 + m;
  const o = () => 0.04 + r() * 0.07;
  const hjorner = [
    [new THREE.Vector3(x0 - o(), y1, 0), new THREE.Vector3(x1 + o(), y1 + (r() - 0.5) * 0.02, 0)],
    [new THREE.Vector3(x1, y1 + o(), 0), new THREE.Vector3(x1 + (r() - 0.5) * 0.02, y0 - o(), 0)],
    [new THREE.Vector3(x1 + o(), y0, 0), new THREE.Vector3(x0 - o(), y0 + (r() - 0.5) * 0.02, 0)],
    [new THREE.Vector3(x0, y0 - o(), 0), new THREE.Vector3(x0 + (r() - 0.5) * 0.02, y1 + o() * 0.6, 0)]
  ];
  let alle = [];
  hjorner.forEach(([a, c]) => { alle = alle.concat(skjevStrek(a, c, r, 0.01, 26)); });
  return alle;
}

function lagSkyggeTekstur() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  // Skyggetrikset under fungerer i alle nettlesere (også Safari, som mangler ctx.filter).
  ctx.shadowColor = "rgba(0,0,0,1)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetX = 1000;
  ctx.fillRect(40 - 1000, 40, 176, 176);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function storrelseFor(forhold) {
  if (forhold < 0.95) return { b: 3.0 * forhold, h: 3.0 };
  if (forhold > 1.05) return { b: 3.9, h: 3.9 / forhold };
  return { b: 3.25, h: 3.25 };
}

export function lagScene({ lerret, verk, flate, kvalitet = "hoy", vedPeker, vedLastet }) {
  const gsap = window.gsap;
  const lav = kvalitet === "lav";
  const mobil = kvalitet === "mobil";

  const renderer = new THREE.WebGLRenderer({
    canvas: lerret,
    alpha: true,
    antialias: !lav,
    powerPreference: lav ? "low-power" : "high-performance"
  });
  const maksDpr = lav ? 1 : mobil ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maksDpr));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  const halvTan = Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2));

  const maksTekstur = Math.min(renderer.capabilities.maxTextureSize, lav ? 1024 : mobil ? 1600 : 2048);
  const skyggeTekstur = lagSkyggeTekstur();
  const strekMat = new THREE.LineBasicMaterial({ color: 0x121212, transparent: true, opacity: 0.75 });
  const romMat = new THREE.LineBasicMaterial({ color: 0x121212, transparent: true, opacity: 0.16 });
  const segmenter = lav ? 8 : 24;

  /* ---------- Rommet, tegnet med tynne streker ---------- */
  const r = frø(11);
  const sisteX = (verk.length - 1) * AVSTAND;
  const rom = new THREE.Group();
  const romLinjer = [];
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  romLinjer.push(skjevStrek(v(-14, GULV, VEGG), v(sisteX + 14, GULV + 0.01, VEGG), r, 0.02, 120));
  romLinjer.push(skjevStrek(v(-14, GULV - 0.03, VEGG + 0.02), v(sisteX + 14, GULV - 0.02, VEGG), r, 0.03, 120));
  romLinjer.push(skjevStrek(v(-14, TAK, VEGG), v(sisteX + 14, TAK - 0.01, VEGG), r, 0.02, 120));
  for (let i = -1; i <= verk.length; i++) {
    const x = (i + 0.5) * AVSTAND;
    romLinjer.push(skjevStrek(v(x, GULV, VEGG), v(x + (r() - 0.5) * 0.3, GULV - 0.02, 9), r, 0.02, 30));
    romLinjer.push(skjevStrek(v(x, TAK, VEGG), v(x + (r() - 0.5) * 0.3, TAK + 0.02, 9), r, 0.02, 30));
    // Noen korte skraveringer langs gulvlisten
    for (let s = 0; s < 6; s++) {
      const sx = x - 1.6 + s * 0.09 + r() * 0.02;
      romLinjer.push(skjevStrek(v(sx, GULV + 0.02, VEGG), v(sx + 0.22, GULV + 0.28, VEGG), r, 0.004, 4));
    }
  }
  romLinjer.forEach((p) => rom.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), romMat)));
  scene.add(rom);

  /* ---------- Arkene ---------- */
  const ark = verk.map((vv, i) => {
    const gruppe = new THREE.Group();
    gruppe.position.set(i * AVSTAND, 0.05 + (i % 3 === 1 ? 0.08 : 0), i % 2 ? -0.25 : 0.1);
    gruppe.rotation.y = (i % 2 ? 1 : -1) * 0.045;
    gruppe.rotation.z = (i % 3 - 1) * 0.004;

    const uniforms = {
      uKart: { value: null },
      uHarKart: { value: 0 },
      uAvslor: { value: 0 },
      uKartSynlig: { value: 1 },
      uMarg: { value: new THREE.Vector2(0.05, 0.05) },
      uTid: { value: 0 },
      uFase: { value: i * 1.7 },
      uBevegelse: { value: lav ? 0 : 1 }
    };
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1, segmenter, segmenter),
      new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
    );
    mesh.userData.indeks = i;
    gruppe.add(mesh);

    const skygge = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: skyggeTekstur, color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    );
    skygge.position.set(0.1, -0.16, -0.32);
    gruppe.add(skygge);

    const ramme = new THREE.Line(new THREE.BufferGeometry(), strekMat);
    ramme.position.z = -0.02;
    gruppe.add(ramme);

    scene.add(gruppe);
    const a = { gruppe, mesh, skygge, ramme, uniforms, forhold: STANDARD_FORHOLD, b: 0, h: 0, avslort: false, laster: null, prikk: null };
    settStorrelse(a, STANDARD_FORHOLD, i);
    return a;
  });

  function settStorrelse(a, forhold, i) {
    const { b, h } = storrelseFor(forhold);
    a.forhold = forhold; a.b = b; a.h = h;
    a.mesh.scale.set(b, h, 1);
    // Ytre papirkant: lik fysisk marg på alle sider
    const marg = 0.11;
    a.uniforms.uMarg.value.set(marg / b, marg / h);
    // Skyggen er tegnet med luft rundt seg i teksturen (40 av 256 px)
    a.skygge.scale.set(b / (176 / 256) * 1.02, h / (176 / 256) * 1.02, 1);
    const punkter = rammePunkter(b, h, frø(100 + i));
    a.ramme.geometry.dispose();
    a.ramme.geometry = new THREE.BufferGeometry().setFromPoints(punkter);
    a.ramme.userData.antall = punkter.length;
    a.ramme.geometry.setDrawRange(0, a.avslort ? punkter.length : 0);
    if (a.prikk) a.prikk.position.set(b / 2 + 0.34, -h / 2 + 0.05, 0);
  }

  // Den røde «solgt»-prikken på veggen, som i et ekte galleri
  const prikkMat = new THREE.MeshBasicMaterial({ color: 0xc0392b });
  function oppdaterSolgt(i, solgt) {
    const a = ark[i];
    if (solgt && !a.prikk) {
      a.prikk = new THREE.Mesh(new THREE.CircleGeometry(0.065, 28), prikkMat);
      a.prikk.position.set(a.b / 2 + 0.34, -a.h / 2 + 0.05, 0);
      a.gruppe.add(a.prikk);
    }
    if (a.prikk) a.prikk.visible = !!solgt;
  }

  /* ---------- Bilder: lastes bare når de trengs ---------- */
  async function lastBilde(i) {
    const a = ark[i];
    if (!a || a.uniforms.uKart.value || a.laster) return a && a.laster;
    a.laster = (async () => {
      const img = new Image();
      img.decoding = "async";
      img.src = verk[i].bildefil;
      try { await img.decode(); } catch (e) { console.warn("Fant ikke bildet:", verk[i].bildefil); a.laster = null; return; }
      let kilde = img;
      const st = Math.max(img.naturalWidth, img.naturalHeight);
      if (st > maksTekstur) {
        const s = maksTekstur / st;
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * s);
        c.height = Math.round(img.naturalHeight * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        kilde = c;
      }
      const t = new THREE.Texture(kilde);
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      t.needsUpdate = true;
      a.uniforms.uKart.value = t;
      a.uniforms.uHarKart.value = 1;
      settStorrelse(a, img.naturalWidth / img.naturalHeight, i);
      if (a.avslort) {
        a.uniforms.uKartSynlig.value = 0;
        gsap.to(a.uniforms.uKartSynlig, { value: 1, duration: 0.8 });
      }
      if (i === gjeldende) { tilpassKamera(true); if (!a.avslort && fremme) avslor(i); }
      a.laster = null;
      if (vedLastet) vedLastet(i);
    })();
    return a.laster;
  }

  async function lastRundt(i) {
    for (const j of [i, i + 1, i - 1, i + 2, i - 2]) {
      if (j >= 0 && j < ark.length) await lastBilde(j);
    }
    // Frigjør minne for ark som er langt unna
    ark.forEach((a, j) => {
      if (Math.abs(j - gjeldende) > 3 && a.uniforms.uKart.value) {
        a.uniforms.uKart.value.dispose();
        a.uniforms.uKart.value = null;
        a.uniforms.uHarKart.value = 0;
      }
    });
  }

  /* ---------- Kamera ---------- */
  const kam = { x: -4, y: 0.7, z: 16 };
  const mal = { x: 0, y: 0, z: 0 };
  let gjeldende = 0;
  let fremme = false;
  let flateRekt = flate.getBoundingClientRect();
  let tidslinje = null;

  function avstandFor(a) {
    const H = window.innerHeight, W = window.innerWidth;
    const fyll = mobil || lav ? 0.94 : 0.9;
    const hoyde = a.h + 0.3, bredde = a.b + 0.5;
    const dH = (hoyde * H) / (2 * halvTan * flateRekt.height * fyll);
    const dB = (bredde * W) / (2 * halvTan * kamera.aspect * flateRekt.width * fyll);
    return Math.max(dH, dB) + a.gruppe.position.z;
  }

  function oppdaterUtsnitt() {
    const W = window.innerWidth, H = window.innerHeight;
    flateRekt = flate.getBoundingClientRect();
    renderer.setSize(W, H, false);
    kamera.aspect = W / H;
    const senterY = flateRekt.top + flateRekt.height / 2;
    const senterX = flateRekt.left + flateRekt.width / 2;
    kamera.setViewOffset(W, H, W / 2 - senterX, H / 2 - senterY, W, H);
    kamera.updateProjectionMatrix();
  }

  function tilpassKamera(myk) {
    const a = ark[gjeldende];
    const z = avstandFor(a);
    if (tidslinje && tidslinje.isActive()) return;
    if (myk) gsap.to(kam, { z, duration: 0.8, ease: "power2.out" });
    else kam.z = z;
  }

  function avslor(i) {
    const a = ark[i];
    if (a.avslort || !a.uniforms.uHarKart.value) return;
    a.avslort = true;
    gsap.fromTo(a.uniforms.uAvslor, { value: 0 }, { value: 1, duration: lav ? 1.8 : 2.8, ease: "power1.inOut" });
    const teller = { n: 0 };
    gsap.to(teller, {
      n: a.ramme.userData.antall, duration: 1.9, delay: 0.25, ease: "power2.inOut",
      onUpdate: () => a.ramme.geometry.setDrawRange(0, Math.round(teller.n))
    });
  }

  /** Gå til verk nr. i. Returnerer hvor mange sekunder turen tar. */
  function gaaTil(i, { intro = false } = {}) {
    const fra = gjeldende;
    gjeldende = i;
    fremme = false;
    lastRundt(i);
    const a = ark[i];
    const tx = a.gruppe.position.x;
    const z = avstandFor(a);
    const sprang = Math.abs(i - fra);
    const D = intro ? 2.6 : Math.min(1.5 + 0.22 * (sprang - 1), 2.6);
    if (tidslinje) tidslinje.kill();
    tidslinje = gsap.timeline({
      onComplete: () => { fremme = true; avslor(i); tilpassKamera(true); }
    });
    if (intro) {
      tidslinje.to(kam, { x: tx, y: 0, z, duration: D, ease: "power3.inOut" }, 0);
    } else {
      tidslinje.to(kam, { x: tx, y: 0, duration: D, ease: "power2.inOut" }, 0);
      // Et lite skritt bakover og inn igjen, som når man går mellom bildene
      tidslinje.to(kam, { z: Math.max(z, kam.z) + 1.1 + 0.25 * sprang, duration: D * 0.5, ease: "sine.out" }, 0);
      tidslinje.to(kam, { z, duration: D * 0.5, ease: "sine.inOut" }, D * 0.5);
    }
    tidslinje.to(mal, { x: tx, y: a.gruppe.position.y * 0.5, z: a.gruppe.position.z, duration: D, ease: "power2.inOut" }, intro ? 0 : 0.06);
    // Start strekavsløringen litt før kameraet er helt fremme
    tidslinje.call(() => { fremme = true; avslor(i); }, null, D * 0.78);
    return D;
  }

  /* ---------- Mus, peker og klikk ---------- */
  const peker = { x: 0, y: 0 }, glatt = { x: 0, y: 0 };
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function treff(e) {
    ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, kamera);
    const t = raycaster.intersectObjects(ark.map((a) => a.mesh), false)[0];
    return t ? t.object.userData.indeks : -1;
  }

  function vedBevegelse(e) {
    if (e.pointerType === "mouse") {
      peker.x = (e.clientX / window.innerWidth) * 2 - 1;
      peker.y = (e.clientY / window.innerHeight) * 2 - 1;
      const i = treff(e);
      if (vedPeker) vedPeker(i === -1 ? null : i === gjeldende ? "ark" : "nabo");
    }
  }
  window.addEventListener("pointermove", vedBevegelse, { passive: true });

  /* ---------- Tegnesløyfen ---------- */
  const klokke = new THREE.Clock();
  let rammer = 0, samletTid = 0, senket = false;

  renderer.setAnimationLoop(() => {
    const dt = Math.min(klokke.getDelta(), 0.1);
    const tid = klokke.elapsedTime;

    // Senk oppløsningen automatisk hvis enheten sliter
    if (!senket && rammer < 120) {
      rammer++; samletTid += dt;
      if (rammer === 120 && samletTid / rammer > 1 / 32 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(1); oppdaterUtsnitt(); senket = true;
      }
    }

    const f = 1 - Math.pow(0.04, dt);
    glatt.x += (peker.x - glatt.x) * f;
    glatt.y += (peker.y - glatt.y) * f;

    kamera.position.set(kam.x + glatt.x * 0.38, kam.y - glatt.y * 0.22, kam.z);
    kamera.lookAt(mal.x + glatt.x * 0.06, mal.y - glatt.y * 0.04, mal.z);

    if (!lav) {
      ark.forEach((a, i) => {
        a.uniforms.uTid.value = tid;
        a.gruppe.position.y = 0.05 + (i % 3 === 1 ? 0.08 : 0) + Math.sin(tid * 0.55 + i * 1.3) * 0.025;
        a.gruppe.rotation.x = Math.sin(tid * 0.4 + i) * 0.006;
      });
    }
    renderer.render(scene, kamera);
  });

  window.addEventListener("resize", () => { oppdaterUtsnitt(); tilpassKamera(false); });
  oppdaterUtsnitt();
  kam.x = -5; kam.z = avstandFor(ark[0]) + 7;

  return {
    gaaTil,
    treff,
    oppdaterSolgt,
    oppdaterUtsnitt: () => { oppdaterUtsnitt(); tilpassKamera(false); },
    settStart: (i) => {
      const a = ark[i];
      kam.x = a.gruppe.position.x - 5; kam.y = 0.7; kam.z = avstandFor(a) + 7;
      mal.x = a.gruppe.position.x - 2;
    }
  };
}
