# Galleri for tusjtegninger

En statisk nettside der hver tusjtegning vises alene, som et verk på en vegg, med en enkel auksjon under. Siden trenger ingen server eller database og kan publiseres gratis på GitHub Pages.

## Innhold

| Fil / mappe | Hva den er |
| --- | --- |
| `index.html` | Forsiden |
| `galleri.html` | Galleriet med alle verkene og auksjonene |
| `om.html` | Om kunstneren |
| `vilkar.html` | Vilkår for budgivning, betaling og frakt |
| `drawings.json` | **Alle tegningene og auksjonsdataene** |
| `js/config.js` | **Navn, e-post og adressen budene sendes til** |
| `bilder/tegninger/` | Bildene av tegningene |
| `bilder/kunstner/` | Bilde av kunstneren |

## 1. Bytt ut plassholderne

Alt i `[hakeparenteser]` er plassholdere.

1. Åpne `js/config.js` og fyll inn kunstnerens navn, e-post og by.
2. Bytt ut `bilder/kunstner/portrett.webp` med et bilde av kunstneren mens han tegner (stående format, gjerne 1200 × 1500 piksler).
3. Skriv teksten om kunstneren i `om.html`, og gå gjennom tallene og fristene i `vilkar.html`.
4. Slett eksempeltegningene i `bilder/tegninger/` og eksemplene i `drawings.json` når du legger inn de ekte.

## 2. Koble budskjemaet til e-post (Formspree)

Budene sendes til kunstnerens e-post via [Formspree](https://formspree.io), som er gratis for opptil 50 innsendinger i måneden.

1. Lag en konto på formspree.io med kunstnerens e-post.
2. Lag et nytt skjema («New form»). Du får en adresse som `https://formspree.io/f/abcdwxyz`.
3. Lim adressen inn som `formspreeUrl` i `js/config.js`.
4. Send et testbud fra nettsiden. Første gang må du bekrefte skjemaet i e-posten fra Formspree.

Hvert bud kommer som en e-post med navn, e-post, telefon, beløp, hvilket verk det gjelder, og hva høyeste bud var da budet ble lagt inn.

## 3. Legge til en ny tegning

1. **Klargjør bildet.** Skann eller fotografer tegningen på hvit bakgrunn, beskjær til papirkanten, og lagre som `.webp` eller `.jpg`, cirka 2000 piksler på den lengste siden. Bruk gjerne [squoosh.app](https://squoosh.app) (gratis, i nettleseren) og velg WebP med kvalitet rundt 80. Da blir hvert bilde ca. 150–400 kB.
   Har du ImageMagick, kan du komprimere en hel mappe med: `sh verktoy/komprimer.sh mappe-med-bilder`
2. **Legg bildet i** `bilder/tegninger/`, f.eks. `bilder/tegninger/fjellbjork.webp`. Bruk små bokstaver og bindestrek, ikke æ, ø, å eller mellomrom i filnavnet.
3. **Legg til en oppføring** i `drawings.json`. Kopier en eksisterende blokk og endre feltene. Husk komma mellom blokkene.

```json
{
  "id": "fjellbjork",
  "tittel": "Fjellbjørk",
  "bildefil": "bilder/tegninger/fjellbjork.webp",
  "beskrivelse": "En kort tekst om motivet.",
  "storrelse": "A4 (21 × 29,7 cm)",
  "materiale": "Tusj på papir",
  "aar": 2026,
  "minstepris": 2000,
  "kjopNaaPris": 5000,
  "hoyesteBud": 0,
  "sluttidspunkt": "2026-12-31T20:00:00+01:00",
  "status": "aktiv"
}
```

| Felt | Forklaring |
| --- | --- |
| `id` | Unikt navn uten mellomrom. Brukes i lenken til verket, f.eks. `galleri.html#fjellbjork`. |
| `tittel` | Tittelen som vises stort. |
| `bildefil` | Stien til bildet. |
| `beskrivelse` | En kort tekst om motivet (en til tre setninger). |
| `storrelse` | F.eks. `A4 (21 × 29,7 cm)`. |
| `materiale` | F.eks. `Tusj på papir`. |
| `aar` | Året tegningen ble laget. Kan sløyfes. |
| `minstepris` | Laveste bud som godtas, i hele kroner. |
| `kjopNaaPris` | Pris for å kjøpe direkte. Skriv `null` hvis verket ikke skal ha kjøp nå. |
| `hoyesteBud` | Høyeste bud så langt. `0` betyr ingen bud. |
| `sluttidspunkt` | Når auksjonen slutter. Bruk `+01:00` om vinteren og `+02:00` om sommeren (norsk tid). |
| `status` | `aktiv` eller `solgt`. |

Rekkefølgen i filen er rekkefølgen i galleriet. Sjekk gjerne at filen er gyldig på [jsonlint.com](https://jsonlint.com) hvis siden ikke viser tegningene.

## 4. Oppdatere bud

Når et bud kommer på e-post:

1. Sjekk at budet er gyldig (høyere enn høyeste bud, og minst minsteprisen).
2. Endre `hoyesteBud` for verket i `drawings.json`, f.eks. `"hoyesteBud": 3600`.
3. Lagre og publiser (se under). Siden viser det nye budet etter et minutt eller to.

Skjemaet på siden avviser bud som er lavere enn det som står i `hoyesteBud` og `minstepris`. Hvor mye et nytt bud minst må øke med, settes med `minsteOkning` i `js/config.js`.

**Når et verk er solgt** (etter kjøp nå, eller når vinneren har betalt): sett `"status": "solgt"`. Verket får da en rød prikk, slik solgte verk får i et galleri. Når nedtellingen er over, viser siden «Auksjonen er avsluttet» av seg selv, også uten at du endrer noe.

## 5. Publisere på GitHub Pages

1. Lag en gratis konto på [github.com](https://github.com) og et nytt, offentlig repository, f.eks. `galleri`.
2. Last opp alle filene og mappene («Add file» → «Upload files»), eller bruk GitHub Desktop.
3. Gå til **Settings → Pages**, velg «Deploy from a branch», branch `main` og mappe `/ (root)`, og trykk Save.
4. Etter et par minutter ligger siden på `https://brukernavn.github.io/galleri/`.

Senere endringer, som nye bud, gjør du direkte på github.com: åpne `drawings.json`, trykk på blyanten, endre og trykk «Commit changes». Siden oppdateres automatisk.

Vil du bruke eget domene, f.eks. `navnet.no`, kan det legges inn under Settings → Pages → Custom domain.

## Se siden på egen maskin

Siden henter `drawings.json` med JavaScript, så den må åpnes via en liten lokal server, ikke ved å dobbeltklikke på `index.html`. I mappen:

```sh
python3 -m http.server 8000
```

Åpne så http://localhost:8000.

## Om 3D-visningen

- Galleriet bruker Three.js og GSAP (lastes fra CDN). Tegningene henger som papirark i et rom tegnet med tusjstreker, og hvert ark tegner seg frem første gang det vises.
- Har besøkende slått på «reduser bevegelse» i systemet, eller støtter ikke nettleseren WebGL, vises en enkel versjon uten 3D og tunge animasjoner.
- På svake mobiler brukes en lettere 3D-versjon med lavere oppløsning, og oppløsningen senkes automatisk hvis det går tregt.
- Bare bildene rundt verket som vises lastes inn, så siden er rask selv med mange tegninger.
- For testing kan du tvinge en visning med `galleri.html?modus=2d`, `?modus=lav` eller `?modus=hoy`.
