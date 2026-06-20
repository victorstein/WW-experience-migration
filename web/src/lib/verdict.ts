import type { Backend } from "./types";

// Pill classes: a translucent tint + inset ring + tinted text, tuned to read on
// both the light and dark (WW navy) themes. No logos — color + text only.
export function verdict(b: Backend): { label: string; className: string; note?: string } {
  switch (b) {
    case "vercel":
      return { label: "Vercel", className: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30 dark:text-emerald-300" };
    case "nginx":
      return { label: "nginx", className: "bg-amber-500/15 text-amber-700 ring-amber-500/30 dark:text-amber-300", note: "old workshop finder" };
    case "redirect-exp":
      return { label: "→ experience", className: "bg-blue-500/15 text-blue-700 ring-blue-500/30 dark:text-blue-300" };
    case "404":
      return { label: "404", className: "bg-rose-500/15 text-rose-700 ring-rose-500/30 dark:text-rose-300" };
    case "error":
      return { label: "error", className: "bg-orange-500/15 text-orange-700 ring-orange-500/30 dark:text-orange-300" };
    default:
      return { label: "other", className: "bg-slate-500/15 text-slate-600 ring-slate-500/30 dark:text-slate-300" };
  }
}

export function sinceLabel(since_ts: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now / 1000 - since_ts) / 60));
  if (mins < 60) return `flipped ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `flipped ${hrs}h ago`;
  return `flipped ${Math.round(hrs / 24)}d ago`;
}

// "flipped Xm ago" only when the backend actually changed since we started
// tracking the cell. If it's held its value since the first check (since_ts ===
// first_ts), nothing flipped — saying "flipped" would be misleading.
export function changeSummary(
  cell: { since_ts: number; first_ts: number },
  now = Date.now()
): string {
  if (cell.since_ts === cell.first_ts) return "no changes since tracked";
  return sinceLabel(cell.since_ts, now);
}
