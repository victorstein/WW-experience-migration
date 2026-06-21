import type { Backend, CheckOutcome, Hop } from "./types";

const EXP_SLUGS = /(find-an-experience|trouver-une-experience|vind-een-ervaring)/i;

function lower(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k in headers) out[k.toLowerCase()] = headers[k];
  return out;
}

export function classify(
  finalStatus: number,
  finalHeaders: Record<string, string>,
  chain: Hop[],
  // When given (the matrix passes the concern's expected route token), a Vercel 200
  // whose x-matched-path doesn't contain it is the wrong page, not a real render.
  // Omitted by /api/probe, which has no concern context.
  expectedToken?: string
): CheckOutcome {
  const h = lower(finalHeaders);
  const server = h["server"] ?? null;
  const via = h["via"] ?? null;
  const served_by = h["x-served-by"] ?? null;
  const vercel_id = h["x-vercel-id"] ?? null;
  const matched_path = h["x-matched-path"] ?? null;
  // x-vercel-id only rides a cache MISS — Fastly strips it when it serves a Vercel
  // response from its own cache (HIT). x-vercel-cache and x-matched-path are set by
  // Vercel's router and survive caching, so they're the reliable "this is Vercel"
  // signals; x-vercel-id is kept as one more positive marker. Drupal sets none of
  // these. Without any of them we don't claim Vercel.
  const isVercel =
    !!vercel_id ||
    /vercel/i.test(server ?? "") ||
    h["x-vercel-cache"] != null ||
    matched_path != null;

  // All non-classification fields are header-derived and identical across every
  // return path — build them once and spread into each outcome.
  const meta = { finalStatus, matched_path, server, via, served_by, vercel_id };
  const make = (backend: Backend, redirect_to: string | null = null): CheckOutcome => ({
    backend, redirect_to, ...meta,
  });

  // 1) Any redirect hop landing on an experience slug.
  const expHop = chain.find((hop) => hop.location && EXP_SLUGS.test(hop.location));
  if (expHop) return make("redirect-exp", expHop.location);

  // A successful, non-Vercel response is the un-migrated origin. Inside the
  // corporate network it advertises `Server: nginx`; from the public Cloudflare
  // edge `Server` is rewritten to "cloudflare", so the literal header is only
  // visible from one vantage point. The Fastly fingerprint (`Via: …varnish`,
  // `X-Served-By: cache-…`) survives both, so treat any of those — or a literal
  // nginx server — as the legacy nginx stack. Vercel is matched first, so these
  // markers only ever apply to non-Vercel responses. Without positive evidence we
  // stay `other` rather than guess.
  const looksLegacy =
    /nginx/i.test(server ?? "") ||
    /varnish/i.test(via ?? "") ||
    /cache-/i.test(served_by ?? "");

  // 2) Final 200.
  if (finalStatus >= 200 && finalStatus < 300) {
    if (isVercel && matched_path && EXP_SLUGS.test(matched_path)) return make("redirect-exp");
    if (isVercel) {
      // Migration-complete means the workshop page actually rendered, not just that
      // Vercel answered 200. Vercel's matched route is canonicalized, so a 200 whose
      // x-matched-path lacks the concern's expected token is a wrong page (e.g. a
      // funnel to /au/plans or a homepage fallback). Missing matched_path => no
      // evidence to downgrade, stay vercel.
      if (expectedToken && matched_path && !matched_path.includes(expectedToken)) {
        return make("vercel-wrong");
      }
      return make("vercel");
    }
    if (looksLegacy) return make("nginx");
    return make("other");
  }

  // 3) Still redirecting when the hop budget ran out (finalStatus is 3xx). The URL
  // funnels somewhere that isn't a workshop and isn't the experience finder (caught
  // above) — e.g. AU's /workshops → … → /au/plans. Report it as a redirect to the
  // last known destination instead of letting the probe error out.
  if (finalStatus >= 300 && finalStatus < 400) {
    return make("redirect", chain[chain.length - 1]?.location ?? null);
  }

  // 4) 404. A 404 carrying Vercel evidence (x-vercel-id, corroborated by
  // x-matched-path: /404) is Vercel's "oops" page — the route is on the migrated
  // app but unfound/ungated. A 404 without it is the legacy Drupal origin, i.e.
  // the path hasn't been forwarded to Vercel yet. `via: varnish` is on both
  // (Fastly fronts everything), so x-vercel-id is the only reliable splitter.
  if (finalStatus === 404) return make(isVercel ? "vercel-404" : "404");
  return make("other");
}
