export type MarketLoad = "idle" | "pending" | "loading" | "done";

/**
 * Invert the API's `slicePlan` (slice index -> market(s)) into
 * `market -> slice indices`, so the UI knows which slices cover each country.
 */
export function marketSlices(slicePlan: string[][]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  slicePlan.forEach((markets, i) => {
    for (const m of markets) (out[m] ??= []).push(i);
  });
  return out;
}

/**
 * Loading state of a market during a refresh sweep. `done` = number of slices
 * completed so far (slices [0, done) finished; slice `done` is currently in
 * flight). Slices run sequentially in country order, so this naturally produces
 * a top-to-bottom wave: pending -> loading -> done.
 */
export function marketStatus(
  idxs: number[] | undefined,
  done: number,
  refreshing: boolean
): MarketLoad {
  if (!refreshing || !idxs || idxs.length === 0) return "idle";
  if (Math.max(...idxs) < done) return "done"; // all its slices finished
  if (Math.min(...idxs) > done) return "pending"; // none reached yet
  return "loading"; // a slice is in flight (or partially done)
}
