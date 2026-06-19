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
