import { describe, it, expect } from "vitest";
import { slicePlan, sliceCount } from "../worker/checker";

describe("slicePlan", () => {
  it("has one entry per slice, each mapping to exactly one market", () => {
    const plan = slicePlan();
    expect(plan.length).toBe(sliceCount());
    expect(plan.length).toBe(20);
    // Markets are 10- or 20-cell and slices are 10, so every slice is one country.
    expect(plan.every((markets) => markets.length === 1)).toBe(true);
  });

  it("maps the expected market ranges (US/NZ = 1 slice, others = 2)", () => {
    const plan = slicePlan();
    expect(plan[0]).toEqual(["US"]);    // 10 cells -> slice 0
    expect(plan[1]).toEqual(["UK"]);    // 20 cells -> slices 1,2
    expect(plan[2]).toEqual(["UK"]);
    expect(plan[9]).toEqual(["NZ"]);    // 10 cells -> slice 9
    expect(plan[19]).toEqual(["SE"]);   // 20 cells -> slices 18,19
  });
});
