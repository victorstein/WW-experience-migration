import { Badge } from "@/components/ui/badge";
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
      <td className="px-2 py-2 text-center align-middle">
        {loading ? (
          <div className="mx-auto h-5 w-16 animate-pulse rounded-full bg-muted" />
        ) : (
          <span className="text-muted-foreground/40">—</span>
        )}
      </td>
    );
  }
  const v = verdict(cell.backend);
  return (
    <td className="px-2 py-1.5 text-center align-middle">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "w-full rounded-md px-1 py-1 transition hover:bg-accent",
              loading && "animate-pulse opacity-70"
            )}
          >
            <Badge className={cn("rounded-full px-2.5 font-medium shadow-sm", v.className)}>
              {v.label}
            </Badge>
            <div className="mt-1 text-[10px] leading-none text-muted-foreground">
              {sinceLabel(cell.since_ts)}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="break-all text-xs font-medium">{cell.url}</div>
          <div className="text-xs text-muted-foreground">
            HTTP {cell.http_status ?? "—"}
            {cell.redirect_to ? ` → ${cell.redirect_to}` : ""}
          </div>
        </TooltipContent>
      </Tooltip>
    </td>
  );
}
