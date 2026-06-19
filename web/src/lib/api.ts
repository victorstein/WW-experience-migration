import type { CurrentCell, HistoryRow } from "./types";

export async function fetchStatus(): Promise<{ cells: CurrentCell[]; sliceCount: number }> {
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

export async function refreshAll(sliceCount: number): Promise<void> {
  for (let i = 0; i < sliceCount; i++) {
    await fetch(`/api/refresh?slice=${i}`, { method: "POST" });
  }
}
