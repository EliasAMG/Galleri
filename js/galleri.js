/*
  Galleriet: viser ett verk om gangen, med auksjonsboks og budskjema.
  Velger selv mellom full 3D-opplevelse og en enkel versjon.
*/
import * as A from "./auksjon.js";

const cfg = window.GALLERI_CONFIG || {};
const $ = (id) => document.getElementById(id);
const gsap = window.gsap;

/* ---------- Velg visning ---------- */

function velgModus() {
  const param = new URLSearchParams(location.search).get("modus");
  if (param === "2d" || param === "lav" || param === "hoy") return param;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "2d";
  if (!gsap) return "2d";
  try {
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return "2d";
  } catch (e) { return "2d"; }
  const svak =
    (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
    (navigator.connection && navigator.connection.saveData);
  if (svak) return "lav";
  if (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 760) return "mobil";
  return "hoy";
}

let modus = velgModus();
const redusert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const animer = !!gsap && !redusert;

/* ---------- Tilstand ---------- */

let verk = [];
let gjeldende = -1;
let scene = null;
let sisteNavigering = 0;
let infoTidslinje = null;

const info = $("verk-info");
const auksjon = $("auksjon");

/* ---------- Oppstart ---------- */

async function start() {
  try {
    const svar = await fetch("drawings.json", { cache: "no-cache" });
    if (!svar.ok) throw new Error(svar.status);
    verk = (await svar.json()).filter((v) => v && v.id && v.bildefil);
  } catch (e) {
    $("lasteindikator").textContent = "Fant ikke tegningene. Sjekk at drawings.json finnes.";
    console.error(e);
    return;
  }
  if (!verk.length) {
    $("lasteindikator").textContent = "Det er ingen tegninger i galleriet ennå.";
    return;
  }

  byggTeller();
  // Vis info-panelet (usynlig) før scenen lages, så arket får riktig plass fra start.
  info.hidden = false;
  if (animer) gsap.set(info.querySelectorAll(".anim"), { autoAlpha: 0 });

  if (modus !== "2d") {
    try {
      const { lagScene } = await import("./scene3d.js");
      scene = lagScene({
        lerret: $("scene-lerret"),
        verk,
        flate: $("scene"),
        kvalitet: modus,
        vedPeker: (type) => {
          document.body.classList.toggle("over-ark", type === "ark");
          document.body.classList.toggle("over-nabo", type === "nabo");
        },
        vedLastet: () => document.body.classList.add("lastet")
      });
      verk.forEach((v, i) => scene.oppdaterSolgt(i, A.status(v) === "solgt"));
    } catch (e) {
      console.warn("3D er ikke tilgjengelig, bruker enkel visning.", e);
      modus = "2d";
      scene = null;
    }
  }
  document.body.classList.add(modus === "2d" ? "modus-2d" : "modus-3d");
  if (modus === "2d") {
    $("scene-lerret").remove();
    document.body.classList.add("lastet");
  }

  const fraAdresse = verk.findIndex((v) => "#" + v.id === location.hash);
  const forste = fraAdresse >= 0 ? fraAdresse : 0;
  if (scene) scene.settStart(forste);
  vis(forste, { intro: true });
  bindNavigering();
  setInterval(oppdaterNedtelling, 1000);

  // Info-panelet endrer høyde på mobil; la 3D-scenen sentrere arket på nytt.
  if (scene && "ResizeObserver" in window) {
    new ResizeObserver(() => scene.oppdaterUtsnitt()).observe($("scene"));
  }
  setTimeout(() => $("hint").classList.add("borte"), 7000);
}

/* ---------- Teller og navigasjon ---------- */

function byggTeller() {
  const linje = $("teller-linje");
  verk.forEach((v, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", `Verk ${i + 1}: ${v.tittel}`);
    if (A.status(v) === "solgt") b.classList.add("solgt");
    b.addEventListener("click", () => naviger(i));
    linje.appendChild(b);
  });
}

function naviger(i) {
  if (i < 0 || i >= verk.length || i === gjeldende) return;
  sisteNavigering = performance.now();
  vis(i);
}

function bindNavigering() {
  $("forrige").addEventListener("click", () => naviger(gjeldende - 1));
  $("neste").addEventListener("click", () => naviger(gjeldende + 1));

  const pause = () => (modus === "2d" ? 450 : 1100);
  const opptatt = () => performance.now() - sisteNavigering < pause();
  const dialogApen = () => document.querySelector("dialog[open]");

  // Rullehjul / styreflate: ett verk per bevegelse
  let sum = 0, nullstill;
  window.addEventListener("wheel", (e) => {
    if (dialogApen()) return;
    if (info.contains(e.target) && info.scrollHeight > info.clientHeight + 2) return;
    e.preventDefault();
    sum += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    clearTimeout(nullstill);
    nullstill = setTimeout(() => (sum = 0), 220);
    if (Math.abs(sum) > 55 && !opptatt()) {
      naviger(gjeldende + (sum > 0 ? 1 : -1));
      sum = 0;
    }
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (dialogApen() || /input|textarea|select/i.test(e.target.tagName)) return;
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); if (!opptatt()) naviger(gjeldende + 1); }
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); if (!opptatt()) naviger(gjeldende - 1); }
    if (e.key === "Home") naviger(0);
    if (e.key === "End") naviger(verk.length - 1);
  });

  // Sveip på mobil
  const flate = $("scene");
  let sx = 0, sy = 0, st = 0;
  flate.addEventListener("touchstart", (e) => { const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); }, { passive: true });
  flate.addEventListener("touchend", (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Date.now() - st > 900) return;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) naviger(gjeldende + (dx < 0 ? 1 : -1));
    else if (Math.abs(dy) > 60) naviger(gjeldende + (dy < 0 ? 1 : -1));
  }, { passive: true });

  // Klikk på arket: se tegningen stort. Klikk på et naboark: gå dit.
  flate.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    if (scene) {
      const i = scene.treff(e);
      if (i === gjeldende) aapneLysboks();
      else if (i >= 0) naviger(i);
    } else if (e.target.id === "ark-2d-bilde") {
      aapneLysboks();
    }
  });

  window.addEventListener("hashchange", () => {
    const i = verk.findIndex((v) => "#" + v.id === location.hash);
    if (i >= 0) naviger(i);
  });
}

