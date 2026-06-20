# Workshops Status Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Cloudflare Worker that periodically checks Experiences→Workshops routing across 200 market/concern/host cells, stores a timeline in D1, and serves a Vite+React (shadcn/ui) dashboard.

**Architecture:** Single Worker + Static Assets (Hono router) serves the built SPA, exposes `/api/*`, and runs a cron `scheduled()` checker. D1 (SQLite) holds append-only `checks` history + a denormalized `current` read-model. Free-tier safe: ~20 slices of ≤10 cells, manual-redirect fetch, batched writes.

**Tech Stack:** TypeScript, Cloudflare Workers + D1 + Wrangler, Hono, Vitest (`@cloudflare/vitest-pool-workers` for worker/D1; jsdom project for web), Vite + React + Tailwind + shadcn/ui.

**Deployment is OUT OF SCOPE.** `wrangler.toml` exists for `wrangler dev` and is deploy-ready; do not run `wrangler deploy` or wire CI.

Spec: `docs/superpowers/specs/2026-06-19-workshops-status-board-design.md`.

---

## File structure

```
package.json                 # root: worker + tooling deps, scripts
tsconfig.json                # base TS config (worker + shared)
wrangler.toml                # worker name, d1 binding, [assets], [triggers] crons, [[migrations]]
vitest.config.ts             # workers-pool project (worker + shared tests)
migrations/0001_init.sql     # checks, current, meta
shared/
  types.ts                   # Env, HostVariant, Concern, Backend, Cell, Hop, CheckOutcome, CheckRow, CurrentRow
  matrix.ts                  # MARKETS, CONCERNS, VARIANTS, allCells(), buildUrl(), partitionSlices(), SLICE_MAX
  classify.ts                # classify(finalStatus, finalHeaders, chain) -> CheckOutcome
worker/
  fetcher.ts                 # probe(url): manual-redirect fetch, hop cap, timeout
  db.ts                      # appendAndUpsert(), getStatus(), getHistory(), getCursor(), setCursor()
  checker.ts                 # runSlice(env, sliceIndex, now)
  api.ts                     # Hono app: /api/status, /api/history, /api/refresh, asset fallback
  index.ts                   # Worker entry: { fetch, scheduled }
test/
  matrix.test.ts
  classify.test.ts
  fetcher.test.ts
  db.test.ts
  checker.test.ts
  api.test.ts
web/                         # Vite React app (created in Task 7)
  vite.config.ts, tailwind, src/...
```

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `wrangler.toml`, `vitest.config.ts`, `.gitignore` (exists), `migrations/.gitkeep`

- [ ] **Step 1: Init npm + install deps**

Run:
```bash
cd workshops-status-board
npm init -y
npm i hono
npm i -D typescript wrangler vitest @cloudflare/vitest-pool-workers @cloudflare/workers-types
```
Expected: packages install, `package.json` created.

- [ ] **Step 2: Write `package.json` scripts** (replace the `scripts` block)

```json
{
  "name": "workshops-status-board",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler dev",
    "migrate:local": "wrangler d1 migrations apply workshops_board --local",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true
  },
  "include": ["shared", "worker", "test"]
}
```

- [ ] **Step 4: Write `wrangler.toml`**

```toml
name = "workshops-status-board"
main = "worker/index.ts"
compatibility_date = "2026-06-01"

[assets]
directory = "./web/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"

[[d1_databases]]
binding = "DB"
database_name = "workshops_board"
database_id = "local-placeholder-id"   # replace with real id when you create the D1 (deploy time)

[triggers]
crons = ["*/3 * * * *"]
```

- [ ] **Step 5: Write `vitest.config.ts`** (workers pool; loads migrations + passes them to tests)

```ts
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations("./migrations");
  return {
    test: {
      include: ["test/**/*.test.ts"],
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          wrangler: { configPath: "./wrangler.toml" },
          miniflare: {
            d1Databases: { DB: "workshops_board" },
            bindings: { TEST_MIGRATIONS: migrations },
          },
        },
      },
    },
  };
});
```

- [ ] **Step 5b: Write `test/apply-migrations.ts`** (creates the tables before each test file)

```ts
import { applyD1Migrations, env } from "cloudflare:test";
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

- [ ] **Step 5c: Write `test/env.d.ts`** (types the test bindings)

```ts
import type { D1Migration } from "cloudflare:test";
declare module "cloudflare:test" {
  interface ProvidedEnv {
    DB: D1Database;
    ASSETS: Fetcher;
    TEST_MIGRATIONS: D1Migration[];
  }
}
```

- [ ] **Step 6: Create migrations dir placeholder**

Run: `mkdir -p migrations && touch migrations/.gitkeep`

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: scaffold worker project (wrangler, vitest, tsconfig)"
```

---

## Task 1: Shared types + matrix

**Files:**
- Create: `shared/types.ts`, `shared/matrix.ts`
- Test: `test/matrix.test.ts`

- [ ] **Step 1: Write `shared/types.ts`**

```ts
export type Env = "qa" | "prod";
export type HostVariant = "canonical" | "com";
export type Concern = "main" | "coachlist" | "coachdet" | "eventdet" | "locdet";
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
}
```

