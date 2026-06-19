# WW-experience-migration
Dashboard + cron checker tracking QA/prod redirect &amp; backend health across markets during the WW experience migration

## Implementation
- **Spec:** [`docs/superpowers/specs/2026-06-19-workshops-status-board-design.md`](docs/superpowers/specs/2026-06-19-workshops-status-board-design.md)
- **Plan:** [`docs/superpowers/plans/2026-06-19-workshops-status-board.md`](docs/superpowers/plans/2026-06-19-workshops-status-board.md) — 10 TDD tasks with full code; build with `superpowers:subagent-driven-development` (or `executing-plans`).

**Stack:** Cloudflare Worker + Static Assets (Hono) · D1 (SQLite) · Vite + React + Tailwind + shadcn/ui. **Deployment is out of scope** (no deploy/CI wired; `wrangler.toml` is local-dev/deploy-ready).