/* ---------- Vis et verk ---------- */

function vis(i, { intro = false } = {}) {
  const forrige = gjeldende;
  gjeldende = i;
  const v = verk[i];

  history.replaceState(null, "", "#" + v.id);
  $("forrige").disabled = i === 0;
  $("neste").disabled = i === verk.length - 1;
  $("teller-tekst").textContent = `${String(i + 1).padStart(2, "0")} / ${String(verk.length).padStart(2, "0")}`;
  $("teller-linje").querySelectorAll("button").forEach((b, j) => b.setAttribute("aria-current", j === i ? "true" : "false"));
  forhandslast(i);

  let reiseTid = 0;
  if (scene) reiseTid = scene.gaaTil(i, { intro });
  else vis2d(v, forrige === -1);

  const deler = info.querySelectorAll(".anim");
  if (!animer) {
    fyllInfo(v);
    if (window.Strek) {
      Strek.ramme(auksjon, { animer: false, variant: v.id });
    }
    return;
  }

  if (infoTidslinje) infoTidslinje.kill();
  infoTidslinje = gsap.timeline();
  if (forrige !== -1) {
    infoTidslinje.to(deler, { autoAlpha: 0, y: -6, duration: 0.35, stagger: 0.03, ease: "power1.in" });
  } else {
    gsap.set(deler, { autoAlpha: 0 });
  }
  infoTidslinje.add(() => {
    fyllInfo(v);
    if (auksjon._ramme) Strek.skjul(auksjon._ramme.querySelectorAll("path"));
  });
  const ventetid = scene ? Math.max(0, reiseTid * 0.72 - (forrige !== -1 ? 0.45 : 0)) : 0.15;
  infoTidslinje.fromTo(deler,
    { autoAlpha: 0, y: 14 },
    { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.09, ease: "power3.out" },
    `+=${ventetid}`);
  infoTidslinje.add(() => {
    Strek.ramme(auksjon, { variant: v.id });
  }, "-=0.6");
}

function vis2d(v, forste) {
  const figur = $("ark-2d");
  const img = $("ark-2d-bilde");
  const bytt = () => {
    img.src = v.bildefil;
    img.alt = `${v.tittel}. ${v.beskrivelse || ""}`;
    figur.classList.remove("bytter", "avslor");
    if (!redusert) { void figur.offsetWidth; figur.classList.add("avslor"); }
  };
  if (forste || redusert) { bytt(); return; }
  figur.classList.add("bytter");
  setTimeout(bytt, 380);
}

// Last neste og forrige bilde i bakgrunnen i 2D-modus, så byttet går raskt.
function forhandslast(i) {
  if (modus !== "2d") return;
  [i + 1, i - 1].forEach((j) => {
    if (verk[j]) { const im = new Image(); im.decoding = "async"; im.src = verk[j].bildefil; }
  });
}

/* ---------- Info og auksjonsboks ---------- */