- [ ] **Step 2: Write the failing test `test/matrix.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { allCells, buildUrl, partitionSlices, SLICE_MAX } from "../shared/matrix";

describe("matrix", () => {
  it("produces exactly 200 cells (US/NZ canonical skipped)", () => {
    expect(allCells().length).toBe(200);
  });

  it("never emits a canonical variant for US or NZ", () => {
    const bad = allCells().filter(
      (c) => c.host_variant === "canonical" && (c.market === "US" || c.market === "NZ")
    );
    expect(bad).toEqual([]);
  });

  it("builds QA canonical .co.uk URL for UK main", () => {
    const url = buildUrl({ env: "qa", host_variant: "canonical", market: "UK", concern: "main" });
    expect(url).toBe("https://www.qat2.weightwatchers.co.uk/uk/find-a-workshop");
  });

  it("builds prod .com coachlist URL for DE", () => {
    const url = buildUrl({ env: "prod", host_variant: "com", market: "DE", concern: "coachlist" });
    expect(url).toBe("https://www.weightwatchers.com/de/workshop-finden/coaches");
  });

  it("builds CA/FR canonical event URL on fr.weightwatchers.ca", () => {
    const url = buildUrl({ env: "qa", host_variant: "canonical", market: "CA/FR", concern: "eventdet" });
    expect(url).toBe("https://www.qat2.fr.weightwatchers.ca/ca/fr/trouvez-un-atelier/virtual/25550661");
  });

  it("partitions into slices of at most SLICE_MAX, covering every cell once", () => {
    const slices = partitionSlices(allCells());
    expect(slices.every((s) => s.length <= SLICE_MAX)).toBe(true);
    expect(slices.flat().length).toBe(200);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- matrix`
Expected: FAIL ("Cannot find module '../shared/matrix'").

- [ ] **Step 4: Write `shared/matrix.ts`**

```ts
import type { Cell, Concern, Env, HostVariant } from "./types";

interface MarketDef {
  market: string;
  base: string; // locale + workshop slug, e.g. "/uk/find-a-workshop"
  coach: string; // coach-list suffix
  tld: string | null; // canonical domain w/o "www."; null => no separate TLD (US, NZ)
}

export const MARKETS: MarketDef[] = [
  { market: "US", base: "/us/find-a-workshop", coach: "/browse-ww-coaches", tld: null },
  { market: "UK", base: "/uk/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.co.uk" },
  { market: "CA/EN", base: "/ca/en/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.ca" },
  { market: "CA/FR", base: "/ca/fr/trouvez-un-atelier", coach: "/browse-ww-coaches", tld: "fr.weightwatchers.ca" },
  { market: "AU", base: "/au/find-a-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.com.au" },
  { market: "NZ", base: "/nz/find-a-workshop", coach: "/browse-ww-coaches", tld: null },
  { market: "DE", base: "/de/workshop-finden", coach: "/coaches", tld: "weightwatchers.de" },
  { market: "FR", base: "/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "weightwatchers.fr" },
  { market: "BE/FR", base: "/be/fr/trouver-un-atelier", coach: "/parcourir-ww-coachs", tld: "fr.weightwatchers.be" },
  { market: "BE/NL", base: "/be/nl/vind-een-workshop", coach: "/browse-ww-coaches", tld: "weightwatchers.be" },
  { market: "SE", base: "/se/hitta-workshop", coach: "/browse-ww-coaches", tld: "viktvaktarna.se" },
];

export const CONCERNS: Concern[] = ["main", "coachlist", "coachdet", "eventdet", "locdet"];

export const VARIANTS: { env: Env; host_variant: HostVariant }[] = [
  { env: "qa", host_variant: "com" },
  { env: "qa", host_variant: "canonical" },
  { env: "prod", host_variant: "com" },
  { env: "prod", host_variant: "canonical" },
];

export const SLICE_MAX = 10;

const COACH_ID = "/Alyce-G/1018090";
const VIRTUAL_ID = "/virtual/25550661";
const LOCATION_ID = "/2003261/ww-studio--the-st-james-building-chelsea-new-york-new-york";

function def(market: string): MarketDef {
  const d = MARKETS.find((m) => m.market === market);
  if (!d) throw new Error(`unknown market ${market}`);
  return d;
}

function host(env: Env, variant: HostVariant, d: MarketDef): string {
  const domain = variant === "com" ? "weightwatchers.com" : d.tld!;
  return "https://www." + (env === "qa" ? "qat2." : "") + domain;
}

function concernSuffix(concern: Concern, coach: string): string {
  switch (concern) {
    case "main": return "";
    case "coachlist": return coach;
    case "coachdet": return coach + COACH_ID;
    case "eventdet": return VIRTUAL_ID;
    case "locdet": return LOCATION_ID;
  }
}

export function buildUrl(cell: Cell): string {
  const d = def(cell.market);
  return host(cell.env, cell.host_variant, d) + d.base + concernSuffix(cell.concern, d.coach);
}

export function allCells(): Cell[] {
  const cells: Cell[] = [];
  for (const d of MARKETS) {
    for (const v of VARIANTS) {
      if (v.host_variant === "canonical" && d.tld === null) continue; // US/NZ have no canonical TLD
      for (const concern of CONCERNS) {
        cells.push({ env: v.env, host_variant: v.host_variant, market: d.market, concern });
      }
    }
  }
  return cells;
}

export function partitionSlices(cells: Cell[], max = SLICE_MAX): Cell[][] {
  const slices: Cell[][] = [];
  for (let i = 0; i < cells.length; i += max) slices.push(cells.slice(i, i + max));
  return slices;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- matrix`
Expected: PASS (all 6 assertions).

- [ ] **Step 6: Commit**

