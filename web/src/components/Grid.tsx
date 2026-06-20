import { Loader2 } from "lucide-react";
import { Cell } from "./Cell";
import { cn } from "@/lib/utils";
import type { CurrentCell } from "@/lib/types";
import type { MarketLoad } from "@/lib/progress";

const MARKETS = ["US", "UK", "CA/EN", "CA/FR", "AU", "NZ", "DE", "FR", "BE/FR", "BE/NL", "SE"];
const CONCERNS = ["main", "coachlist", "coachdet", "eventdet", "locdet"] as const;

// Shared column template: a fixed market column + 5 equal concern columns.
const COLS = "grid grid-cols-[88px_repeat(5,minmax(0,1fr))]";

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
  return (
    <div className="space-y-2.5">
      {/* Column headers — modeled on the WW session-list header row. */}
      <div className={cn(COLS, "px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground")}>
        <div className="py-1">Market</div>
        {CONCERNS.map((c) => (
          <div key={c} className="py-1 text-center">
            {c}
          </div>
        ))}
      </div>

      {/* One rounded card per market, with vertical dividers between cells. */}
      {MARKETS.map((m) => {
        const load = marketLoad?.[m] ?? "idle";
        return (
          <div
            key={m}
            className={cn(
              COLS,
              "items-stretch divide-x divide-border overflow-hidden rounded-2xl border bg-card shadow-sm transition",
              load === "pending" && "opacity-40",
              load === "loading" && "ring-2 ring-primary/40"
            )}
          >
            <div className="flex items-center gap-1.5 px-4 py-4 text-sm font-semibold">
              {m}
              {load === "loading" && <Loader2 className="size-3.5 animate-spin text-primary" />}
            </div>
            {CONCERNS.map((concern) => {
              const cell = byKey.get(`${m}|${concern}`);
              return (
                <Cell
                  key={concern}
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
  );
}
