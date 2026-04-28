# Hub pre-operational — Phase 2 prototype

Next.js (App Router) + PostgreSQL + Prisma. Instrument **stubs** only; Core Registry / `idr:ref` / full state machine are **out of scope** until Phase 3.

## Quick start

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Start PostgreSQL (e.g. `docker compose up -d` in this directory).
3. `npm install` then `npx prisma migrate deploy` (or `prisma migrate dev` for local iteration).
4. `npm run dev` — open [http://localhost:3000](http://localhost:3000).

Formal bilingual setup and gate steps: **`AlblumZ deeds/IDR/02_Documentos/HUB_PREOP/Fase2_Tech_Setup_and_Runbook.md`** (authoritative runbook).

## Scripts

| Script            | Purpose                                                |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Next.js dev server (Turbopack)                         |
| `npm run build`   | Production build                                       |
| `npm run lint`    | ESLint                                                 |
| `npm run format`  | Prettier                                               |
| `npm test`        | Smoke tests (includes DB query unless `SKIP_DB=1`)   |
| `npm run test:no-db` | Validation-only smoke (`SKIP_DB=1`)               |

## API

- `GET /api/health` — JSON `{ ok, db }` after DB ping.
- `GET|POST /api/instrument-stubs` — list / create stubs (JSON body validated with Zod).
- `GET /api/instrument-stubs/[id]` — fetch one stub.

Authentication is intentionally minimal for this phase; do not expose this prototype publicly without hardening.