```bash
git add shared/types.ts shared/matrix.ts test/matrix.test.ts
git commit -m "feat: market/concern/variant matrix + URL builder (200 cells, US/NZ dedup)"
```

---

## Task 2: classify()

**Files:**
- Create: `shared/classify.ts`
- Test: `test/classify.test.ts`

- [ ] **Step 1: Write the failing test `test/classify.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { classify } from "../shared/classify";
import type { Hop } from "../shared/types";

const H = (o: Record<string, string>) => o;
const NOCHAIN: Hop[] = [];

describe("classify", () => {
  it("vercel: 200 with x-vercel-id", () => {
    const r = classify(200, H({ server: "Vercel", "x-vercel-id": "iad1::abc" }), NOCHAIN);
    expect(r.backend).toBe("vercel");
  });

  it("nginx: 200 with server nginx", () => {
    const r = classify(200, H({ server: "nginx/1.9.7" }), NOCHAIN);
    expect(r.backend).toBe("nginx");
  });

  it("redirect-exp: a hop Location lands on find-an-experience", () => {
    const chain: Hop[] = [{ status: 302, location: "https://www.weightwatchers.com/uk/find-an-experience" }];
    const r = classify(200, H({ server: "Vercel", "x-vercel-id": "x" }), chain);
    expect(r.backend).toBe("redirect-exp");
    expect(r.redirect_to).toBe("https://www.weightwatchers.com/uk/find-an-experience");
  });

  it("redirect-exp: vercel rewrite via x-matched-path experience slug", () => {
    const r = classify(200, H({ server: "Vercel", "x-vercel-id": "x", "x-matched-path": "/be-nl/find-an-experience" }), NOCHAIN);
    expect(r.backend).toBe("redirect-exp");
  });

  it("trailing-slash 302 to same workshop slug then 200 nginx => nginx (not redirect-exp)", () => {
    const chain: Hop[] = [{ status: 302, location: "/uk/find-a-workshop/" }];
    const r = classify(200, H({ server: "nginx/1.9.7" }), chain);
    expect(r.backend).toBe("nginx");
  });

  it("404 => 404", () => {
    const r = classify(404, H({ server: "Vercel", "x-vercel-id": "x" }), NOCHAIN);
    expect(r.backend).toBe("404");
  });

  it("fastly synthetic / unknown server => other, records server", () => {
    const r = classify(503, H({ server: "Varnish" }), NOCHAIN);
    expect(r.backend).toBe("other");
    expect(r.server).toBe("Varnish");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- classify`
Expected: FAIL ("Cannot find module '../shared/classify'").

- [ ] **Step 3: Write `shared/classify.ts`**

```ts
import type { Backend, CheckOutcome, Hop } from "./types";

const EXP_SLUGS = /(find-an-experience|trouver-une-experience|vind-een-ervaring)/i;

function lower(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k in headers) out[k.toLowerCase()] = headers[k];
  return out;
}

export function classify(
  finalStatus: number,
  finalHeaders: Record<string, string>,
  chain: Hop[]
): CheckOutcome {
  const h = lower(finalHeaders);
  const server = h["server"] ?? null;
  const via = h["via"] ?? null;
  const served_by = h["x-served-by"] ?? null;
  const matched_path = h["x-matched-path"] ?? null;
  const isVercel = !!h["x-vercel-id"] || /vercel/i.test(server ?? "");

  // 1) Any redirect hop landing on an experience slug.
  const expHop = chain.find((hop) => hop.location && EXP_SLUGS.test(hop.location));
  if (expHop) {
    return outcome("redirect-exp", finalStatus, matched_path, expHop.location, server, via, served_by);
  }

  // 2) Final 200.
  if (finalStatus >= 200 && finalStatus < 300) {
    if (isVercel && matched_path && EXP_SLUGS.test(matched_path)) {
      return outcome("redirect-exp", finalStatus, matched_path, null, server, via, served_by);
    }
    if (isVercel) return outcome("vercel", finalStatus, matched_path, null, server, via, served_by);
    if (/nginx/i.test(server ?? "")) return outcome("nginx", finalStatus, matched_path, null, server, via, served_by);
    return outcome("other", finalStatus, matched_path, null, server, via, served_by);
  }

  // 3) 404 / everything else.
  if (finalStatus === 404) return outcome("404", finalStatus, matched_path, null, server, via, served_by);
  return outcome("other", finalStatus, matched_path, null, server, via, served_by);
}

function outcome(
  backend: Backend, finalStatus: number, matched_path: string | null,
  redirect_to: string | null, server: string | null, via: string | null, served_by: string | null
): CheckOutcome {
  return { backend, finalStatus, matched_path, redirect_to, server, via, served_by };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- classify`
Expected: PASS (7 assertions).

- [ ] **Step 5: Commit**

```bash
git add shared/classify.ts test/classify.test.ts
git commit -m "feat: classify() over final response + redirect chain"
```

---

## Task 3: fetcher (manual redirect, hop cap, timeout)

**Files:**
- Create: `worker/fetcher.ts`
- Test: `test/fetcher.test.ts`

