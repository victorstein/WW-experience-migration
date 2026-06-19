import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { refreshAll } from "@/lib/api";
import { useState } from "react";

export function Header({ sliceCount, lastTs, onRefreshed }: { sliceCount: number; lastTs: number | null; onRefreshed: () => void }) {
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try { await refreshAll(sliceCount); toast.success("Refreshed all slices"); onRefreshed(); }
    catch { toast.error("Refresh failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <h1 className="text-lg font-semibold">Workshops Status Board</h1>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{lastTs ? `Last data: ${new Date(lastTs * 1000).toLocaleString()}` : "No data yet"}</span>
        <Button onClick={refresh} disabled={busy}>{busy ? "Refreshing…" : "Refresh now"}</Button>
      </div>
    </div>
  );
}
