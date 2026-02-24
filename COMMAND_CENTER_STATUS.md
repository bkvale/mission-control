# Command Center Dashboard — Status & Capture

## Current Snapshot (2026-02-24)

### Confirmed
- Project folder exists at `workspace/mission-control`.
- Next.js app scaffold and API routes are present.
- README defines v1 scope:
  - `/api/status` → `openclaw status --json`
  - `/api/cron` → `openclaw cron list --json`
  - `/api/x/extract` → browser open/evaluate flow

### Risks / Likely Pain Points
- CLI JSON parsing can break if command emits banner/noise.
- Browser/X extraction reliability depends on active OpenClaw browser session state.
- No explicit health panel for gateway pairing/auth edge cases.

## Polish Plan

1. **Stability pass**
   - Harden API wrappers for noisy CLI output + non-zero exits.
   - Add clear error objects (`code`, `step`, `rawSnippet`).
2. **Operator UX pass**
   - Dashboard cards for Gateway, Telegram, Browser session state.
   - Fast actions: status refresh, cron refresh, test X URL.
3. **Recovery pass**
   - Add guided fixes in UI (e.g., pairing required, browser unavailable).
4. **Ship pass**
   - One command runbook and smoke test checklist.

## Git Capture
- Keep work in git with small, reviewable commits.
- Branch suggested: `mission-control-polish`.

## Definition of Done (this round)
- Dashboard loads consistently.
- API errors are actionable (not generic 500s).
- X extraction path has deterministic fallback messaging.
- Quick runbook exists for restart/repair steps.
