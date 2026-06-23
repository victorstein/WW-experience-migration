export const VARIANT_KEYS = ["qa/com", "qa/canonical", "prod/com", "prod/canonical"] as const;

export type VariantKey = (typeof VARIANT_KEYS)[number];

export const DEFAULT_VARIANT: VariantKey = "qa/com";

function isVariantKey(value: string | null): value is VariantKey {
  return value !== null && (VARIANT_KEYS as readonly string[]).includes(value);
}

// Reads the `tab` query param; returns a known variant key or the default.
export function parseTabParam(search: string): VariantKey {
  const tab = new URLSearchParams(search).get("tab");
  return isVariantKey(tab) ? tab : DEFAULT_VARIANT;
}
