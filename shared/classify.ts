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

  // 2) Final 200.
  if (finalStatus >= 200 && finalStatus < 300) {
    if (isVercel && matched_path && EXP_SLUGS.test(matched_path)) return make("redirect-exp");
    if (isVercel) return make("vercel");
    if (/nginx/i.test(server ?? "")) return make("nginx");
    return make("other");
  }

  // 3) 404 / everything else.
  if (finalStatus === 404) return make("404");
  return make("other");
}
