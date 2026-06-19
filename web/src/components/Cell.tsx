import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CurrentCell } from "@/lib/types";
import { verdict, sinceLabel } from "@/lib/verdict";

export function Cell({ cell, onClick }: { cell?: CurrentCell; onClick: () => void }) {
  if (!cell) return <td className="p-2 text-center text-muted-foreground">—</td>;
  const v = verdict(cell.backend);
  return (
    <td className="p-1 text-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <button onClick={onClick} className="w-full">
            <Badge className={v.className}>{v.label}</Badge>
            <div className="text-[10px] text-muted-foreground">{sinceLabel(cell.since_ts)}</div>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs">{cell.url}</div>
          <div className="text-xs">HTTP {cell.http_status ?? "—"}{cell.redirect_to ? ` → ${cell.redirect_to}` : ""}</div>
        </TooltipContent>
      </Tooltip>
    </td>
  );
}
