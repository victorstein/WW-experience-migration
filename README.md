# WW-experience-migration
Dashboard + cron checker tracking QA/prod redirect &amp; backend health across markets during the WW experience migration

## Implementation
- **Spec:** [`docs/superpowers/specs/2026-06-19-workshops-status-board-design.md`](docs/superpowers/specs/2026-06-19-workshops-status-board-design.md)
- **Plan:** [`docs/superpowers/plans/2026-06-19-workshops-status-board.md`](docs/superpowers/plans/2026-06-19-workshops-status-board.md) — 10 TDD tasks with full code; build with `superpowers:subagent-driven-development` (or `executing-plans`).

**Stack:** Cloudflare Worker + Static Assets (Hono) · D1 (SQLite) · Vite + React + Tailwind + shadcn/ui.

## CI / Deployment
- **`.github/workflows/ci.yml`** — on every PR: worker test suite, typecheck, web test suite, web build.
- **`.github/workflows/deploy.yml`** — on push to `main`: re-runs the test/build gate, builds `web/dist`, applies D1 migrations (`wrangler d1 migrations apply --remote`), and `wrangler deploy`s the Worker + static assets.

Credentials (`CLOUDFLARE_API_TOKEN` secret, `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_D1_DATABASE_ID` variables) are managed and injected by [`victorstein/stein-infra`](https://github.com/victorstein/stein-infra) — no manual secret wiring in this repo. The committed `wrangler.toml` keeps `database_id = "local-placeholder-id"` for local dev/tests; deploy.yml substitutes the real remote D1 id at deploy time.

A custom domain is not wired (the Worker serves on its `*.workers.dev` route); adding one is a follow-up in stein-infra + `wrangler.toml`.
