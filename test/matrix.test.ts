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