- [ ] **Step 1: Write the failing test `test/fetcher.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { fetchMock } from "cloudflare:test";
import { probe } from "../worker/fetcher";

beforeAll(() => { fetchMock.activate(); fetchMock.disableNetConnect(); });
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("probe", () => {
  it("captures a redirect chain and final headers", async () => {
    fetchMock.get("https://ex.test").intercept({ path: "/a" })
      .reply(302, "", { headers: { location: "https://ex.test/b" } });
    fetchMock.get("https://ex.test").intercept({ path: "/b" })
      .reply(200, "ok", { headers: { server: "Vercel", "x-vercel-id": "z" } });

    const r = await probe("https://ex.test/a");
    expect(r.chain.length).toBe(1);
    expect(r.chain[0].location).toBe("https://ex.test/b");
    expect(r.finalStatus).toBe(200);
    expect(r.finalHeaders["server"]).toBe("Vercel");
  });

  it("stops at the hop cap and throws", async () => {
    for (const p of ["/1", "/2", "/3", "/4", "/5", "/6"]) {
      fetchMock.get("https://loop.test").intercept({ path: p })
        .reply(302, "", { headers: { location: "https://loop.test/next" } });
    }
    fetchMock.get("https://loop.test").intercept({ path: "/next" })
      .reply(302, "", { headers: { location: "https://loop.test/next" } }).persist();
    await expect(probe("https://loop.test/1", 5)).rejects.toThrow(/hop cap/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetcher`
Expected: FAIL ("Cannot find module '../worker/fetcher'").

- [ ] **Step 3: Write `worker/fetcher.ts`**

```ts
import type { Hop } from "../shared/types";

export interface ProbeResult {
  chain: Hop[];
  finalStatus: number;
  finalHeaders: Record<string, string>;
}

const TIMEOUT_MS = 10_000;

export async function probe(startUrl: string, maxHops = 5): Promise<ProbeResult> {
  const chain: Hop[] = [];
  let url = startUrl;

  for (let hop = 0; hop <= maxHops; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "workshops-status-board/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }

    const status = res.status;
    const location = res.headers.get("location");
    const isRedirect = status >= 300 && status < 400 && !!location;

    if (!isRedirect) {
      const finalHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => (finalHeaders[k] = v));
      return { chain, finalStatus: status, finalHeaders };
    }

    chain.push({ status, location });
    url = new URL(location!, url).toString(); // resolve relative Location
  }

  throw new Error(`hop cap exceeded (${maxHops}) starting at ${startUrl}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- fetcher`
Expected: PASS (2 assertions).

- [ ] **Step 5: Commit**

```bash
git add worker/fetcher.ts test/fetcher.test.ts
git commit -m "feat: manual-redirect probe with hop cap + timeout"
```

---

## Task 4: D1 migration + db layer

**Files:**
- Create: `migrations/0001_init.sql`, `worker/db.ts`
- Test: `test/db.test.ts`

- [ ] **Step 1: Write `migrations/0001_init.sql`**

```sql
CREATE TABLE checks (
  id           INTEGER PRIMARY KEY,
  ts           INTEGER NOT NULL,
  env          TEXT NOT NULL,
  host_variant TEXT NOT NULL,
  market       TEXT NOT NULL,
  concern      TEXT NOT NULL,
  url          TEXT NOT NULL,
  http_status  INTEGER,
  backend      TEXT,
  matched_path TEXT,
  redirect_to  TEXT
);
CREATE INDEX idx_cell ON checks (env, host_variant, market, concern, ts);

CREATE TABLE current (
  env TEXT, host_variant TEXT, market TEXT, concern TEXT,
  url TEXT, backend TEXT, http_status INTEGER,
  matched_path TEXT, redirect_to TEXT,
  ts INTEGER, since_ts INTEGER,
  PRIMARY KEY (env, host_variant, market, concern)
);

CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
```

- [ ] **Step 2: Write the failing test `test/db.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { appendAndUpsert, getStatus, getHistory, getCursor, setCursor } from "../worker/db";
import type { CheckRow } from "../shared/types";

const row = (backend: string, ts: number): CheckRow => ({
  env: "qa", host_variant: "com", market: "US", concern: "main",
  url: "https://x/us/find-a-workshop", http_status: 200, backend: backend as any,
  matched_path: null, redirect_to: null, ts,
});

