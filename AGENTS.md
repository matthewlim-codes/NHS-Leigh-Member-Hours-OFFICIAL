# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

NHS (Leigh) Member Hour Tracker — pnpm monorepo with Express API (`artifacts/api-server`), React/Vite member portal (`artifacts/member-portal`), and optional mockup sandbox. Primary docs: `replit.md`.

### Node.js version

The repo targets **Node.js 24** (see `.replit`). Cloud VMs may default to `/exec-daemon/node` (Node 22). Before any `pnpm` command:

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
# Or: source ~/.nvm/nvm.sh && nvm install 24 && nvm use 24
# then ensure nvm's bin dir precedes /exec-daemon on PATH
node -v   # should print v24.x
```

Use **pnpm only** (`package.json` `preinstall` rejects npm/yarn).

### PostgreSQL (local / Cloud Agent)

There is no Docker Compose in-repo. Provision Postgres yourself (e.g. `apt install postgresql`, `sudo service postgresql start`).

Example local credentials used in Cloud setup:

- `DATABASE_URL=postgresql://nhs_dev:nhs_dev@localhost:5432/nhs_tracker`
- Apply schema after install: `DATABASE_URL=... pnpm --filter @workspace/db run push`

Also required for the API: `SESSION_SECRET` (any non-empty dev string).
Optional Google Sheet overrides: `GOOGLE_SHEET_ID` and `MEMBER_SHEET_TABS` (comma-separated, defaults to `11/12,10`).

### Running services locally

Replit routes `/api` to the API artifact and `/` to the portal. **Locally there is no Vite proxy** — run both processes and use a reverse proxy (Caddy/nginx) on one port, or call the API on port 8080 directly.

| Service | Command | Env |
|--------|---------|-----|
| API | `pnpm --filter @workspace/api-server run dev` | `PORT=8080`, `DATABASE_URL`, `SESSION_SECRET` |
| Portal | `pnpm --filter @workspace/member-portal run dev` | `PORT=25958`, `BASE_PATH=/` |
| Dev proxy (example) | `caddy run --config /tmp/Caddyfile` | `:5000` → `/api/*` → `127.0.0.1:8080`, else → `127.0.0.1:25958` |

Health check: `GET /api/healthz` → `{"status":"ok"}`.

### Google Sheets / login (Replit-only)

Member login validates against Google Sheets via `@replit/connectors-sdk` (`artifacts/api-server/src/lib/sheets.ts`). Outside a Replit environment (no `REPL_IDENTITY` / connector token), login returns **500** from the API and the UI shows a generic sign-in error. Full authenticated E2E (login → dashboard) requires Replit with the `google-sheet` integration authorized, or running on Replit and using Desktop-pane login there.

To replace the source sheet later, upload/copy the new Google Sheet, authorize it with the Replit `google-sheet` integration, set `GOOGLE_SHEET_ID` to the ID from the URL, and update `MEMBER_SHEET_TABS` if the tab names differ.

### Lint / test / build

- **Typecheck:** `pnpm run typecheck` (run `pnpm run typecheck:libs` first after `lib/db` schema changes).
- **Build:** `pnpm run build` fails for Vite packages without `PORT` and `BASE_PATH`. For targeted builds:
  - `pnpm --filter @workspace/api-server run build`
  - `PORT=25958 BASE_PATH=/ pnpm --filter @workspace/member-portal run build`
- **Tests:** No automated test suite in the repo at present.

### Post-merge hook

`.replit` `[postMerge]` runs `scripts/post-merge.sh` (`pnpm install --frozen-lockfile` + `pnpm --filter db push`). Cloud update script intentionally only runs `pnpm install` (see VM update script); run `db push` manually when schema changes.
