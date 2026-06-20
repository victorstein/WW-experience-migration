export type Backend = "vercel" | "nginx" | "redirect-exp" | "redirect" | "vercel-404" | "404" | "other" | "error";
export interface CurrentCell {
  env: "qa" | "prod";
  host_variant: "canonical" | "com";
  market: string;
  concern: "gateway" | "main" | "coachlist" | "coachdet" | "eventdet" | "locdet";
  url: string;
  backend: Backend;
  http_status: number | null;
  matched_path: string | null;
  redirect_to: string | null;
  server: string | null;
  via: string | null;
  served_by: string | null;
  vercel_id: string | null;
  ts: number;
  since_ts: number;
  first_ts: number;
}
export interface HistoryRow extends Omit<CurrentCell, "since_ts" | "first_ts"> {}
