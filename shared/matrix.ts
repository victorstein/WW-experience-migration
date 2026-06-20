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
  { market: "CA/FR", base: "/ca/fr/trouvez-un-atelier", coach: "/browse-ww-coaches", tld: "fr.weightwatchers.ca" },
  { market: "AU", base: "/au/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.com.au" },
  { market: "NZ", base: "/nz/find-a-workshop", coach: "/browse-ww-coaches", tld: null },
  { market: "DE", base: "/de/workshop-finden", coach: "/coaches", tld: "weightwatchers.de" },
  { market: "FR", base: "/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "weightwatchers.fr" },
  { market: "BE/FR", base: "/be/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "fr.weightwatchers.be" },
  { market: "BE/NL", base: "/be/nl/vind-een-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.be" },
  { market: "SE", base: "/se/hitta-workshop", coach: "/browse-ww-coaches", tld: "viktvaktarna.se" },
];

export const CONCERNS: Concern[] = ["main", "coachlist", "coachdet", "eventdet", "locdet"];

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

function concernSuffix(concern: Concern, coach: string): string {
  switch (concern) {
    case "main": return "";
    case "coachlist": return coach;
    case "coachdet": return coach + COACH_ID;
    case "eventdet": return VIRTUAL_ID;
    case "locdet": return LOCATION_ID;
  }
}

export function buildUrl(cell: Cell): string {
  const d = def(cell.market);
  return host(cell.env, cell.host_variant, d) + d.base + concernSuffix(cell.concern, d.coach);
}

// Per-market workshop-finder slug (the localized last path segment), e.g.
// US -> "/find-a-workshop", DE -> "/workshop-finden", CA/FR -> "/trouvez-un-atelier".
// Surfaced via /api/status so the dashboard can label each market row.
export function marketSlugs(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of MARKETS) out[d.market] = "/" + d.base.split("/").filter(Boolean).pop()!;
  return out;
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
  const slices: Cell[][] = [];
  for (let i = 0; i < cells.length; i += max) slices.push(cells.slice(i, i + max));
  return slices;
}
