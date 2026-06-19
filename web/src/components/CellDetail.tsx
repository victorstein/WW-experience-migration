import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CurrentCell, HistoryRow } from "@/lib/types";
import { fetchHistory } from "@/lib/api";
import { verdict } from "@/lib/verdict";

export function CellDetail({ cell, onClose }: { cell: CurrentCell | null; onClose: () => void }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  useEffect(() => {
    if (cell) fetchHistory(cell).then(setHistory).catch(() => setHistory([]));
  }, [cell]);
  return (
    <Sheet open={!!cell} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        {cell && (
          <>
            <SheetHeader>
              <SheetTitle>{cell.market} · {cell.concern} · {cell.env}/{cell.host_variant}</SheetTitle>
            </SheetHeader>
            <div className="mt-2 text-xs break-all">{cell.url}</div>
            <ul className="mt-4 space-y-1 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between border-b py-1">
                  <span>{verdict(h.backend).label} · HTTP {h.http_status ?? "—"}</span>
                  <span className="text-muted-foreground">{new Date(h.ts * 1000).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
