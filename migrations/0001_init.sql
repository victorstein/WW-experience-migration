CREATE TABLE checks (
  id           INTEGER PRIMARY KEY,
  ts           INTEGER NOT NULL,
  env          TEXT NOT NULL,
  host_variant TEXT NOT NULL,
  market       TEXT NOT NULL,
  concern      TEXT NOT NULL,
  url          TEXT NOT NULL,
  http_status  INTEGER,
  backend      TEXT,
  matched_path TEXT,
  redirect_to  TEXT
);
CREATE INDEX idx_cell ON checks (env, host_variant, market, concern, ts);

CREATE TABLE current (
  env TEXT, host_variant TEXT, market TEXT, concern TEXT,
  url TEXT, backend TEXT, http_status INTEGER,
  matched_path TEXT, redirect_to TEXT,
  ts INTEGER, since_ts INTEGER,
  first_ts INTEGER,   -- ts of the very first check for this cell; never updated
  PRIMARY KEY (env, host_variant, market, concern)
);

CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
