import type { Cell, CheckRow } from "../shared/types";
import { allCells, buildUrl, partitionSlices } from "../shared/matrix";
import { classify } from "../shared/classify";
import { probe } from "./fetcher";
import { appendAndUpsert, type AppEnv } from "./db";

export function sliceCount(): number {
  return partitionSlices(allCells()).length;
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
  const o = classify(finalStatus, finalHeaders, chain);
  return {
    ...cell, url, ts: now,
    http_status: o.finalStatus, backend: o.backend,
    matched_path: o.matched_path, redirect_to: o.redirect_to,
  };
}

function errorRow(cell: Cell, now: number, message: string): CheckRow {
  return {
    ...cell, url: buildUrl(cell), ts: now,
    http_status: null, backend: "error",
    matched_path: message.slice(0, 200), redirect_to: null,
  };
}

function reason(s: PromiseRejectedResult): string {
  return s.reason instanceof Error ? s.reason.message : String(s.reason);
}
