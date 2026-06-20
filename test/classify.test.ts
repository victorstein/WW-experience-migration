import { describe, it, expect } from "vitest";
import { classify } from "../shared/classify";
import type { Hop } from "../shared/types";

const H = (o: Record<string, string>) => o;
const NOCHAIN: Hop[] = [];

describe("classify", () => {
  it("vercel: 200 with x-vercel-id", () => {
    const r = classify(200, H({ server: "Vercel", "x-vercel-id": "iad1::abc" }), NOCHAIN);
    expect(r.backend).toBe("vercel");
    expect(r.vercel_id).toBe("iad1::abc"); // discriminator captured for debugging
  });

  it("other: 200 behind cloudflare with no x-vercel-id => records absence", () => {
    const r = classify(200, H({ server: "cloudflare", via: "1.1 vegur" }), NOCHAIN);
    expect(r.backend).toBe("other");
    expect(r.vercel_id).toBeNull(); // the very reason it's `other`
    expect(r.via).toBe("1.1 vegur");
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
