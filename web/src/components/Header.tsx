import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ThemeToggle } from "@/components/ThemeToggle";

export interface RefreshProgress {
  done: number;
  total: number;
}

export function Header({
  lastTs,
  refreshing,
  progress,
  onRefresh,
}: {
  lastTs: number | null;
  refreshing: boolean;
  progress: RefreshProgress;
  onRefresh: () => void;
}) {
  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4 md:px-10">
        <h1 className="text-base font-bold tracking-tight sm:text-lg">Workshops Status Board</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden text-sm text-muted-foreground md:inline">
            {lastTs ? `Last data: ${new Date(lastTs * 1000).toLocaleString()}` : "No data yet"}
          </span>
          <ThemeToggle />
          <Button onClick={onRefresh} disabled={refreshing} className="rounded-full px-5 font-semibold">
            {refreshing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Checking… {progress.done}/{progress.total}
              </>
            ) : (
              "Refresh now"
            )}
          </Button>
        </div>
      </div>
      {refreshing && (
        <div className="mx-auto max-w-6xl px-6 pb-3 md:px-10" aria-live="polite">
          <Progress value={pct} className="h-1" />
        </div>
      )}
    </header>
  );
}
