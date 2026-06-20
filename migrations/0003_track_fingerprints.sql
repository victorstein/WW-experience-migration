-- `Server` alone doesn't discriminate `other`: Cloudflare rewrites it to
-- "cloudflare" for every cell. Capture the headers that actually fingerprint the
-- origin — x-vercel-id (the migrated app), plus via and x-served-by — so an
-- `other` verdict is explainable from stored data instead of needing a live probe.
ALTER TABLE checks ADD COLUMN via TEXT;
ALTER TABLE checks ADD COLUMN served_by TEXT;
ALTER TABLE checks ADD COLUMN vercel_id TEXT;
ALTER TABLE current ADD COLUMN via TEXT;
ALTER TABLE current ADD COLUMN served_by TEXT;
ALTER TABLE current ADD COLUMN vercel_id TEXT;