function fyllInfo(v) {
  $("verk-nr").textContent = `Nr. ${String(gjeldende + 1).padStart(2, "0")}`;
  $("verk-tittel").textContent = v.tittel;
  const meta = [v.storrelse, v.materiale || "Tusj på papir", v.aar].filter(Boolean);
  $("verk-meta").innerHTML = "";
  meta.forEach((m) => { const s = document.createElement("span"); s.textContent = m; $("verk-meta").appendChild(s); });
  $("verk-beskrivelse").textContent = v.beskrivelse || "";
  document.title = `${v.tittel} – ${cfg.kunstnerNavn || "Galleri"}`;
  fyllAuksjon(v);
}

function fyllAuksjon(v) {
  const st = A.status(v);
  auksjon.dataset.status = st;
  const bud = Number(v.hoyesteBud) || 0;

  $("a-status").textContent = st === "aktiv" ? "Auksjonen pågår" : st === "solgt" ? "Solgt" : "Auksjonen er avsluttet";
  const budFelt = $("a-bud");
  budFelt.textContent = bud > 0 ? A.kr(bud) : "Ingen bud ennå";
  budFelt.className = bud > 0 ? "stort" : "ingen";
  $("a-min").textContent = A.kr(v.minstepris);

  const harKjop = Number(v.kjopNaaPris) > 0;
  $("a-kjop-boks").hidden = !harKjop;
  if (harKjop) $("a-kjop").textContent = A.kr(v.kjopNaaPris);

  const aktiv = st === "aktiv";
  auksjon.querySelector(".auksjon-status").hidden = !aktiv;
  $("a-min").parentElement.hidden = !aktiv;
  if (!aktiv) $("a-kjop-boks").hidden = true;
  $("a-knapper").hidden = !aktiv;
  $("knapp-kjop").hidden = !A.kanKjopeNaa(v);
  $("a-slutt").hidden = aktiv;
  $("a-dato").hidden = !aktiv;
  $("a-tid-etikett").textContent = aktiv ? "Slutter om" : "Avsluttet";

  if (aktiv) {
    $("a-dato").textContent = A.sluttDatoTekst(v);
  } else if (st === "solgt") {
    $("a-slutt-tittel").textContent = "Solgt";
    $("a-slutt-tekst").textContent = "Denne tegningen har fått en ny eier. Takk til alle som bød.";
    $("a-bud").parentElement.querySelector("dt").textContent = "Solgt for";
  } else {
    $("a-slutt-tittel").textContent = "Auksjonen er avsluttet";
    $("a-slutt-tekst").textContent = bud > 0
      ? "Kunstneren tar kontakt med den som ga det høyeste budet."
      : "Verket fikk ingen bud denne gangen. Ta gjerne kontakt hvis du er interessert.";
  }
  if (st !== "solgt") $("a-bud").parentElement.querySelector("dt").textContent = st === "aktiv" ? "Høyeste bud" : "Vinnende bud";
  oppdaterNedtelling();
}

function oppdaterNedtelling() {
  const v = verk[gjeldende];
  if (!v) return;
  const st = A.status(v);
  if (st !== auksjon.dataset.status) {
    // Auksjonen ble nettopp avsluttet mens siden var åpen
    fyllAuksjon(v);
    if (scene) scene.oppdaterSolgt(gjeldende, st === "solgt");
    return;
  }
  $("a-tid").textContent = st === "aktiv" ? A.nedtelling(A.sluttTid(v) - Date.now()) : A.avsluttetDato(v);
}

/* ---------- Lysboks ---------- */

const lysboks = $("lysboks");
function aapneLysboks() {
  const v = verk[gjeldende];
  const img = $("lysboks-bilde");
  img.src = v.bildefil;
  img.alt = v.tittel;
  lysboks.classList.remove("zoom");
  lysboks.showModal();
}
$("lysboks-bilde").addEventListener("click", () => lysboks.classList.toggle("zoom"));
lysboks.addEventListener("click", (e) => { if (e.target.classList.contains("lysboks-flate")) lysboks.close(); });

/* ---------- Budskjema ---------- */

const dialog = $("bud-dialog");
const skjema = $("bud-skjema");
const feil = $("skjema-feil");
const belopFelt = $("bud-belop");
let skjemaModus = "bud";

