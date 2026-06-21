import { Loader2, RotateCw } from "lucide-react";
import { Cell, CellPill } from "./Cell";
import { cn } from "@/lib/utils";
import type { CurrentCell } from "@/lib/types";
import type { MarketLoad } from "@/lib/progress";

const MARKETS = ["US", "UK", "CA/EN", "CA/FR", "AU", "NZ", "DE", "FR", "BE/FR", "BE/NL", "SE"];
// Markets with no separate canonical TLD — their canonical IS .com, so the
// canonical tabs have nothing distinct to show for them.
const NO_CANONICAL = new Set(["US", "NZ"]);
const CONCERNS = [
  { key: "gateway", label: "Gateway" },
  { key: "main", label: "Main" },
  { key: "coachlist", label: "Coach list" },
  { key: "coachdet", label: "Coach detail" },
  { key: "eventdet", label: "Event detail" },
  { key: "locdet", label: "Location" },
] as const;

// Desktop column template: a fixed market column + 6 equal concern columns. The
// table scrolls horizontally below ~lg widths (tablets) via the min-width wrapper.
const COLS = "grid grid-cols-[200px_repeat(6,minmax(0,1fr))]";

export function Grid({
  cells,
  marketLoad,
  hostVariant,
  onReloadMarket,
}: {
  cells: CurrentCell[];
  marketLoad?: Record<string, MarketLoad>;
  hostVariant: "com" | "canonical";
  onReloadMarket?: (market: string) => void;
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

  const meta = (m: string) => ({
    load: marketLoad?.[m] ?? "idle",
    host: hostByMarket.get(m),
    // US/NZ have no canonical domain — on the canonical tabs there's nothing
    // distinct to check, so flag it rather than render dead cells.
    sameAsCom: hostVariant === "canonical" && NO_CANONICAL.has(m),
  });

  // Market name + reload control + host subheader — shared by both layouts.
  const Heading = ({ m }: { m: string }) => {
    const { load, host, sameAsCom } = meta(m);
    return (
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {m}
          {load === "loading" ? (
            <Loader2 className="size-3.5 animate-spin text-primary" />
          ) : !sameAsCom ? (
            <button
              type="button"
              onClick={() => onReloadMarket?.(m)}
              aria-label={`Reload ${m}`}
              title={`Reload ${m}`}
              className="rounded p-0.5 text-muted-foreground/50 transition hover:text-foreground"
            >
              <RotateCw className="size-3.5" />
            </button>
          ) : null}
        </div>
        {host && (
          <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={host}>
            {host}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* ===== Tablet + desktop: the matrix table, horizontally scrollable =====
          overflow-x-auto traps a sticky header (it becomes a vertical scroll
          context), so at lg+ — where the 820px grid always fits and no horizontal
          scroll is needed — drop the overflow so the sticky header row can pin to
          the page as you scroll down. Below lg (tablet) horizontal scroll wins and
          the header just doesn't stick there. */}
      <div className="hidden overflow-x-auto md:block lg:overflow-visible">
        <div className="min-w-[820px]">
          {/* Header row — bold real-word labels with an underline rule (WW style).
              Sticky just below the page banner (~64px) so the column labels stay
              visible while scrolling the market rows vertically. */}
          <div className={cn(COLS, "sticky top-16 z-10 border-b bg-background px-4 pb-3 pt-3 text-sm font-bold")}>
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
              const { load, sameAsCom } = meta(m);
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
                  <div className="px-4 py-5">
                    <Heading m={m} />
                  </div>
                  {sameAsCom ? (
                    <div className="col-span-6 flex items-center px-4 text-sm italic text-muted-foreground">
                      same as .com
                    </div>
                  ) : (
                    CONCERNS.map((c) => (
                      <Cell key={c.key} cell={byKey.get(`${m}|${c.key}`)} loading={load === "loading"} />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== Phones: one card per market, concerns stacked as labeled rows ===== */}
      <div className="space-y-3 md:hidden">
        {MARKETS.map((m) => {
          const { load, sameAsCom } = meta(m);
          return (
            <div
              key={m}
              className={cn(
                "overflow-hidden rounded-2xl bg-card shadow-sm transition",
                load === "pending" && "opacity-40",
                load === "loading" && "ring-2 ring-primary/40"
              )}
            >
              <div className="border-b px-4 py-3">
                <Heading m={m} />
              </div>
              {sameAsCom ? (
                <div className="px-4 py-4 text-sm italic text-muted-foreground">same as .com</div>
              ) : (
                <div className="divide-y">
                  {CONCERNS.map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">{c.label}</span>
                      <CellPill cell={byKey.get(`${m}|${c.key}`)} loading={load === "loading"} showNote />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
