-- Persist the response `Server` header so an `other` verdict is debuggable:
-- it's the backend fingerprint we classify on, and the one piece that tells us
-- "alive, but which stack?" for the cells that match neither Vercel nor nginx.
ALTER TABLE checks ADD COLUMN server TEXT;
ALTER TABLE current ADD COLUMN server TEXT;
