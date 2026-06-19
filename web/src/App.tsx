import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/Header";
import { Grid } from "@/components/Grid";
import { CellDetail } from "@/components/CellDetail";
import { fetchStatus, refreshSlices } from "@/lib/api";
import type { CurrentCell } from "@/lib/types";

type VariantKey = "qa/com" | "qa/canonical" | "prod/com" | "prod/canonical";

export default function App() {
  const [cells, setCells] = useState<CurrentCell[]>([]);
  const [sliceCount, setSliceCount] = useState(20);
  const [variant, setVariant] = useState<VariantKey>("qa/com");
  const [selected, setSelected] = useState<CurrentCell | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 20 });

  async function load() {
    const r = await fetchStatus();
    setCells(r.cells);
    setSliceCount(r.sliceCount);
  }
  useEffect(() => { load(); }, []);

  // Drive the slice sweep, refreshing the grid after EACH slice so results
  // stream in instead of appearing all at once when the whole sweep finishes.
  async function handleRefresh() {
    setRefreshing(true);
    setProgress({ done: 0, total: sliceCount });
    try {
      await refreshSlices(sliceCount, async (done) => {
        setProgress({ done, total: sliceCount });
        await load();
      });
      toast.success("Refresh complete");
    } catch {
      toast.error("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const [env, host_variant] = variant.split("/") as ["qa" | "prod", "canonical" | "com"];
  const filtered = useMemo(
    () => cells.filter((c) => c.env === env && c.host_variant === host_variant),
    [cells, env, host_variant]
  );
  const lastTs = cells.length ? Math.max(...cells.map((c) => c.ts)) : null;

  return (
    <TooltipProvider>
      <Header lastTs={lastTs} refreshing={refreshing} progress={progress} onRefresh={handleRefresh} />
      <div className="p-4">
        <Tabs value={variant} onValueChange={(v) => setVariant(v as VariantKey)}>
          <TabsList>
            <TabsTrigger value="qa/com">QA · .com</TabsTrigger>
            <TabsTrigger value="qa/canonical">QA · canonical</TabsTrigger>
            <TabsTrigger value="prod/com">Prod · .com</TabsTrigger>
            <TabsTrigger value="prod/canonical">Prod · canonical</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-4"><Grid cells={filtered} onSelect={setSelected} /></div>
        <p className="mt-4 text-xs text-muted-foreground">NL, CH/DE, CH/FR are Core-only (no workshops) — not tracked.</p>
      </div>
      <CellDetail cell={selected} onClose={() => setSelected(null)} />
      <Toaster />
    </TooltipProvider>
  );
}
