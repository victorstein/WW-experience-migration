import type { Cell, Concern, Env, HostVariant } from "./types";

interface MarketDef {
  market: string;
  base: string; // locale + workshop slug, e.g. "/uk/find-a-workshop"
  coach: string; // coach-list suffix
  tld: string | null; // canonical domain w/o "www."; null => no separate TLD (US, NZ)
}

export const MARKETS: MarketDef[] = [
  { market: "US", base: "/us/find-a-workshop", coach: "/browse-ww-coaches", tld: null },
  { market: "UK", base: "/uk/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.co.uk" },
  { market: "CA/EN", base: "/ca/en/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.ca" },
  { market: "CA/FR", base: "/ca/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "fr.weightwatchers.ca" },
  { market: "AU", base: "/au/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.com.au" },
  { market: "NZ", base: "/nz/find-a-workshop", coach: "/browse-ww-coaches", tld: null },
  { market: "DE", base: "/de/workshop-finden", coach: "/coaches", tld: "weightwatchers.de" },
  { market: "FR", base: "/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "weightwatchers.fr" },
  { market: "BE/FR", base: "/be/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "fr.weightwatchers.be" },
  { market: "BE/NL", base: "/be/nl/vind-een-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.be" },
  { market: "SE", base: "/se/hitta-workshop", coach: "/browse-ww-coaches", tld: "viktvaktarna.se" },
];

export const CONCERNS: Concern[] = ["gateway", "main", "coachlist", "coachdet", "eventdet", "locdet"];

export const VARIANTS: { env: Env; host_variant: HostVariant }[] = [
  { env: "qa", host_variant: "com" },
  { env: "qa", host_variant: "canonical" },
  { env: "prod", host_variant: "com" },
  { env: "prod", host_variant: "canonical" },
];

export const SLICE_MAX = 10;

const COACH_ID = "/Alyce-G/1018090";
const VIRTUAL_ID = "/virtual/25550661";
const LOCATION_ID = "/2003261/ww-studio--the-st-james-building-chelsea-new-york-new-york";

function def(market: string): MarketDef {
  const d = MARKETS.find((m) => m.market === market);
  if (!d) throw new Error(`unknown market ${market}`);
  return d;
}

function host(env: Env, variant: HostVariant, d: MarketDef): string {
  const domain = variant === "com" ? "weightwatchers.com" : d.tld!;
  return "https://www." + (env === "qa" ? "qat2." : "") + domain;
}

// Locale prefix for a market, derived from its workshop-finder base by dropping
// the finder slug — e.g. "/us/find-a-workshop" -> "/us", "/ca/en/…" -> "/ca/en".
function locale(d: MarketDef): string {
  return d.base.slice(0, d.base.lastIndexOf("/"));
}

function concernSuffix(concern: Concern, coach: string): string {
  switch (concern) {
    case "gateway": return ""; // gateway is not finder-relative; see buildUrl
    case "main": return "";
    case "coachlist": return coach;
    case "coachdet": return coach + COACH_ID;
    case "eventdet": return VIRTUAL_ID;
    case "locdet": return LOCATION_ID;
  }
}

// The token Vercel's canonicalized `x-matched-path` must contain for a 200 to be
// the genuine workshop page for this concern. Vercel normalizes every localized
// finder slug (workshop-finden, hitta-workshop, trouver-un-atelier, …) to
// "find-a-workshop", and the gateway to "workshops"; a 200 matching neither (e.g.
// /au/plans, /be-nl) is a wrong-page render, not a completed migration.
export function workshopRouteToken(concern: Concern): string {
  return concern === "gateway" ? "workshops" : "find-a-workshop";
}

export function buildUrl(cell: Cell): string {
  const d = def(cell.market);
  const h = host(cell.env, cell.host_variant, d);
  // Gateway is the top-level workshops landing page (today /<locale>/experiences,
  // migrating to /<locale>/workshops) — NOT under the finder base.
  if (cell.concern === "gateway") return h + locale(d) + "/workshops";
  return h + d.base + concernSuffix(cell.concern, d.coach);
}

export function allCells(): Cell[] {
  const cells: Cell[] = [];
  for (const d of MARKETS) {
    for (const v of VARIANTS) {
      if (v.host_variant === "canonical" && d.tld === null) continue; // US/NZ have no canonical TLD
      for (const concern of CONCERNS) {
        cells.push({ env: v.env, host_variant: v.host_variant, market: d.market, concern });
      }
    }
  }
  return cells;
}

export function partitionSlices(cells: Cell[], max = SLICE_MAX): Cell[][] {
  // Slice PER MARKET so a slice never straddles two countries — that keeps the
  // per-country loading wave and per-market reload clean. Within a market, split
  // into the fewest balanced slices that stay <= max (e.g. 12 -> 6+6, 24 -> 8+8+8),
  // rather than max-greedy (10+2). allCells() is market-major, so consecutive
  // same-market cells form each group.
  const slices: Cell[][] = [];
  let i = 0;
  while (i < cells.length) {
    let j = i;
    while (j < cells.length && cells[j].market === cells[i].market) j++;
    const group = cells.slice(i, j);
    const k = Math.ceil(group.length / max); // number of balanced slices
    const base = Math.floor(group.length / k);
    let rem = group.length % k;
    let p = 0;
    for (let s = 0; s < k; s++) {
      const size = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
      slices.push(group.slice(p, p + size));
      p += size;
    }
    i = j;
  }
  return slices;
}
