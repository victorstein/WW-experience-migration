import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { Cell } from "./Cell";
import { cn } from "@/lib/utils";
import type { CurrentCell } from "@/lib/types";
import type { MarketLoad } from "@/lib/progress";

const MARKETS = ["US", "UK", "CA/EN", "CA/FR", "AU", "NZ", "DE", "FR", "BE/FR", "BE/NL", "SE"];
const CONCERNS = ["main", "coachlist", "coachdet", "eventdet", "locdet"] as const;

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
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[120px] font-semibold text-foreground">Market</TableHead>
            {CONCERNS.map((c) => (
              <TableHead
                key={c}
                className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {MARKETS.map((m) => {
            const load = marketLoad?.[m] ?? "idle";
            return (
              <TableRow
                key={m}
                className={cn(
                  "transition-opacity",
                  load === "pending" && "opacity-40",
                  load === "loading" && "bg-primary/5"
                )}
              >
                <TableCell className="font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    {m}
                    {load === "loading" && <Loader2 className="size-3.5 animate-spin text-primary" />}
                  </span>
                </TableCell>
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
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
