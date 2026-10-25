/* Forsiden: en lang, sammenhengende strek som tegner seg over arket, og antall verk på auksjon. */
(function () {
  "use strict";

  var svg = document.getElementById("forside-tegning");
  var r = Strek.frø(42);

  // Én sammenhengende linje som vandrer rundt navnet, som en blindkontur-tegning.
  function vandrestrek(seed, punkter, sentrum) {
    var rr = Strek.frø(seed);
    var d = "", x, y;
    for (var i = 0; i <= punkter; i++) {
      var t = i / punkter;
      var a = t * Math.PI * 2 * 1.15 + 0.4;
      var rad = 0.36 + 0.09 * Math.sin(t * 17 + seed) + 0.05 * Math.sin(t * 41);
      var nx = sentrum[0] + Math.cos(a) * rad * 1600 * 0.62 + Math.sin(t * 29 + seed) * 26;
      var ny = sentrum[1] + Math.sin(a) * rad * 1000 * 0.82 + Math.cos(t * 23) * 22;
      // små løkker her og der
      if (rr() < 0.08) { nx += Math.cos(t * 200) * 18; ny += Math.sin(t * 200) * 18; }
      if (i === 0) d += "M" + nx.toFixed(1) + " " + ny.toFixed(1);
      else d += " Q" + x.toFixed(1) + " " + y.toFixed(1) + " " + ((x + nx) / 2).toFixed(1) + " " + ((y + ny) / 2).toFixed(1);
      x = nx; y = ny;
    }
    return d;
  }

  [[7, 220, [800, 500]], [19, 160, [820, 520]]].forEach(function (a, i) {
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", vandrestrek(a[0], a[1], a[2]));
    if (i) p.setAttribute("stroke-opacity", "0.55");
    svg.appendChild(p);
  });

  // Et par korte, tette skraveringer i hjørnene
  for (var k = 0; k < 2; k++) {
    var cx = k ? 1420 : 150, cy = k ? 840 : 170;
    for (var s = 0; s < 9; s++) {
      var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", Strek.skjevLinje(cx + s * 9, cy, cx + s * 9 + 44, cy - 44, r, 2));
      svg.appendChild(p);
    }
  }

  Strek.skjul(svg.querySelectorAll("path"));
  requestAnimationFrame(function () {
    var stier = svg.querySelectorAll("path");
    Strek.tegn([stier[0]], { varighet: 5200 });
    Strek.tegn([stier[1]], { varighet: 4600, forsinkelse: 900 });
    Strek.tegn(Array.prototype.slice.call(stier, 2), { varighet: 300, trinn: 70, forsinkelse: 2600 });
  });

  // Antall verk og hvor mange som er på auksjon nå
  var status = document.getElementById("forside-status");
  fetch("drawings.json", { cache: "no-cache" })
    .then(function (svar) { return svar.json(); })
    .then(function (verk) {
      var naa = Date.now();
      var aktive = verk.filter(function (v) {
        return v.status !== "solgt" && new Date(v.sluttidspunkt).getTime() > naa;
      }).length;
      status.textContent = verk.length + (verk.length === 1 ? " verk" : " verk") + " i galleriet · " +
        (aktive === 0 ? "ingen auksjoner pågår akkurat nå" : aktive + " på auksjon nå");
    })
    .catch(function () { status.textContent = ""; });
})();
