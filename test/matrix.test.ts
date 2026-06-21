import { describe, it, expect } from "vitest";
import { allCells, buildUrl, partitionSlices, SLICE_MAX, workshopRouteToken } from "../shared/matrix";

describe("matrix", () => {
  it("produces exactly 240 cells (6 concerns; US/NZ canonical skipped)", () => {
    expect(allCells().length).toBe(240);
  });

  it("builds the gateway URL at /<locale>/workshops (not under the finder base)", () => {
    expect(buildUrl({ env: "prod", host_variant: "com", market: "US", concern: "gateway" })).toBe(
      "https://www.weightwatchers.com/us/workshops"
    );
    expect(buildUrl({ env: "qa", host_variant: "canonical", market: "CA/FR", concern: "gateway" })).toBe(
      "https://www.qat2.fr.weightwatchers.ca/ca/fr/workshops"
    );
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

  it("maps each concern to the expected Vercel route token", () => {
    expect(workshopRouteToken("gateway")).toBe("workshops");
    expect(workshopRouteToken("main")).toBe("find-a-workshop");
    expect(workshopRouteToken("coachlist")).toBe("find-a-workshop");
    expect(workshopRouteToken("locdet")).toBe("find-a-workshop");
  });

  it("builds CA/FR coach-list URL with the /parcourir-ww-coachs slug", () => {
    const url = buildUrl({ env: "qa", host_variant: "com", market: "CA/FR", concern: "coachlist" });
    expect(url).toBe("https://www.qat2.weightwatchers.com/ca/fr/trouver-un-atelier/parcourir-ww-coachs");
  });

  it("builds CA/FR canonical event URL with the French 'virtuel' segment", () => {
    const url = buildUrl({ env: "qa", host_variant: "canonical", market: "CA/FR", concern: "eventdet" });
    expect(url).toBe("https://www.qat2.fr.weightwatchers.ca/ca/fr/trouver-un-atelier/virtuel/25550661");
  });

  it("keeps the default 'virtual' event segment for non-French markets", () => {
    const url = buildUrl({ env: "qa", host_variant: "com", market: "US", concern: "eventdet" });
    expect(url).toBe("https://www.qat2.weightwatchers.com/us/find-a-workshop/virtual/25550661");
  });

  it("builds BE/NL coach URL with the Dutch coach slug on the workshop (target) base", () => {
    // vind-een-workshop is the migration TARGET (we track it as not-migrated until
    // it goes live); vind-een-ervaring is the old finder we're moving away from.
    const url = buildUrl({ env: "qa", host_variant: "com", market: "BE/NL", concern: "coachlist" });
    expect(url).toBe("https://www.qat2.weightwatchers.com/be/nl/vind-een-workshop/bekijk-ww-coaches");
  });

  it("partitions into balanced, market-aligned slices of at most SLICE_MAX", () => {
    const slices = partitionSlices(allCells());
    expect(slices.every((s) => s.length <= SLICE_MAX)).toBe(true);
    expect(slices.flat().length).toBe(240);
    // No slice straddles two markets.
    expect(slices.every((s) => new Set(s.map((c) => c.market)).size === 1)).toBe(true);
    // Balanced within a market: 12-cell markets (US/NZ) split 6+6, not 10+2.
    const usSlices = slices.filter((s) => s[0].market === "US");
    expect(usSlices.map((s) => s.length)).toEqual([6, 6]);
  });
});
