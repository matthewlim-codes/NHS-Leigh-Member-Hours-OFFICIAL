# NHS (Leigh) Member Hour Tracker

A private member portal for an NHS-style community club. Members log in to see their volunteer hours pulled live from a Google Sheet.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/member-portal run dev` — run the frontend (port 25958)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run cleanup:stale-members:dry-run` — list DB accounts that are no longer in the current Google Sheet
- `pnpm --filter @workspace/api-server run cleanup:stale-members` — delete DB accounts that are no longer in the current Google Sheet
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — secret for express-session
- Optional env: `GOOGLE_SHEET_ID` — replace the default member-hours Google Sheet without code changes
- Optional env: `MEMBER_SHEET_TABS` — comma-separated member data tabs, defaults to `11/12,10`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind, shadcn/ui, wouter, TanStack Query)
- API: Express 5 + express-session + connect-pg-simple
- DB: PostgreSQL + Drizzle ORM
- Auth: bcryptjs password hashing, server-side sessions in PostgreSQL
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Google Sheets: @replit/connectors-sdk (Replit-managed OAuth)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/members.ts` — members table schema
- `artifacts/api-server/src/routes/auth.ts` — login, logout, me
- `artifacts/api-server/src/routes/dashboard.ts` — member dashboard data, goals, and remaining-hour calculations
- `artifacts/api-server/src/lib/sheets.ts` — Google Sheets helper + username/password generation
- `artifacts/member-portal/src/pages/` — login and dashboard pages

## Architecture decisions

- **Auto-provisioning accounts**: Members are not pre-seeded. On login, the app verifies the password against the member's current `STUDENT ID` from Google Sheets, then creates the account in the DB if it does not already exist.
- **Google Sheets as source of truth**: Hours and display names are always fetched fresh from the sheet, never cached in the DB.
- **Session storage in PostgreSQL**: Uses connect-pg-simple so sessions survive server restarts.
- **Username format**: `First-Last` (for sheet names stored as `Last, First`, e.g. `Lim, Matthew` → `Matthew-Lim`).
- **Password format**: the member's `STUDENT ID` value from the sheet. Members do not change this password in the app.

## Product

Members visit the portal, enter their username (e.g. `Matthew-Lim`) and their Student ID as their password. They then see their name, form/dues status, annual and semester hour progress, and a month-by-month HW Center/Tutorial breakdown from the Google Sheet. The sheet owner updates hours in Google Sheets and members see the latest data on their next visit.

## Replacing the Google Sheet

To switch to a newly uploaded/copied Google Sheet, authorize the Replit `google-sheet` integration for that sheet, then set:

- `GOOGLE_SHEET_ID` to the sheet ID from the URL (`https://docs.google.com/spreadsheets/d/<GOOGLE_SHEET_ID>/edit`)
- `MEMBER_SHEET_TABS` to the comma-separated tabs containing member rows, for example `11/12,10`

The sheet parser scans the first few rows for headers, so the tabs should include `STUDENT ID`, `NAME`, and `TOTAL HOURS`. Optional columns include `GRADE`, `INFO FORM`, `CLUB DUES`, `SEM 1 HOURS`, and monthly HW Center/Tutorial pairs.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always run `pnpm run typecheck:libs` before `pnpm --filter @workspace/api-server run typecheck` after changing `lib/db` schema — the composite lib must be rebuilt first.
- The Google Sheets integration uses Replit's connector proxy (`@replit/connectors-sdk`). If it returns errors, the connection may need to be re-authorized via the integrations panel.
- The spreadsheet ID and member data tabs can be replaced with `GOOGLE_SHEET_ID` and `MEMBER_SHEET_TABS`. The current default reads the `11/12` and `10` tabs, finds columns by header across the first few header rows, and expects `STUDENT ID`, `NAME`, and `TOTAL HOURS` columns.
- Hour goals are calculated in `artifacts/api-server/src/routes/dashboard.ts`: grade 10 requires 7 annual hours; grades 11/12 require 20 annual hours, split as 9 semester 1 hours and 11 semester 2 hours.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
