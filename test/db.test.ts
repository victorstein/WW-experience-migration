import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { appendAndUpsert, getStatus, getHistory, getCursor, setCursor } from "../worker/db";
import type { CheckRow } from "../shared/types";

const row = (backend: string, ts: number): CheckRow => ({
  env: "qa", host_variant: "com", market: "US", concern: "main",
  url: "https://x/us/find-a-workshop", http_status: 200, backend: backend as any,
  matched_path: null, redirect_to: null, server: `srv-${backend}`, ts,
});

describe("db", () => {
  it("appends history and upserts current; since_ts holds until backend changes", async () => {
    const db = env.DB;
    await appendAndUpsert(db, [row("nginx", 100)]);
    await appendAndUpsert(db, [row("nginx", 200)]);
    let cur = await getStatus(db);
    expect(cur.length).toBe(1);
    expect(cur[0].backend).toBe("nginx");
    expect(cur[0].server).toBe("srv-nginx"); // response Server header persisted
    expect(cur[0].since_ts).toBe(100); // unchanged backend keeps since_ts
    expect(cur[0].first_ts).toBe(100); // first-tracked ts
    expect(cur[0].since_ts).toBe(cur[0].first_ts); // => "no changes since tracked"

    const res = await appendAndUpsert(db, [row("vercel", 300)]);
    expect(res.changed.map((c) => c.market)).toContain("US");
    cur = await getStatus(db);
    expect(cur[0].backend).toBe("vercel");
    expect(cur[0].server).toBe("srv-vercel"); // server updates on flip
    expect(cur[0].since_ts).toBe(300); // flipped -> since_ts advances
    expect(cur[0].first_ts).toBe(100); // first_ts never moves
    expect(cur[0].since_ts).not.toBe(cur[0].first_ts); // => a real flip

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
