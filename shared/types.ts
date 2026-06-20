export type Env = "qa" | "prod";
export type HostVariant = "canonical" | "com";
export type Concern = "gateway" | "main" | "coachlist" | "coachdet" | "eventdet" | "locdet";
export type Backend = "vercel" | "nginx" | "redirect-exp" | "404" | "other" | "error";

export interface Cell {
  env: Env;
  host_variant: HostVariant;
  market: string;
  concern: Concern;
}

export interface Hop {
  status: number;
  location: string | null;
}

export interface CheckOutcome {
  finalStatus: number;
  backend: Backend;
  matched_path: string | null;
  redirect_to: string | null;
  server: string | null;
  via: string | null;
  served_by: string | null;
}

export interface CheckRow extends Cell {
  url: string;
  http_status: number | null;
  backend: Backend;
  matched_path: string | null;
  redirect_to: string | null;
  ts: number;
}

export interface CurrentRow extends CheckRow {
  since_ts: number;
  first_ts: number; // ts of the first-ever check for this cell (never changes)
}