describe("db", () => {
  it("appends history and upserts current; since_ts holds until backend changes", async () => {
    const db = env.DB;
    await appendAndUpsert(db, [row("nginx", 100)]);
    await appendAndUpsert(db, [row("nginx", 200)]);
    let cur = await getStatus(db);
    expect(cur.length).toBe(1);
    expect(cur[0].backend).toBe("nginx");
    expect(cur[0].since_ts).toBe(100); // unchanged backend keeps since_ts

    const res = await appendAndUpsert(db, [row("vercel", 300)]);
    expect(res.changed.map((c) => c.market)).toContain("US");
    cur = await getStatus(db);
    expect(cur[0].backend).toBe("vercel");
    expect(cur[0].since_ts).toBe(300); // flipped -> since_ts advances

    const hist = await getHistory(db, { env: "qa", host_variant: "com", market: "US", concern: "main" }, 10);
    expect(hist.length).toBe(3);
  });

  it("cursor round-trips and defaults to 0", async () => {
    const db = env.DB;
    expect(await getCursor(db)).toBe(0);
    await setCursor(db, 7);
    expect(await getCursor(db)).toBe(7);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- db`
Expected: FAIL ("Cannot find module '../worker/db'").

- [ ] **Step 4: Write `worker/db.ts`**

```ts
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
        `INSERT INTO current (env, host_variant, market, concern, url, backend, http_status, matched_path, redirect_to, ts, since_ts)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(env, host_variant, market, concern) DO UPDATE SET
           url=excluded.url, backend=excluded.backend, http_status=excluded.http_status,
           matched_path=excluded.matched_path, redirect_to=excluded.redirect_to, ts=excluded.ts,
           since_ts = CASE WHEN current.backend = excluded.backend THEN current.since_ts ELSE excluded.ts END`
      ).bind(r.env, r.host_variant, r.market, r.concern, r.url, r.backend, r.http_status, r.matched_path, r.redirect_to, r.ts, r.ts)
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- db`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add migrations/0001_init.sql worker/db.ts test/db.test.ts
git commit -m "feat: D1 schema + db layer (append history, upsert current, cursor)"
```

---

## Task 5: checker (runSlice)

**Files:**
- Create: `worker/checker.ts`
- Test: `test/checker.test.ts`

- [ ] **Step 1: Write the failing test `test/checker.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { env, fetchMock } from "cloudflare:test";
import { runSlice } from "../worker/checker";
import { getStatus } from "../worker/db";
import { partitionSlices, allCells, buildUrl } from "../shared/matrix";

beforeAll(() => { fetchMock.activate(); fetchMock.disableNetConnect(); });
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("runSlice", () => {
  it("checks the cells in a slice and writes rows", async () => {
    const slice = partitionSlices(allCells())[0]; // up to 10 cells
    for (const cell of slice) {
      const u = new URL(buildUrl(cell));
      fetchMock.get(u.origin).intercept({ path: u.pathname })
        .reply(200, "ok", { headers: { server: "Vercel", "x-vercel-id": "z" } });
    }
    const res = await runSlice(env, 0, 1000);
    expect(res.changed.length).toBe(slice.length); // all new => all changed
    const cur = await getStatus(env.DB);
    expect(cur.length).toBe(slice.length);
    expect(cur.every((c) => c.backend === "vercel")).toBe(true);
  });

  it("records a failed fetch as backend=error without aborting the slice", async () => {
    const slice = partitionSlices(allCells())[1];
    const u0 = new URL(buildUrl(slice[0]));
    fetchMock.get(u0.origin).intercept({ path: u0.pathname }).replyWithError(new Error("boom"));
    for (const cell of slice.slice(1)) {
      const u = new URL(buildUrl(cell));
      fetchMock.get(u.origin).intercept({ path: u.pathname })
        .reply(200, "ok", { headers: { server: "nginx/1.9.7" } });
    }
    const res = await runSlice(env, 1, 2000);
    const errors = res.changed.filter((c) => c.backend === "error");
    expect(errors.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- checker`
Expected: FAIL ("Cannot find module '../worker/checker'").

- [ ] **Step 3: Write `worker/checker.ts`**

```ts
import type { Cell, CheckRow } from "../shared/types";
import { allCells, buildUrl, partitionSlices } from "../shared/matrix";
import { classify } from "../shared/classify";
import { probe } from "./fetcher";
import { appendAndUpsert, type AppEnv } from "./db";

export function sliceCount(): number {
  return partitionSlices(allCells()).length;
}

export async function runSlice(
  env: AppEnv,
  sliceIndex: number,
  now: number
): Promise<{ changed: CheckRow[] }> {
  const slices = partitionSlices(allCells());
  const slice = slices[sliceIndex] ?? [];

  const settled = await Promise.allSettled(slice.map((cell) => checkCell(cell, now)));
  const rows: CheckRow[] = settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : errorRow(slice[i], now, reason(s))
  );

  return appendAndUpsert(env.DB, rows);
}

async function checkCell(cell: Cell, now: number): Promise<CheckRow> {
  const url = buildUrl(cell);
  const { chain, finalStatus, finalHeaders } = await probe(url);
  const o = classify(finalStatus, finalHeaders, chain);
  return {
    ...cell, url, ts: now,
    http_status: o.finalStatus, backend: o.backend,
    matched_path: o.matched_path, redirect_to: o.redirect_to,
  };
}

function errorRow(cell: Cell, now: number, message: string): CheckRow {
  return {
    ...cell, url: buildUrl(cell), ts: now,
    http_status: null, backend: "error",
    matched_path: message.slice(0, 200), redirect_to: null,
  };
}

function reason(s: PromiseRejectedResult): string {
  return s.reason instanceof Error ? s.reason.message : String(s.reason);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- checker`
Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add worker/checker.ts test/checker.test.ts
git commit -m "feat: runSlice — concurrent probe+classify, fault-tolerant, batched write"
```

---

## Task 6: API routes + Worker entry

**Files:**
- Create: `worker/api.ts`, `worker/index.ts`
- Test: `test/api.test.ts`

- [ ] **Step 1: Write the failing test `test/api.test.ts`**

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { env, fetchMock, SELF } from "cloudflare:test";
import { partitionSlices, allCells, buildUrl } from "../shared/matrix";

beforeAll(() => { fetchMock.activate(); fetchMock.disableNetConnect(); });
afterEach(() => fetchMock.assertNoPendingInterceptors());

describe("api", () => {
  it("POST /api/refresh?slice=0 runs a slice; GET /api/status returns rows", async () => {
    const slice = partitionSlices(allCells())[0];
    for (const cell of slice) {
      const u = new URL(buildUrl(cell));
      fetchMock.get(u.origin).intercept({ path: u.pathname })
        .reply(200, "ok", { headers: { server: "Vercel", "x-vercel-id": "z" } });
    }
    const refresh = await SELF.fetch("https://board/api/refresh?slice=0", { method: "POST" });
    expect(refresh.status).toBe(200);

    const status = await SELF.fetch("https://board/api/status");
    const body = await status.json<{ cells: unknown[] }>();
    expect(body.cells.length).toBe(slice.length);
  });

  it("GET /api/status returns JSON shape even when empty-ish", async () => {
    const res = await SELF.fetch("https://board/api/status");
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- api`
Expected: FAIL ("Cannot find module" / 404 on routes).

- [ ] **Step 3: Write `worker/api.ts`**

```ts
import { Hono } from "hono";
import type { AppEnv } from "./db";
import { getCursor, getHistory, getStatus, setCursor } from "./db";
import { runSlice, sliceCount } from "./checker";
import type { Cell, Concern, Env, HostVariant } from "../shared/types";

export const app = new Hono<{ Bindings: AppEnv }>();

app.get("/api/status", async (c) => {
  const cells = await getStatus(c.env.DB);
  return c.json({ cells, sliceCount: sliceCount() });
});

app.get("/api/history", async (c) => {
  const cell: Cell = {
    env: c.req.query("env") as Env,
    host_variant: c.req.query("host_variant") as HostVariant,
    market: c.req.query("market") ?? "",
    concern: c.req.query("concern") as Concern,
  };
  const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10) || 100, 500);
  const history = await getHistory(c.env.DB, cell, limit);
  return c.json({ history });
});

// Manual refresh: cursor-free — runs exactly the requested slice.
app.post("/api/refresh", async (c) => {
  const slice = parseInt(c.req.query("slice") ?? "", 10);
  if (Number.isNaN(slice) || slice < 0 || slice >= sliceCount()) {
    return c.json({ error: `slice must be 0..${sliceCount() - 1}` }, 400);
  }
  const { changed } = await runSlice(c.env, slice, Math.floor(Date.now() / 1000));
  return c.json({ slice, changed });
});

// Asset fallback: anything not /api/* is served by the static assets (SPA).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

// Exposed for the scheduled() handler in index.ts.
export { getCursor, setCursor, runSlice, sliceCount };
```

- [ ] **Step 4: Write `worker/index.ts`**

```ts
import { app, getCursor, setCursor, runSlice, sliceCount } from "./api";
import type { AppEnv } from "./db";

export default {
  fetch: app.fetch,

  // Cron-owned cursor: each tick processes the next slice, then advances.
  async scheduled(_event: ScheduledController, env: AppEnv, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const n = sliceCount();
        const cursor = (await getCursor(env.DB)) % n;
        await runSlice(env, cursor, Math.floor(Date.now() / 1000));
        await setCursor(env.DB, (cursor + 1) % n);
      })()
    );
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- api`
Expected: PASS (both tests).

- [ ] **Step 6: Typecheck + commit**

```bash
npm run typecheck
git add worker/api.ts worker/index.ts test/api.test.ts
git commit -m "feat: Hono API (status/history/refresh) + scheduled cron entry"
```

---

## Task 7: Web app scaffold (Vite + React + Tailwind + shadcn/ui)

**Files:**
- Create: `web/` (Vite app), Tailwind config, shadcn init, base components.

- [ ] **Step 1: Create the Vite React-TS app**

Run:
```bash
npm create vite@latest web -- --template react-ts
cd web && npm i
```
Expected: `web/` created with React+TS template.

- [ ] **Step 2: Add Tailwind + shadcn deps**

Run (from `web/`):
```bash
npm i -D tailwindcss @tailwindcss/vite
npm i class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 3: Wire Tailwind v4 in `web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { proxy: { "/api": "http://localhost:8787" } }, // wrangler dev port
  build: { outDir: "dist" },
});
```

- [ ] **Step 4: Replace `web/src/index.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 5: Init shadcn and add components**

Run (from `web/`):
```bash
npx shadcn@latest init -d
npx shadcn@latest add table badge tabs button sheet tooltip alert sonner
```
Expected: `web/src/components/ui/*` created; `@/lib/utils` present.

- [ ] **Step 6: Commit**

```bash
cd ..
git add web
git commit -m "chore: scaffold Vite+React+Tailwind+shadcn web app"
```

---

## Task 8: Web API client + shared view types

**Files:**
- Create: `web/src/lib/api.ts`, `web/src/lib/types.ts`
- Test: `web/src/lib/api.test.ts` (uses web vitest project — see Step 1)

- [ ] **Step 1: Add a jsdom Vitest project for web** — create `web/vitest.config.ts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test-setup.ts"] },
});
```

Run (from `web/`): `npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom`
Create `web/src/test-setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Write `web/src/lib/types.ts`**

```ts
export type Backend = "vercel" | "nginx" | "redirect-exp" | "404" | "other" | "error";
export interface CurrentCell {
  env: "qa" | "prod";
  host_variant: "canonical" | "com";
  market: string;
  concern: "main" | "coachlist" | "coachdet" | "eventdet" | "locdet";
  url: string;
  backend: Backend;
  http_status: number | null;
  matched_path: string | null;
  redirect_to: string | null;
  ts: number;
  since_ts: number;
}
export interface HistoryRow extends Omit<CurrentCell, "since_ts"> {}
```

- [ ] **Step 3: Write the failing test `web/src/lib/api.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchStatus } from "./api";

