import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

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
    <div className="border-b">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold">Workshops Status Board</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{lastTs ? `Last data: ${new Date(lastTs * 1000).toLocaleString()}` : "No data yet"}</span>
          <Button onClick={onRefresh} disabled={refreshing}>
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
        <div className="px-4 pb-3" aria-live="polite">
          <Progress value={pct} className="h-1.5" />
        </div>
      )}
    </div>
  );
}
