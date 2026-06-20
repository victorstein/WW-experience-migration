import type { Cell, CheckRow, CurrentRow } from "../shared/types";

export interface AppEnv {
  DB: D1Database;
  ASSETS: Fetcher;
}

export async function appendAndUpsert(
  db: D1Database,
  rows: CheckRow[]
): Promise<{ changed: CheckRow[] }> {
  if (rows.length === 0) return { changed: [] };

  // Read prior backends for the cells in this batch (to report what changed).
  const prior = new Map<string, string | null>();
  for (const r of rows) {
    const res = await db
      .prepare("SELECT backend FROM current WHERE env=? AND host_variant=? AND market=? AND concern=?")
      .bind(r.env, r.host_variant, r.market, r.concern)
      .first<{ backend: string }>();
    prior.set(key(r), res?.backend ?? null);
  }

  const stmts: D1PreparedStatement[] = [];
  for (const r of rows) {
    stmts.push(
      db.prepare(
        `INSERT INTO checks (ts, env, host_variant, market, concern, url, http_status, backend, matched_path, redirect_to)
         VALUES (?,?,?,?,?,?,?,?,?,?)`
      ).bind(r.ts, r.env, r.host_variant, r.market, r.concern, r.url, r.http_status, r.backend, r.matched_path, r.redirect_to)
    );
    stmts.push(
      db.prepare(
        `INSERT INTO current (env, host_variant, market, concern, url, backend, http_status, matched_path, redirect_to, ts, since_ts, first_ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(env, host_variant, market, concern) DO UPDATE SET
           url=excluded.url, backend=excluded.backend, http_status=excluded.http_status,
           matched_path=excluded.matched_path, redirect_to=excluded.redirect_to, ts=excluded.ts,
           since_ts = CASE WHEN current.backend = excluded.backend THEN current.since_ts ELSE excluded.ts END
           -- first_ts intentionally NOT in the SET clause: it keeps the original
           -- first-tracked ts so we can tell "stable since first tracked" from a real flip.`
      ).bind(r.env, r.host_variant, r.market, r.concern, r.url, r.backend, r.http_status, r.matched_path, r.redirect_to, r.ts, r.ts, r.ts)
    );
  }
  await db.batch(stmts);

  const changed = rows.filter((r) => prior.get(key(r)) !== r.backend);
  return { changed };
}

export async function getStatus(db: D1Database): Promise<CurrentRow[]> {
  const res = await db.prepare("SELECT * FROM current").all<CurrentRow>();
  return res.results ?? [];
}

export async function getHistory(db: D1Database, cell: Cell, limit: number): Promise<CheckRow[]> {
  const res = await db
    .prepare(
      `SELECT env, host_variant, market, concern, url, http_status, backend, matched_path, redirect_to, ts
       FROM checks WHERE env=? AND host_variant=? AND market=? AND concern=? ORDER BY ts DESC LIMIT ?`
    )
    .bind(cell.env, cell.host_variant, cell.market, cell.concern, limit)
    .all<CheckRow>();
  return res.results ?? [];
}

export async function getCursor(db: D1Database): Promise<number> {
  const res = await db.prepare("SELECT v FROM meta WHERE k='cursor'").first<{ v: string }>();
  return res ? parseInt(res.v, 10) : 0;
}

export async function setCursor(db: D1Database, n: number): Promise<void> {
  await db
    .prepare("INSERT INTO meta (k, v) VALUES ('cursor', ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v")
    .bind(String(n))
    .run();
}

function key(c: Cell): string {
  return `${c.env}|${c.host_variant}|${c.market}|${c.concern}`;
}
