import type { CurrentCell, HistoryRow } from "./types";

export async function fetchStatus(): Promise<{
  cells: CurrentCell[];
  sliceCount: number;
  slicePlan: string[][];
}> {
  const r = await fetch("/api/status");
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.json();
}

export async function fetchHistory(cell: Pick<CurrentCell, "env" | "host_variant" | "market" | "concern">): Promise<HistoryRow[]> {
  const q = new URLSearchParams(cell as Record<string, string>);
  const r = await fetch(`/api/history?${q.toString()}`);
  if (!r.ok) throw new Error(`history ${r.status}`);
  return (await r.json()).history;
}

/**
 * Run all slices one at a time, invoking `onSliceComplete(completed)` after each
 * (`completed` = how many of `sliceCount` have finished). The caller uses that
 * hook to update a progress indicator AND re-fetch status, so the grid fills in
 * slice-by-slice instead of waiting for every slice to finish.
 *
 * Slices run sequentially on purpose: each `/api/refresh?slice=N` is its own
 * Worker invocation bounded to ≤50 subrequests; the client orchestrates them.
 * A single failed slice doesn't abort the rest — progress still advances so the
 * UI doesn't stall, and the append-only history makes a retry next cycle safe.
 */
export async function refreshSlices(
  sliceCount: number,
  onSliceComplete: (completed: number) => void | Promise<void>
): Promise<void> {
  for (let i = 0; i < sliceCount; i++) {
    try {
      await fetch(`/api/refresh?slice=${i}`, { method: "POST" });
    } catch {
      // swallow — one bad slice shouldn't stop the sweep
    }
    await onSliceComplete(i + 1);
  }
}
