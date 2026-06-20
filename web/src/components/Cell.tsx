import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CurrentCell } from "@/lib/types";
import { verdict, changeSummary } from "@/lib/verdict";

export function Cell({ cell, loading = false }: { cell?: CurrentCell; loading?: boolean }) {
  // Short, vertically-centered divider on the left of every concern cell — the
  // subtle column separators from the WW session list.
  const WRAP =
    "relative flex items-center justify-center px-2 py-5 before:absolute before:left-0 before:top-1/2 before:h-8 before:w-px before:-translate-y-1/2 before:bg-border";
  if (!cell) {
    return (
      <div className={WRAP}>
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
    <div className={WRAP}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={cell.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset outline-none transition cursor-pointer",
              "hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-ring",
              loading && "animate-pulse opacity-70",
              v.className
            )}
          >
            {v.label}
          </a>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-md">
          <div className="flex flex-col gap-1 py-0.5">
            <div className="break-all font-mono text-xs font-medium">{cell.url}</div>
            <div className="flex flex-wrap items-center gap-x-2 text-xs opacity-75">
              <span>HTTP {cell.http_status ?? "—"}</span>
              {cell.redirect_to && <span className="break-all">→ {cell.redirect_to}</span>}
              <span>· {changeSummary(cell)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 font-mono text-[11px] opacity-60">
              <span>server: {cell.server || "—"}</span>
              {cell.matched_path && <span className="break-all">· matched: {cell.matched_path}</span>}
            </div>
            <div className="text-[11px] opacity-50">opens in a new tab ↗</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
