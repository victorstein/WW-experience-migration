import type { Hop } from "../shared/types";

export interface ProbeResult {
  chain: Hop[];
  finalStatus: number;
  finalHeaders: Record<string, string>;
}

const TIMEOUT_MS = 10_000;

export async function probe(startUrl: string, maxHops = 5): Promise<ProbeResult> {
  const chain: Hop[] = [];
  let url = startUrl;
  let finalStatus = 0;
  let finalHeaders: Record<string, string> = {};

  // `hop < maxHops` caps total fetch() calls at maxHops (5), NOT maxHops+1.
  // Each fetch is a subrequest; the free-tier budget is 50/invocation and the
  // matrix uses ≤10 cells/slice, so the per-cell ceiling must be ≤5 (10×5=50).
  // An `<= maxHops` bound would allow 6 fetches/cell → 60 worst-case, over cap.
  for (let hop = 0; hop < maxHops; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "workshops-status-board/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }

    finalStatus = res.status;
    finalHeaders = {};
    res.headers.forEach((v, k) => (finalHeaders[k] = v));

    const location = res.headers.get("location");
    const isRedirect = finalStatus >= 300 && finalStatus < 400 && !!location;
    if (!isRedirect) return { chain, finalStatus, finalHeaders };

    chain.push({ status: finalStatus, location });
    url = new URL(location!, url).toString(); // resolve relative Location
  }

  // Hop cap hit while still redirecting. Don't discard the observation: the chain
  // (and its last 3xx destination) is real — the URL funnels somewhere without
  // resolving within budget (e.g. AU's /workshops → … → /au/plans). Returning lets
  // classify() report it as a `redirect` instead of a misleading `error`, at the
  // same 5-fetch budget — no extra subrequest. A genuine fetch failure still throws
  // above and is recorded as backend=error by the caller.
  return { chain, finalStatus, finalHeaders };
}
