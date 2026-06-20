import { Fragment } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CurrentCell } from "@/lib/types";
import { verdict, changeSummary } from "@/lib/verdict";

// The status pill + its tap/hover tooltip, with no layout chrome — so it composes
// into both the desktop matrix cell and the stacked mobile row. `showNote` renders
// the verdict note inline (right-aligned) for the mobile rows; the desktop cell
// positions the note absolutely instead, to keep pills aligned across the grid.
export function CellPill({
  cell,
  loading = false,
  showNote = false,
}: {
  cell?: CurrentCell;
  loading?: boolean;
  showNote?: boolean;
}) {
  if (!cell) {
    return loading ? (
      <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
    ) : (
      <span className="text-muted-foreground/40">—</span>
    );
  }
  const v = verdict(cell.backend);
  const fingerprints: [string, string][] = [["x-vercel-id", cell.vercel_id || "— (absent)"]];
  if (cell.via) fingerprints.push(["via", cell.via]);
  if (cell.served_by) fingerprints.push(["served-by", cell.served_by]);
  if (cell.matched_path) fingerprints.push(["matched", cell.matched_path]);

  const pill = (
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
          <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
            {fingerprints.map(([k, val]) => (
              <Fragment key={k}>
                <dt className="opacity-50">{k}</dt>
                <dd className="opacity-80">
                  {val.split(", ").map((part, i) => (
                    <div key={i} className="break-words">
                      {part}
                    </div>
                  ))}
                </dd>
              </Fragment>
            ))}
          </dl>
          <div className="text-[11px] opacity-50">opens in a new tab ↗</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );

  if (!showNote || !v.note) return pill;
  return (
    <span className="flex flex-col items-end gap-0.5">
      {pill}
      <span className="text-[10px] leading-none text-muted-foreground/70">{v.note}</span>
    </span>
  );
}

// Desktop matrix cell: a centered pill with a short inset divider and the note
// positioned absolutely below it (so the pill stays aligned with neighbours that
// have no note).
export function Cell({ cell, loading = false }: { cell?: CurrentCell; loading?: boolean }) {
  const WRAP =
    "relative flex items-center justify-center px-2 py-5 before:absolute before:left-0 before:top-1/2 before:h-8 before:w-px before:-translate-y-1/2 before:bg-border";
  const note = cell ? verdict(cell.backend).note : undefined;
  return (
    <div className={WRAP}>
      <CellPill cell={cell} loading={loading} />
      {note && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 mt-3.5 -translate-x-1/2 whitespace-nowrap text-[10px] leading-none text-muted-foreground/70">
          {note}
        </span>
      )}
    </div>
  );
}
