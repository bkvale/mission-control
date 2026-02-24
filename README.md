# Mission Control v1

A practical OpenClaw dashboard for:
- Ops status (gateway/channel quick checks)
- Cron job visibility
- X/Twitter URL ingestion using the OpenClaw-managed browser profile

## Run

```bash
cd mission-control
npm install
npm run dev
```

Open http://localhost:3000

## What this v1 does

- Calls `openclaw status --json` from `/api/status`
- Calls `openclaw cron list --json` from `/api/cron`
- Reads X URLs from `/api/x/extract` by running:
  - `openclaw browser open <url> --browser-profile openclaw --json`
  - `openclaw browser evaluate --browser-profile openclaw --target-id <id> --fn ... --json`

## Notes

- Requires OpenClaw CLI installed and available on PATH.
- Uses local machine credentials/session, so run on your OpenClaw host.
- X extraction reliability depends on browser/session accessibility and page visibility.

## Next steps (v2)

- Task board + assignment status
- Cron run history and "run now" buttons
- Memory explorer/search UI
- Save extracted tweet summaries to memory files
