export const VARIANT_KEYS = ["qa/com", "qa/canonical", "prod/com", "prod/canonical"] as const;

export type VariantKey = (typeof VARIANT_KEYS)[number];

export const DEFAULT_VARIANT: VariantKey = "qa/com";

function isVariantKey(value: string | null): value is VariantKey {
  return value !== null && (VARIANT_KEYS as readonly string[]).includes(value);
}

// Reads the `tab` query param and returns it only if it is a known variant key,
// otherwise the default. URLSearchParams.get decodes a %2F-encoded slash, so both
// `?tab=prod/com` and `?tab=prod%2Fcom` resolve.
export function parseTabParam(search: string): VariantKey {
  const tab = new URLSearchParams(search).get("tab");
  return isVariantKey(tab) ? tab : DEFAULT_VARIANT;
}
