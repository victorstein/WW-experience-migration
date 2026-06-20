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
  const matched_path = h["x-matched-path"] ?? null;
  const isVercel = !!h["x-vercel-id"] || /vercel/i.test(server ?? "");

  // 1) Any redirect hop landing on an experience slug.
  const expHop = chain.find((hop) => hop.location && EXP_SLUGS.test(hop.location));
  if (expHop) {
    return outcome("redirect-exp", finalStatus, matched_path, expHop.location, server, via, served_by);
  }

  // 2) Final 200.
  if (finalStatus >= 200 && finalStatus < 300) {
    if (isVercel && matched_path && EXP_SLUGS.test(matched_path)) {
      return outcome("redirect-exp", finalStatus, matched_path, null, server, via, served_by);
    }
    if (isVercel) return outcome("vercel", finalStatus, matched_path, null, server, via, served_by);
    if (/nginx/i.test(server ?? "")) return outcome("nginx", finalStatus, matched_path, null, server, via, served_by);
    return outcome("other", finalStatus, matched_path, null, server, via, served_by);
  }

  // 3) 404 / everything else.
  if (finalStatus === 404) return outcome("404", finalStatus, matched_path, null, server, via, served_by);
  return outcome("other", finalStatus, matched_path, null, server, via, served_by);
}

function outcome(
  backend: Backend, finalStatus: number, matched_path: string | null,
  redirect_to: string | null, server: string | null, via: string | null, served_by: string | null
): CheckOutcome {
  return { backend, finalStatus, matched_path, redirect_to, server, via, served_by };
}
