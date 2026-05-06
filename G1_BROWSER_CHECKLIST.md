# G1 Browser Test Checklist

**Status:** Concluído — 2026-05-06  
**Evidência:** submissão pela UI OK; nova versão e ledger coerentes; RBAC bloqueou perfil sem permissão; `npm run test:g1:markdown-flow`, `lint` e smoke OK.

Use this list to validate the full G.1 flow in browser.

## 1) Start interface

- [x] Run `npm run start:browser-ui` in `hub-preop`.
- [x] Confirm browser opens at `http://localhost:3000`.
- [x] Confirm app home page loads without server errors.

## 2) Login and permissions

- [x] Login with `admin` or `registrar`.
- [x] Access `/instruments/[id]/edit` for a test instrument.
- [x] Confirm edit page is accessible for authorized user.

## 3) Positive edit/submit flow

- [x] Paste valid markdown content in edit page.
- [x] Submit content.
- [x] Confirm success response/message.
- [x] Confirm instrument shows updated content/version.

## 4) Ledger coherence

- [x] Open `/api/instruments/[id]/ledger`.
- [x] Confirm a new ledger entry was added after submission.
- [x] Confirm latest entry sequence is coherent (no jump/backtrack).

## 5) Negative authorization test

- [x] Login with user without append permission.
- [x] Try to access edit page or submit content.
- [x] Confirm request is blocked (401/403 or equivalent).

## 6) Markdown validation checks (local CLI)

- [x] Run `npm run test:g1:markdown-flow`.
- [x] Confirm expected pass/fail summary is printed.

## 7) Regression smoke

- [x] Run `npm run lint`.
- [x] Run `npm run test:no-db` (or `npm test` if DB-ready suite is required).
- [x] Confirm no unexpected regressions.

## Done criteria

- [x] Authorized user can submit content from browser.
- [x] Unauthorized user is blocked.
- [x] Ledger remains coherent after submit.
- [x] Local markdown test flow and smoke checks pass.
