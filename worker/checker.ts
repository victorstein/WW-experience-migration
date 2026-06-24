import type { Cell, CheckRow } from "../shared/types";
import { allCells, buildUrl, partitionSlices, workshopRouteToken } from "../shared/matrix";
import { classify } from "../shared/classify";
import { probe } from "./fetcher";
import { appendAndUpsert, type AppEnv } from "./db";

export function sliceCount(): number {
  return partitionSlices(allCells()).length;
}

// Which market(s) each slice covers — index = slice number. Computed once at
// module load; surfaced via /api/status to drive the per-country loading UI.
// Each slice currently maps to exactly one market (markets are 12- or 24-cell,
// split into balanced slices of 6 or 8), but we return the distinct markets per
// slice so the client stays correct if a future market breaks that clean alignment.
const SLICE_PLAN: string[][] = partitionSlices(allCells()).map((slice) => [
  ...new Set(slice.map((c) => c.market)),
]);

export function slicePlan(): string[][] {
  return SLICE_PLAN;
}

export async function runSlice(
  env: AppEnv,
  sliceIndex: number,
  now: number
): Promise<{ changed: CheckRow[] }> {
  const slices = partitionSlices(allCells());
  const slice = slices[sliceIndex] ?? [];

  const settled = await Promise.allSettled(slice.map((cell) => checkCell(cell, now)));
  const rows: CheckRow[] = settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : errorRow(slice[i], now, reason(s))
  );

  return appendAndUpsert(env.DB, rows);
}

async function checkCell(cell: Cell, now: number): Promise<CheckRow> {
  const url = buildUrl(cell);
  const { chain, finalStatus, finalHeaders } = await probe(url);
  const o = classify(finalStatus, finalHeaders, chain, workshopRouteToken(cell.concern, cell.market));
  return {
    ...cell, url, ts: now,
    http_status: o.finalStatus, backend: o.backend,
    matched_path: o.matched_path, redirect_to: o.redirect_to,
    server: o.server, via: o.via, served_by: o.served_by, vercel_id: o.vercel_id,
  };
}

function errorRow(cell: Cell, now: number, message: string): CheckRow {
  return {
    ...cell, url: buildUrl(cell), ts: now,
    http_status: null, backend: "error",
    matched_path: message.slice(0, 200), redirect_to: null,
    server: null, via: null, served_by: null, vercel_id: null,
  };
}

function reason(s: PromiseRejectedResult): string {
  return s.reason instanceof Error ? s.reason.message : String(s.reason);
}
