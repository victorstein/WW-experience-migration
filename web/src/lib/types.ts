export type Backend = "vercel" | "nginx" | "redirect-exp" | "404" | "other" | "error";
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
  ts: number;
  since_ts: number;
  first_ts: number;
}
export interface HistoryRow extends Omit<CurrentCell, "since_ts" | "first_ts"> {}
