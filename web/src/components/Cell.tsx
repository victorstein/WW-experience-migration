import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CurrentCell } from "@/lib/types";
import { verdict, sinceLabel } from "@/lib/verdict";

export function Cell({
  cell,
  loading = false,
  onClick,
}: {
  cell?: CurrentCell;
  loading?: boolean;
  onClick: () => void;
}) {
  if (!cell) {
    return (
      <div className="flex items-center justify-center px-2 py-4">
        {loading ? (
          <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </div>
    );
  }
  const v = verdict(cell.backend);
  return (
    <div className="flex items-center justify-center px-2 py-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "rounded-full outline-none transition focus-visible:ring-2 focus-visible:ring-ring",
              "hover:-translate-y-px hover:shadow-sm",
              loading && "animate-pulse opacity-70"
            )}
          >
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                v.className
              )}
            >
              {v.label}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="break-all text-xs font-medium">{cell.url}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            HTTP {cell.http_status ?? "—"}
            {cell.redirect_to ? ` → ${cell.redirect_to}` : ""} · {sinceLabel(cell.since_ts)}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
