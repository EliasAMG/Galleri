/*
  Felles kode for alle sidene:
  – fyller inn plassholdere fra config.js
  – lager håndtegnede SVG-streker som «tegner seg selv» frem
*/
(function () {
  "use strict";

  var cfg = window.GALLERI_CONFIG || {};
  var redusert = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var NS = "http://www.w3.org/2000/svg";

  /* ---------- Plassholdere ---------- */

  function fyllInn() {
    document.querySelectorAll("[data-cfg]").forEach(function (el) {
      var verdi = cfg[el.getAttribute("data-cfg")];
      if (verdi) el.textContent = verdi;
    });
    document.querySelectorAll("[data-cfg-epost]").forEach(function (el) {
      if (cfg.epost) {
        el.href = "mailto:" + cfg.epost;
        if (!el.children.length) el.textContent = cfg.epost;
      }
    });
    if (cfg.kunstnerNavn) {
      document.title = document.title.replace("[Kunstnerens navn]", cfg.kunstnerNavn);
    }
    var side = document.body.getAttribute("data-side");
    document.querySelectorAll(".meny a").forEach(function (a) {
      if (a.getAttribute("data-side") === side) {
        a.setAttribute("aria-current", "page");
        a.setAttribute("data-understrek", "");
      }
    });
    document.querySelectorAll("[data-aar]").forEach(function (el) {
      el.textContent = new Date().getFullYear();
    });
  }

  /* ---------- Håndtegnede streker ---------- */

  // Liten, forutsigbar tilfeldighetsgenerator, så strekene ser like ut hver gang.
  function frø(n) {
    return function () {
      n |= 0; n = (n + 0x6d2b79f5) | 0;
      var t = Math.imul(n ^ (n >>> 15), 1 | n);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashTekst(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  // En litt ujevn linje fra (x1,y1) til (x2,y2), som om den er trukket med tusj.
  function skjevLinje(x1, y1, x2, y2, r, utslag) {
    var j = function (a) { return (r() - 0.5) * a; };
    var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    var nx = -dy / len, ny = dx / len;
    var bue = j(utslag) + Math.min(len * 0.006, 2.5);
    var m1 = 0.3 + j(0.1), m2 = 0.7 + j(0.1);
    var c1x = x1 + dx * m1 + nx * bue, c1y = y1 + dy * m1 + ny * bue;
    var c2x = x1 + dx * m2 + nx * (bue * 0.6 + j(utslag * 0.6)), c2y = y1 + dy * m2 + ny * (bue * 0.6 + j(utslag * 0.6));
    return "M" + (x1 + j(1.5)).toFixed(1) + " " + (y1 + j(1.5)).toFixed(1) +
      " C" + c1x.toFixed(1) + " " + c1y.toFixed(1) + " " + c2x.toFixed(1) + " " + c2y.toFixed(1) +
      " " + (x2 + j(1.5)).toFixed(1) + " " + (y2 + j(1.5)).toFixed(1);
  }

  // Ramme der hjørnene overlapper litt, slik en hånd tegner en firkant.
  function rammeSti(w, h, r) {
    var o = function () { return 3 + r() * 6; };
    return [
      skjevLinje(-o(), 0, w + o(), r() * 2 - 1, r, 2.2),
      skjevLinje(w, -o(), w + r() * 2 - 1, h + o(), r, 2.2),
      skjevLinje(w + o(), h, -o(), h + r() * 2 - 1, r, 2.2),
      skjevLinje(0, h + o(), r() * 2 - 1, -o(), r, 2.2)
    ];
  }

  function lagSvg(klasse) {
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "strek-svg " + (klasse || ""));
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    return svg;
  }

  function lagSti(d, opasitet) {
    var p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    if (opasitet) p.setAttribute("stroke-opacity", opasitet);
    return p;
  }

  // Animerer strekene så de tegner seg selv frem.
  function tegn(stier, valg) {
    valg = valg || {};
    var varighet = valg.varighet || 1100;
    var forsinkelse = valg.forsinkelse || 0;
    var trinn = valg.trinn == null ? 140 : valg.trinn;
    stier = Array.prototype.slice.call(stier);
    stier.forEach(function (p, i) {
      if (p.getTotalLength == null) return;
      if (p._anim) p._anim.cancel();
      if (redusert || !p.animate) { p.style.strokeDasharray = ""; p.style.strokeDashoffset = ""; return; }
      var len = p.getTotalLength() + 2;
      p.style.strokeDasharray = len + " " + len;
      p.style.strokeDashoffset = len;
      p._anim = p.animate(
        [{ strokeDashoffset: len }, { strokeDashoffset: 0 }],
        { duration: varighet, delay: forsinkelse + i * trinn, easing: "cubic-bezier(.6,.05,.3,1)", fill: "forwards" }
      );
    });
  }

  function skjul(stier) {
    Array.prototype.forEach.call(stier, function (p) {
      if (redusert || !p.getTotalLength) return;
      if (p._anim) p._anim.cancel();
      var len = p.getTotalLength() + 2;
      p.style.strokeDasharray = len + " " + len;
      p.style.strokeDashoffset = len;
    });
  }

  function ramme(el, valg) {
    valg = valg || {};
    var svg = el._ramme;
    var w = el.offsetWidth, h = el.offsetHeight;
    if (!w || !h) return null;
    var seed = hashTekst((el.id || el.className || "r") + (valg.variant || ""));
    var r = frø(seed);
    if (!svg) {
      svg = lagSvg("ramme");
      el.appendChild(svg);
      el._ramme = svg;
    }
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.innerHTML = "";
    rammeSti(w, h, r).forEach(function (d) { svg.appendChild(lagSti(d)); });
    // En svakere andre strek på to av sidene gir et mer tegnet preg
    var r2 = frø(seed + 7);
    var ekstra = rammeSti(w, h, r2);
    svg.appendChild(lagSti(ekstra[0], 0.35));
    svg.appendChild(lagSti(ekstra[1], 0.35));
    if (valg.animer !== false) tegn(svg.querySelectorAll("path"), { varighet: 900, trinn: 160, forsinkelse: valg.forsinkelse });
    return svg;
  }

  function understrek(el, valg) {
    valg = valg || {};
    var w = el.offsetWidth;
    if (!w) return;
    var svg = el._understrek;
    if (!svg) {
      svg = lagSvg();
      el.appendChild(svg);
      el._understrek = svg;
      el.classList.add("understrek");
    }
    var h = 10;
    svg.setAttribute("viewBox", "0 0 " + w + " " + h);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.innerHTML = "";
    var r = frø(hashTekst(el.textContent || "u"));
    svg.appendChild(lagSti(skjevLinje(2, 5 + r() * 2, w - 2, 4 + r() * 2, r, 3)));
    if (valg.dobbel) svg.appendChild(lagSti(skjevLinje(w * 0.12, 8, w * 0.92, 7, r, 2), 0.5));
    if (valg.animer !== false) tegn(svg.querySelectorAll("path"), { varighet: 800, forsinkelse: valg.forsinkelse || 0 });
  }

  // Tegn opp strekene når elementet kommer til syne, og tegn om ved ny størrelse.
  function initStreker(rot) {
    rot = rot || document;
    var synlig = "IntersectionObserver" in window ? new IntersectionObserver(function (oppf) {
      oppf.forEach(function (o) {
        if (!o.isIntersecting) return;
        synlig.unobserve(o.target);
        var el = o.target;
        if (el.hasAttribute("data-ramme")) ramme(el, { forsinkelse: +el.getAttribute("data-forsinkelse") || 0 });
        if (el.hasAttribute("data-understrek")) understrek(el, { dobbel: el.hasAttribute("data-dobbel"), forsinkelse: +el.getAttribute("data-forsinkelse") || 0 });
        if (el.hasAttribute("data-tegn")) tegn(el.querySelectorAll("path, line, polyline, circle"), { varighet: +el.getAttribute("data-varighet") || 1600, trinn: +el.getAttribute("data-trinn") || 120, forsinkelse: +el.getAttribute("data-forsinkelse") || 0 });
      });
    }, { threshold: 0.2 }) : null;

    rot.querySelectorAll("[data-ramme], [data-understrek], [data-tegn]").forEach(function (el) {
      if (el.hasAttribute("data-tegn")) skjul(el.querySelectorAll("path, line, polyline, circle"));
      if (synlig) synlig.observe(el);
      else {
        if (el.hasAttribute("data-ramme")) ramme(el, { animer: false });
        if (el.hasAttribute("data-understrek")) understrek(el, { animer: false });
      }
    });

    if ("ResizeObserver" in window) {
      var forrige = new WeakMap();
      var ro = new ResizeObserver(function (oppf) {
        oppf.forEach(function (o) {
          var el = o.target, b = Math.round(o.contentRect.width) + "x" + Math.round(o.contentRect.height);
          var f = forrige.get(el);
          forrige.set(el, b);
          if (!f || f === b) return;
          if (el._ramme) ramme(el, { animer: false });
          if (el._understrek) understrek(el, { animer: false, dobbel: el.hasAttribute("data-dobbel") });
        });
      });
      rot.querySelectorAll("[data-ramme], [data-understrek]").forEach(function (el) { ro.observe(el); });
    }
  }

  window.Strek = {
    tegn: tegn,
    skjul: skjul,
    ramme: ramme,
    understrek: understrek,
    skjevLinje: skjevLinje,
    frø: frø,
    redusert: redusert,
    init: initStreker
  };

  function start() {
    fyllInn();
    var vent = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    vent.then(function () { initStreker(document); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
