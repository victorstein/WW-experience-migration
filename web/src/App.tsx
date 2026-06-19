import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/Header";
import { Grid } from "@/components/Grid";
import { CellDetail } from "@/components/CellDetail";
import { fetchStatus, refreshSlices } from "@/lib/api";
import { marketSlices, marketStatus, type MarketLoad } from "@/lib/progress";
import type { CurrentCell } from "@/lib/types";

type VariantKey = "qa/com" | "qa/canonical" | "prod/com" | "prod/canonical";

export default function App() {
  const [cells, setCells] = useState<CurrentCell[]>([]);
  const [sliceCount, setSliceCount] = useState(20);
  const [slicePlan, setSlicePlan] = useState<string[][]>([]);
  const [variant, setVariant] = useState<VariantKey>("qa/com");
  const [selected, setSelected] = useState<CurrentCell | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 20 });

  async function load() {
    const r = await fetchStatus();
    setCells(r.cells);
    setSliceCount(r.sliceCount);
    setSlicePlan(r.slicePlan ?? []);
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

  // Per-country loading state, derived from how many slices have completed.
  const marketLoad = useMemo(() => {
    const slices = marketSlices(slicePlan);
    const out: Record<string, MarketLoad> = {};
    for (const m of Object.keys(slices)) {
      out[m] = marketStatus(slices[m], progress.done, refreshing);
    }
    return out;
  }, [slicePlan, progress.done, refreshing]);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-muted/30">
        <Header lastTs={lastTs} refreshing={refreshing} progress={progress} onRefresh={handleRefresh} />
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Tabs value={variant} onValueChange={(v) => setVariant(v as VariantKey)}>
            <TabsList>
              <TabsTrigger value="qa/com">QA · .com</TabsTrigger>
              <TabsTrigger value="qa/canonical">QA · canonical</TabsTrigger>
              <TabsTrigger value="prod/com">Prod · .com</TabsTrigger>
              <TabsTrigger value="prod/canonical">Prod · canonical</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-4">
            <Grid cells={filtered} marketLoad={marketLoad} onSelect={setSelected} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            NL, CH/DE, CH/FR are Core-only (no workshops) — not tracked.
          </p>
        </main>
      </div>
      <CellDetail cell={selected} onClose={() => setSelected(null)} />
      <Toaster />
    </TooltipProvider>
  );
}