describe("fetchStatus", () => {
  it("returns the cells array", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ cells: [{ market: "US" }], sliceCount: 20 }),
        { headers: { "content-type": "application/json" } })
    ));
    const r = await fetchStatus();
    expect(r.cells[0].market).toBe("US");
    expect(r.sliceCount).toBe(20);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run (from `web/`): `npx vitest run src/lib/api.test.ts`
Expected: FAIL ("Cannot find module './api'").

- [ ] **Step 5: Write `web/src/lib/api.ts`**

```ts
import type { CurrentCell, HistoryRow } from "./types";

export async function fetchStatus(): Promise<{ cells: CurrentCell[]; sliceCount: number }> {
  const r = await fetch("/api/status");
  if (!r.ok) throw new Error(`status ${r.status}`);
  return r.json();
}

export async function fetchHistory(cell: Pick<CurrentCell, "env" | "host_variant" | "market" | "concern">): Promise<HistoryRow[]> {
  const q = new URLSearchParams(cell as Record<string, string>);
  const r = await fetch(`/api/history?${q.toString()}`);
  if (!r.ok) throw new Error(`history ${r.status}`);
  return (await r.json()).history;
}

export async function refreshAll(sliceCount: number): Promise<void> {
  for (let i = 0; i < sliceCount; i++) {
    await fetch(`/api/refresh?slice=${i}`, { method: "POST" });
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run (from `web/`): `npx vitest run src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd ..
git add web/src/lib web/vitest.config.ts web/src/test-setup.ts
git commit -m "feat: web api client + view types"
```

---

## Task 9: Web UI — verdict styling, Grid, Cell, Header, detail Sheet

**Files:**
- Create: `web/src/lib/verdict.ts`, `web/src/components/Cell.tsx`, `web/src/components/Grid.tsx`, `web/src/components/Header.tsx`, `web/src/components/CellDetail.tsx`
- Modify: `web/src/App.tsx`
- Test: `web/src/lib/verdict.test.ts`

- [ ] **Step 1: Write the failing test `web/src/lib/verdict.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { verdict } from "./verdict";

