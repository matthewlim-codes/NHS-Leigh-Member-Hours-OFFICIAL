# Leigh NHS Hours

A portal and dashboard for NHS members to track tutoring hours throughout the year, replacing a manual record-keeping process and giving members direct access to their records.

## Live Demo
[Visit the app](https://leighnhshours.replit.app/)

## What it does
This web app gives NHS members a simple way to:
- View their tutoring hours.
- Track progress throughout the year.
- Access their own records without needing requesting updates from officers.
- Reduce confusion from spreadsheet-based tracking.

## Features
- Member dashboard.
- Tutoring hour tracking.
- Year-round record view.
- Cleaner alternative to manual tracking.
- Simple, easy-to-use interface.

## Screenshots
<img width="1138" height="788" alt="Screenshot 2026-07-08 163649" src="https://github.com/user-attachments/assets/d16b56c2-beef-4da6-9a38-84f47f45d4cc" />
<img width="1128" height="857" alt="Screenshot 2026-07-08 163642" src="https://github.com/user-attachments/assets/0d80386f-fb68-4ae5-9ebd-00657f68a3cc" />
<img width="530" height="777" alt="Screenshot 2026-07-08 163624" src="https://github.com/user-attachments/assets/5a418121-b774-446e-bbe5-1e802e84198b" />

## Tech Stack
- Development: Replit, Cursor
- Frontend: React, HTML, CSS
- Styling: Tailwind CSS
- Build tool: Vite

## Setup
```bash
pnpm install
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/member-portal run dev
```

To replace the Google Sheet later, copy/upload the new sheet, authorize it with the Replit Google Sheets integration, then set `GOOGLE_SHEET_ID` and update `MEMBER_SHEET_TABS` if the tab names differ.

## Why I built this
NHS hour tracking was previously handled manually, which made it harder for members to check progress or access records. This app centralizes that process into one accessible portal.
