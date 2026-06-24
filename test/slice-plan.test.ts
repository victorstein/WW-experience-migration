import { describe, it, expect } from "vitest";
import { slicePlan, sliceCount } from "../worker/checker";

describe("slicePlan", () => {
  it("has one entry per slice (49: market-aligned balanced slices)", () => {
    const plan = slicePlan();
    expect(plan.length).toBe(sliceCount());
    expect(plan.length).toBe(49);
  });

  it("every slice belongs to exactly one market; union is all 17 markets", () => {
    const plan = slicePlan();
    expect(plan.every((m) => m.length === 1)).toBe(true);
    expect(new Set(plan.flat())).toEqual(
      new Set([
        "US", "UK", "CA/EN", "CA/FR", "CA/FR (EN Slug)", "AU", "NZ",
        "DE", "DE (EN Slug)", "FR", "FR (EN Slug)", "BE/FR", "BE/FR (EN Slug)",
        "BE/NL", "BE/NL (EN Slug)", "SE", "SE (EN Slug)",
      ])
    );
  });

  it("US (12 cells) maps to 2 slices, UK (24 cells) to 3", () => {
    const plan = slicePlan();
    expect(plan.filter((m) => m[0] === "US").length).toBe(2);
    expect(plan.filter((m) => m[0] === "UK").length).toBe(3);
    expect(plan[0]).toEqual(["US"]);
  });
});
