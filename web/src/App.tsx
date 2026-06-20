import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/Header";
import { Grid } from "@/components/Grid";
import { fetchStatus, refreshSlices } from "@/lib/api";
import { marketSlices, marketStatus, type MarketLoad } from "@/lib/progress";
import type { CurrentCell } from "@/lib/types";

type VariantKey = "qa/com" | "qa/canonical" | "prod/com" | "prod/canonical";

export default function App() {
  const [cells, setCells] = useState<CurrentCell[]>([]);
  const [sliceCount, setSliceCount] = useState(20);
  const [slicePlan, setSlicePlan] = useState<string[][]>([]);
  const [variant, setVariant] = useState<VariantKey>("qa/com");
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
      <div className="min-h-screen bg-background">
        <Header lastTs={lastTs} refreshing={refreshing} progress={progress} onRefresh={handleRefresh} />
        <main className="mx-auto max-w-6xl px-6 py-8 md:px-10">
          <Tabs value={variant} onValueChange={(v) => setVariant(v as VariantKey)}>
            <TabsList className="rounded-full">
              <TabsTrigger value="qa/com" className="rounded-full px-5">QA · .com</TabsTrigger>
              <TabsTrigger value="qa/canonical" className="rounded-full px-5">QA · canonical</TabsTrigger>
              <TabsTrigger value="prod/com" className="rounded-full px-5">Prod · .com</TabsTrigger>
              <TabsTrigger value="prod/canonical" className="rounded-full px-5">Prod · canonical</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="mt-6">
            <Grid cells={filtered} marketLoad={marketLoad} hostVariant={host_variant} />
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            NL, CH/DE, CH/FR are Core-only (no workshops) — not tracked.
          </p>
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
