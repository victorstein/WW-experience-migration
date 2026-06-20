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
  chain: Hop[]
): CheckOutcome {
  const h = lower(finalHeaders);
  const server = h["server"] ?? null;
  const via = h["via"] ?? null;
  const served_by = h["x-served-by"] ?? null;
  const vercel_id = h["x-vercel-id"] ?? null;
  const matched_path = h["x-matched-path"] ?? null;
  const isVercel = !!vercel_id || /vercel/i.test(server ?? "");

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
    if (isVercel) return make("vercel");
    if (looksLegacy) return make("nginx");
    return make("other");
  }

  // 3) 404 / everything else.
  if (finalStatus === 404) return make("404");
  return make("other");
}
