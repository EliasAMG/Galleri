/*
  Auksjonslogikk: status, beløp, nedtelling og validering av bud.
  All data kommer fra drawings.json. Det er ingen database – høyeste bud
  oppdateres for hånd i filen.
*/

const tallFormat = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const datoFormat = new Intl.DateTimeFormat("nb-NO", {
  weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
});
const kortDato = new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "long", year: "numeric" });

export function kr(belop) {
  return tallFormat.format(belop) + " kr";
}

export function sluttTid(verk) {
  const t = new Date(verk.sluttidspunkt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/** "solgt", "avsluttet" eller "aktiv" */
export function status(verk, naa = Date.now()) {
  if (String(verk.status).toLowerCase() === "solgt") return "solgt";
  if (naa >= sluttTid(verk)) return "avsluttet";
  return "aktiv";
}

export function harBud(verk) {
  return Number(verk.hoyesteBud) > 0;
}

/** Kjøp nå er bare mulig så lenge høyeste bud er lavere enn kjøp nå-prisen. */
export function kanKjopeNaa(verk) {
  const pris = Number(verk.kjopNaaPris);
  return pris > 0 && Number(verk.hoyesteBud || 0) < pris;
}

/** Laveste bud som godtas akkurat nå. */
export function minsteGyldigeBud(verk, minsteOkning = 1) {
  const min = Number(verk.minstepris) || 0;
  const hoyeste = Number(verk.hoyesteBud) || 0;
  if (hoyeste <= 0) return Math.max(min, 1);
  return Math.max(min, hoyeste + Math.max(1, minsteOkning));
}

/** Tolker «3 500», «3500 kr» og «3.500» som 3500. */
export function lesBelop(tekst) {
  const siffer = String(tekst || "").replace(/[^\d]/g, "");
  return siffer ? parseInt(siffer, 10) : NaN;
}

/**
 * Sjekker et bud. Returnerer en feilmelding på norsk, eller null hvis budet er gyldig.
 * modus: "bud" eller "kjop"
 */
export function validerBud(verk, belop, modus, minsteOkning = 1) {
  const st = status(verk);
  if (st === "solgt") return "Dette verket er allerede solgt.";
  if (st === "avsluttet") return "Auksjonen for dette verket er avsluttet.";
  if (!Number.isFinite(belop) || belop <= 0) return "Skriv inn budet ditt i hele kroner.";

  if (modus === "kjop") {
    if (!kanKjopeNaa(verk)) return "Kjøp nå er ikke lenger mulig for dette verket.";
    if (belop !== Number(verk.kjopNaaPris)) return `Kjøp nå-prisen er ${kr(verk.kjopNaaPris)}.`;
    return null;
  }

  const min = Number(verk.minstepris) || 0;
  const hoyeste = Number(verk.hoyesteBud) || 0;
  if (belop < min) return `Budet er lavere enn minsteprisen på ${kr(min)}.`;
  if (hoyeste > 0 && belop <= hoyeste) return `Budet må være høyere enn høyeste bud, som er ${kr(hoyeste)}.`;
  const krav = minsteGyldigeBud(verk, minsteOkning);
  if (belop < krav) return `Budet må være minst ${kr(krav)} (høyeste bud pluss ${kr(krav - hoyeste)}).`;
  return null;
}

const to = (n) => String(n).padStart(2, "0");

/** «3 d · 04 t · 12 m · 09 s» */
export function nedtelling(ms) {
  if (ms <= 0) return "0 s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const t = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sek = s % 60;
  const deler = [];
  if (d > 0) deler.push(`${d} d`);
  if (d > 0 || t > 0) deler.push(`${to(t)} t`);
  deler.push(`${to(m)} m`, `${to(sek)} s`);
  return deler.join(" · ");
}

export function sluttDatoTekst(verk) {
  return "Slutter " + datoFormat.format(new Date(sluttTid(verk)));
}

export function avsluttetDato(verk) {
  return kortDato.format(new Date(sluttTid(verk)));
}
