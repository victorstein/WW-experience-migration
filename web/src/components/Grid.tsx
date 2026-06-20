import { Loader2 } from "lucide-react";
import { Cell } from "./Cell";
import { cn } from "@/lib/utils";
import type { CurrentCell } from "@/lib/types";
import type { MarketLoad } from "@/lib/progress";

const MARKETS = ["US", "UK", "CA/EN", "CA/FR", "AU", "NZ", "DE", "FR", "BE/FR", "BE/NL", "SE"];
const CONCERNS = [
  { key: "gateway", label: "Gateway" },
  { key: "main", label: "Main" },
  { key: "coachlist", label: "Coach list" },
  { key: "coachdet", label: "Coach detail" },
  { key: "eventdet", label: "Event detail" },
  { key: "locdet", label: "Location" },
] as const;

// Shared column template: a fixed market column + 6 equal concern columns.
const COLS = "grid grid-cols-[232px_repeat(6,minmax(0,1fr))]";

export function Grid({
  cells,
  marketLoad,
  onSelect,
}: {
  cells: CurrentCell[];
  marketLoad?: Record<string, MarketLoad>;
  onSelect: (c: CurrentCell) => void;
}) {
  const byKey = new Map(cells.map((c) => [`${c.market}|${c.concern}`, c]));

  // Domain under test for each market in the current variant (the host of any of
  // its cells, e.g. "weightwatchers.com" vs the canonical "weightwatchers.co.uk").
  const hostByMarket = new Map<string, string>();
  for (const c of cells) {
    if (hostByMarket.has(c.market)) continue;
    try {
      hostByMarket.set(c.market, new URL(c.url).host.replace(/^www\./, ""));
    } catch {
      /* ignore malformed url */
    }
  }
  return (
    <div>
      {/* Header row — bold real-word labels with an underline rule (WW style). */}
      <div className={cn(COLS, "border-b px-4 pb-3 text-sm font-bold")}>
        <div>Market</div>
        {CONCERNS.map((c) => (
          <div key={c.key} className="text-center">
            {c.label}
          </div>
        ))}
      </div>

      {/* One rounded card per market; short inset dividers live on each cell. */}
      <div className="mt-3 space-y-2.5">
        {MARKETS.map((m) => {
          const load = marketLoad?.[m] ?? "idle";
          const host = hostByMarket.get(m);
          return (
            <div
              key={m}
              className={cn(
                COLS,
                "items-stretch overflow-hidden rounded-2xl bg-card shadow-sm transition",
                load === "pending" && "opacity-40",
                load === "loading" && "ring-2 ring-primary/40"
              )}
            >
              <div className="flex flex-col justify-center px-4 py-5">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {m}
                  {load === "loading" && <Loader2 className="size-3.5 animate-spin text-primary" />}
                </div>
                {host && (
                  <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={host}>
                    {host}
                  </div>
                )}
              </div>
              {CONCERNS.map((c) => {
                const cell = byKey.get(`${m}|${c.key}`);
                return (
                  <Cell
                    key={c.key}
                    cell={cell}
                    loading={load === "loading"}
                    onClick={() => cell && onSelect(cell)}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