describe("verdict", () => {
  it("maps backends to label + color", () => {
    expect(verdict("vercel").label).toBe("✅ Vercel");
    expect(verdict("nginx").label).toBe("🟧 nginx");
    expect(verdict("redirect-exp").label).toBe("↪️ → experience");
    expect(verdict("404").label).toBe("❌ 404");
    expect(verdict("error").label).toBe("⚠️ error");
    expect(verdict("vercel").className).toContain("bg-");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npx vitest run src/lib/verdict.test.ts`
Expected: FAIL ("Cannot find module './verdict'").

- [ ] **Step 3: Write `web/src/lib/verdict.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `web/`): `npx vitest run src/lib/verdict.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `web/src/components/Cell.tsx`**

```tsx
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
```

- [ ] **Step 6: Write `web/src/components/CellDetail.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { CurrentCell, HistoryRow } from "@/lib/types";
import { fetchHistory } from "@/lib/api";
import { verdict } from "@/lib/verdict";

export function CellDetail({ cell, onClose }: { cell: CurrentCell | null; onClose: () => void }) {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  useEffect(() => {
    if (cell) fetchHistory(cell).then(setHistory).catch(() => setHistory([]));
  }, [cell]);
  return (
    <Sheet open={!!cell} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[420px] sm:max-w-[420px]">
        {cell && (
          <>
            <SheetHeader>
              <SheetTitle>{cell.market} · {cell.concern} · {cell.env}/{cell.host_variant}</SheetTitle>
            </SheetHeader>
            <div className="mt-2 text-xs break-all">{cell.url}</div>
            <ul className="mt-4 space-y-1 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex justify-between border-b py-1">
                  <span>{verdict(h.backend).label} · HTTP {h.http_status ?? "—"}</span>
                  <span className="text-muted-foreground">{new Date(h.ts * 1000).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 7: Write `web/src/components/Header.tsx`**

```tsx
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { refreshAll } from "@/lib/api";
import { useState } from "react";

export function Header({ sliceCount, lastTs, onRefreshed }: { sliceCount: number; lastTs: number | null; onRefreshed: () => void }) {
  const [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    try { await refreshAll(sliceCount); toast.success("Refreshed all slices"); onRefreshed(); }
    catch { toast.error("Refresh failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <h1 className="text-lg font-semibold">Workshops Status Board</h1>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>{lastTs ? `Last data: ${new Date(lastTs * 1000).toLocaleString()}` : "No data yet"}</span>
        <Button onClick={refresh} disabled={busy}>{busy ? "Refreshing…" : "Refresh now"}</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Write `web/src/components/Grid.tsx`**

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cell } from "./Cell";
import type { CurrentCell } from "@/lib/types";

const MARKETS = ["US", "UK", "CA/EN", "CA/FR", "AU", "NZ", "DE", "FR", "BE/FR", "BE/NL", "SE"];
const CONCERNS = ["main", "coachlist", "coachdet", "eventdet", "locdet"] as const;

export function Grid({ cells, onSelect }: { cells: CurrentCell[]; onSelect: (c: CurrentCell) => void }) {
  const byKey = new Map(cells.map((c) => [`${c.market}|${c.concern}`, c]));
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Market</TableHead>
          {CONCERNS.map((c) => <TableHead key={c} className="text-center">{c}</TableHead>)}
        </TableRow>
      </TableHeader>
      <TableBody>
        {MARKETS.map((m) => (
          <TableRow key={m}>
            <TableCell className="font-medium">{m}</TableCell>
            {CONCERNS.map((concern) => {
              const cell = byKey.get(`${m}|${concern}`);
              return <Cell key={concern} cell={cell} onClick={() => cell && onSelect(cell)} />;
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 9: Write `web/src/App.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Header } from "@/components/Header";
import { Grid } from "@/components/Grid";
import { CellDetail } from "@/components/CellDetail";
import { fetchStatus } from "@/lib/api";
import type { CurrentCell } from "@/lib/types";

type VariantKey = "qa/com" | "qa/canonical" | "prod/com" | "prod/canonical";

export default function App() {
  const [cells, setCells] = useState<CurrentCell[]>([]);
  const [sliceCount, setSliceCount] = useState(20);
  const [variant, setVariant] = useState<VariantKey>("qa/com");
  const [selected, setSelected] = useState<CurrentCell | null>(null);

  async function load() {
    const r = await fetchStatus();
    setCells(r.cells);
    setSliceCount(r.sliceCount);
  }
  useEffect(() => { load(); }, []);

  const [env, host_variant] = variant.split("/") as ["qa" | "prod", "canonical" | "com"];
  const filtered = useMemo(
    () => cells.filter((c) => c.env === env && c.host_variant === host_variant),
    [cells, env, host_variant]
  );
  const lastTs = cells.length ? Math.max(...cells.map((c) => c.ts)) : null;

  return (
    <TooltipProvider>
      <Header sliceCount={sliceCount} lastTs={lastTs} onRefreshed={load} />
      <div className="p-4">
        <Tabs value={variant} onValueChange={(v) => setVariant(v as VariantKey)}>
          <TabsList>
            <TabsTrigger value="qa/com">QA · .com</TabsTrigger>
            <TabsTrigger value="qa/canonical">QA · canonical</TabsTrigger>
            <TabsTrigger value="prod/com">Prod · .com</TabsTrigger>
            <TabsTrigger value="prod/canonical">Prod · canonical</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="mt-4"><Grid cells={filtered} onSelect={setSelected} /></div>
        <p className="mt-4 text-xs text-muted-foreground">NL, CH/DE, CH/FR are Core-only (no workshops) — not tracked.</p>
      </div>
      <CellDetail cell={selected} onClose={() => setSelected(null)} />
      <Toaster />
    </TooltipProvider>
  );
}
```

- [ ] **Step 10: Run web tests + build**

Run (from `web/`): `npx vitest run && npm run build`
Expected: tests PASS; `web/dist/` produced.

- [ ] **Step 11: Commit**

```bash
cd ..
git add web/src
git commit -m "feat: dashboard UI — grid, cell, detail sheet, refresh header, variant tabs"
```

---

## Task 10: Local integration + seed/dry-run

**Files:**
- Create: `scripts/dry-run.ts` (Node, no D1 — prints live verdicts for one slice)
- Modify: root `package.json` scripts

- [ ] **Step 1: Write `scripts/dry-run.ts`**

```ts
import { allCells, buildUrl, partitionSlices } from "../shared/matrix";
import { classify } from "../shared/classify";
import { probe } from "../worker/fetcher";

const sliceIdx = parseInt(process.argv[2] ?? "0", 10);
const slice = partitionSlices(allCells())[sliceIdx] ?? [];

const results = await Promise.allSettled(
  slice.map(async (cell) => {
    const { chain, finalStatus, finalHeaders } = await probe(buildUrl(cell));
    const o = classify(finalStatus, finalHeaders, chain);
    return `${cell.env}/${cell.host_variant} ${cell.market} ${cell.concern} -> ${o.backend} (${o.finalStatus})`;
  })
);
for (const r of results) console.log(r.status === "fulfilled" ? r.value : `ERROR ${r.reason}`);
```

- [ ] **Step 2: Add scripts to root `package.json`**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:web": "cd web && vitest run",
    "dev:api": "wrangler dev",
    "dev:web": "cd web && npm run dev",
    "build:web": "cd web && npm run build",
    "migrate:local": "wrangler d1 migrations apply workshops_board --local",
    "dry-run": "node --experimental-strip-types scripts/dry-run.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 3: Run the full test suite (worker) and dry-run**

Run:
```bash
npm test
npm run dry-run 0
```
Expected: worker tests PASS; dry-run prints ~10 live verdicts (real network).

- [ ] **Step 4: Manual local smoke (documented, optional)**

Run:
```bash
npm run build:web
npm run migrate:local
npm run dev:api    # serves SPA + /api on http://localhost:8787
```
Open `http://localhost:8787`, click **Refresh now**, confirm the grid populates. (Cron does not fire in local `dev` unless `--test-scheduled`; trigger via `curl "http://localhost:8787/__scheduled"` if testing the cron path with `wrangler dev --test-scheduled`.)

- [ ] **Step 5: Commit**

```bash
git add scripts/dry-run.ts package.json
git commit -m "chore: dry-run script + local dev scripts"
```

---

## Notes for the implementer
- **Do not** run `wrangler deploy`, create the remote D1, or wire CI — deployment is the user's. The `database_id` placeholder in `wrangler.toml` is fine for local (`--local`) dev and tests.
- `@cloudflare/vitest-pool-workers` applies `migrations/*.sql` to the test D1 automatically via the `[[migrations]]`/migrations dir; if a test errors with "no such table", confirm the migration ran (the pool reads `wrangler.toml`).
- Keep slices ≤10 cells: if a future change adds markets/concerns, `partitionSlices` keeps each invocation under the 50-subrequest / 10ms-CPU budget; re-check after changes.