document.querySelectorAll("[data-lukk]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

$("knapp-bud").addEventListener("click", () => aapneSkjema("bud"));
$("knapp-kjop").addEventListener("click", () => aapneSkjema("kjop"));

function aapneSkjema(type) {
  const v = verk[gjeldende];
  skjemaModus = type;
  skjema.hidden = false;
  $("kvittering").hidden = true;
  feil.textContent = "";
  belopFelt.removeAttribute("aria-invalid");

  const minst = A.minsteGyldigeBud(v, cfg.minsteOkning);
  $("bud-tittel").textContent = v.tittel;
  if (type === "kjop") {
    $("bud-modus").textContent = "Kjøp nå";
    $("bud-info").innerHTML = "";
    $("bud-info").append("Du kjøper verket til ", strong(A.kr(v.kjopNaaPris)), ", og auksjonen avsluttes. Kjøpet er bindende.");
    $("belop-etikett").textContent = "Pris (kr)";
    belopFelt.value = v.kjopNaaPris;
    belopFelt.readOnly = true;
    $("belop-hjelp").textContent = "";
    $("send-bud").textContent = "Kjøp verket";
  } else {
    $("bud-modus").textContent = "Legg inn bud";
    $("bud-info").innerHTML = "";
    if (A.harBud(v)) $("bud-info").append("Høyeste bud nå er ", strong(A.kr(v.hoyesteBud)), ". Ditt bud må være minst ", strong(A.kr(minst)), ".");
    else $("bud-info").append("Ingen har budt ennå. Minsteprisen er ", strong(A.kr(v.minstepris)), ".");
    $("belop-etikett").textContent = "Ditt bud (kr)";
    belopFelt.value = "";
    belopFelt.readOnly = false;
    belopFelt.placeholder = String(minst);
    $("belop-hjelp").textContent = "Høyeste bud på siden oppdateres for hånd, og kan derfor være litt forsinket.";
    $("send-bud").textContent = "Send bud";
  }
  dialog.showModal();
}

function strong(tekst) { const s = document.createElement("strong"); s.textContent = tekst; return s; }

belopFelt.addEventListener("input", () => {
  if (belopFelt.getAttribute("aria-invalid")) { belopFelt.removeAttribute("aria-invalid"); feil.textContent = ""; }
});

skjema.addEventListener("submit", async (e) => {
  e.preventDefault();
  const v = verk[gjeldende];
  feil.textContent = "";

  // Felt som mangler
  for (const felt of skjema.querySelectorAll("[required]")) {
    felt.removeAttribute("aria-invalid");
    const tom = felt.type === "checkbox" ? !felt.checked : !felt.value.trim();
    if (tom || !felt.checkValidity()) {
      felt.setAttribute("aria-invalid", "true");
      feil.textContent = felt.type === "checkbox"
        ? "Du må bekrefte at budet er bindende."
        : felt.type === "email" && !tom ? "Sjekk at e-postadressen er riktig." : "Fyll ut alle feltene.";
      felt.focus();
      return;
    }
  }

  const belop = A.lesBelop(belopFelt.value);
  const melding = A.validerBud(v, belop, skjemaModus, cfg.minsteOkning);
  if (melding) {
    belopFelt.setAttribute("aria-invalid", "true");
    feil.textContent = melding;
    belopFelt.focus();
    return;
  }

  if (!cfg.formspreeUrl || cfg.formspreeUrl.includes("DIN-SKJEMA-ID")) {
    feil.textContent = "Budskjemaet er ikke koblet til e-post ennå. (Sett formspreeUrl i js/config.js.)";
    return;
  }

  const data = new FormData(skjema);
  data.set("bud", String(belop));
  data.set("verk", v.tittel);
  data.set("verk_id", v.id);
  data.set("type", skjemaModus === "kjop" ? "Kjøp nå" : "Bud");
  data.set("hoyeste_bud_da", String(v.hoyesteBud || 0));
  data.set("_subject", `${skjemaModus === "kjop" ? "Kjøp nå" : "Nytt bud"}: ${v.tittel} – ${A.kr(belop)}`);

  const knapp = $("send-bud");
  knapp.disabled = true;
  const tekst = knapp.textContent;
  knapp.textContent = "Sender …";
  try {
    const svar = await fetch(cfg.formspreeUrl, { method: "POST", body: data, headers: { Accept: "application/json" } });
    if (!svar.ok) throw new Error(svar.status);
    skjema.reset();
    skjema.hidden = true;
    $("kvittering-tekst").textContent = skjemaModus === "kjop"
      ? `Vi har mottatt kjøpet av «${v.tittel}» for ${A.kr(belop)}. Kunstneren tar kontakt med deg på e-post om betaling og levering.`
      : `Budet ditt på ${A.kr(belop)} for «${v.tittel}» er sendt. Du får bekreftelse på e-post når budet er registrert.`;
    $("kvittering").hidden = false;
  } catch (err) {
    feil.textContent = "Noe gikk galt, og budet ble ikke sendt. Prøv igjen, eller send det på e-post til " + (cfg.epost || "kunstneren") + ".";
  } finally {
    knapp.disabled = false;
    knapp.textContent = tekst;
  }
});

start();
