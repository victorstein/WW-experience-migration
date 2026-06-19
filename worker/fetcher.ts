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

    const status = res.status;
    const location = res.headers.get("location");
    const isRedirect = status >= 300 && status < 400 && !!location;

    if (!isRedirect) {
      const finalHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => (finalHeaders[k] = v));
      return { chain, finalStatus: status, finalHeaders };
    }

    chain.push({ status, location });
    url = new URL(location!, url).toString(); // resolve relative Location
  }

  throw new Error(`hop cap exceeded (${maxHops}) starting at ${startUrl}`);
}
