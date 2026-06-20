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
