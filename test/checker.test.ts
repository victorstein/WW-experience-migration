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
