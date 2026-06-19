import type { Backend } from "./types";

export function verdict(b: Backend): { label: string; className: string } {
  switch (b) {
    case "vercel": return { label: "✅ Vercel", className: "bg-green-100 text-green-900" };
    case "nginx": return { label: "🟧 nginx", className: "bg-orange-100 text-orange-900" };
    case "redirect-exp": return { label: "↪️ → experience", className: "bg-yellow-100 text-yellow-900" };
    case "404": return { label: "❌ 404", className: "bg-red-100 text-red-900" };
    case "error": return { label: "⚠️ error", className: "bg-red-100 text-red-900" };
    default: return { label: "⚠️ other", className: "bg-gray-100 text-gray-900" };
  }
}

export function sinceLabel(since_ts: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now / 1000 - since_ts) / 60));
  if (mins < 60) return `flipped ${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `flipped ${hrs}h ago`;
  return `flipped ${Math.round(hrs / 24)}d ago`;
}
