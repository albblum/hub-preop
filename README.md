# Hub pre-operational — Phase 2 prototype

Next.js (App Router) + PostgreSQL + Prisma. Instrument **stubs** only; Core Registry / `idr:ref` / full state machine are **out of scope** until Phase 3.

**Related repo:** public landing (v0) lives in a separate GitHub project — [albblum/v0-idr-landing-page](https://github.com/albblum/v0-idr-landing-page). See [docs/ECOSYSTEM-REPOS.md](./docs/ECOSYSTEM-REPOS.md) for the full ecosystem map.

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
| `npm run backfill:ledger` | Idempotent backfill of `LedgerEntry` for DBs that predate Passo B |
| `npm run validate:markdown` | Local pre-submit checks for `.md` files |
| `npm run submit:content` | Submit markdown to `POST /api/instruments/[id]/content` |

## G.1 Git/scripts (pre-submit)

Git workspace is pre-work only. Official content history remains the API + ledger flow (`appendInstrumentVersion`), per ADR 0007.

Prerequisites:
- authenticated Hub session cookie for a role allowed by `canAppendContent` (`admin` or `registrar`);
- running Hub API endpoint (local `npm run dev` or deployed base URL);
- target instrument id and markdown file path.

Validate markdown locally:
- `npm run validate:markdown -- --file ./tmp/content.md`
- Optional threshold: `npm run validate:markdown -- --file ./tmp/content.md --min-chars 50`

Submit content through official API:
- `npm run submit:content -- --base-url http://localhost:3000 --instrument-id <instrument-id> --file ./tmp/content.md --cookie "next-auth.session-token=<value>" --revision-note "G.1 pre-submit update"`
- The script sends `{ content, revisionNote }` to `POST /api/instruments/[id]/content` and prints HTTP success/error output.

Fallback authenticated curl:
- `curl -i -X POST "http://localhost:3000/api/instruments/<instrument-id>/content" -H "Content-Type: application/json" -H "Cookie: next-auth.session-token=<value>" --data-binary @- <<'JSON'`
- `{"content":"# Draft\n\nTexto de exemplo.","revisionNote":"manual curl fallback"}`
- `JSON`

## G.3 — Agent validate (stub, DocHUB §8)

Rota autenticada para **checklist de conformidade operacional** sobre um rascunho em Markdown. **Não** grava texto oficial, **não** altera o ledger e **não** envia dados a fornecedores LLM externos neste MVP (apenas regras determinísticas locais). Não substitui validação jurídica nem acto humano.

- **URL:** `POST /api/agent/validate`
- **Quem pode:** mesmas roles que `canAppendContent` (`admin` ou `registrar`), com cookie de sessão como nas outras rotas internas.
- **Corpo (JSON):** `content` obrigatório (string não vazia após trim); `idrRef` e `instrumentId` opcionais (contexto futuro; resposta é a mesma checklist genérica se omitidos).

Exemplo:

```json
{
  "content": "# Rascunho\n\nTexto...",
  "idrRef": "idr:opcional",
  "instrumentId": "opcional-cuid"
}
```

Exemplo de resposta (campos mínimos):

```json
{
  "ok": true,
  "mode": "stub",
  "summary": "Checklist automático: todas as verificações passaram.",
  "checks": [
    {
      "id": "content.non_empty",
      "severity": "info",
      "message": "O texto do rascunho não está vazio.",
      "passed": true
    }
  ],
  "disclaimer": "Este relatório é apoio à conformidade operacional do rascunho; não constitui validação jurídica nem substitui revisão humana."
}
```

**Feature flag:** `AGENT_ENABLED` (string) está reservada para política futura. No MVP, o endpoint devolve sempre **HTTP 200** com `mode: "stub"` e a mesma checklist determinística, com `AGENT_ENABLED` ausente, `0` ou `1` — para manter CI e clientes estáveis. Ver [ADR 0007](../Docs/adr/0007-hub-preop-git-edit-agent-mvp.md).

**curl (autenticado):**

```bash
curl -sS -X POST "http://localhost:3000/api/agent/validate" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<value>" \
  -d '{"content":"# Test\n\nBody."}'
```

## Conceptual ledger (Passo B — DocHUB alignment)

Append-only **`LedgerEntry`** rows form one chain per instrument (`sequence`, `previousEntryId`). A row is written when:

- a new **`InstrumentVersion`** is stored (`VERSION_RECORDED`, `payloadHash` = `contentHash`), or
- a **`TransitionEvent`** is recorded (`STATUS_TRANSITION`, `payloadHash` = deterministic hash of the event).

After deploying migration `20260504180000_ledger_entries`, run **`npm run backfill:ledger`** once if the database already contained instruments without ledger rows.

## Publicação (DocHUB §3.8, ADR 0006)

- **UI:** `GET /public` — catálogo; `GET /public/[idrRef]` — versão corrente; `GET /public/[idrRef]?version=n` — snapshot histórico (auditoria), com a mesma redacção `public` que a versão corrente.
- **API:** `GET /api/public/instruments` (lista) e `GET /api/public/instruments?idrRef=…&version=…` (detalhe, com `publicDisplayLabel` e `publicVersionIndex`).
- **Facada:** `GET /api/doc-hub/v0/public/instruments` — espelho anónimo do contrato acima (sem RBAC extra).

Páginas `/public/**` usam `dynamic = "force-dynamic"` para build sem Postgres em prerender. Ver [ADR 0006](../docs/adr/0006-hub-preop-publication-layer-mvp.md).

## API

| API | Role |
|-----|------|
| **Legacy** (`/api/instruments/*`, `/api/public/*`, …) | Canonical Hub pré-op; unchanged contracts. |
| **DocHUB read facade v0** (`/api/doc-hub/v0/*`) | DocHUB-shaped **GET** routes (list/detail/composition/render/ledger + public mirror); see [ADR 0005](../docs/adr/0005-hub-preop-doc-hub-api-facade-v0.md), [ADR 0006](../docs/adr/0006-hub-preop-publication-layer-mvp.md). Writes remain on legacy routes only. |

### Multi-Part editorial ([ADR 0008](../Docs/adr/0008-hub-preop-multipart-editorial-mvp.md))

- **Create:** `POST /api/instruments` with `segments` (and no top-level `content`): each item `{ partKind: "SECTION" \| "ANNEX", position, markdownBody }`, positions `1..N` contiguous. Aggregate body and `contentHash` match concatenation with `\n\n` between segments.
- **Append:** `POST /api/instruments/[id]/versions/multipart` with `{ bodiesByPartId: { "<partId>": "markdown", ... }, revisionNote? }` — multi-part profile only; monolith instruments keep using `POST .../content`.
- **Add Part:** `POST /api/instruments/[id]/parts` with `{ partKind, initialMarkdown? }` — appends a new composition row and instrument version (SECTION/ANNEX only; not for monolith instruments).
- **Migration:** `prisma/migrations/20260506140000_multipart_editorial_mvp` — run `npx prisma migrate deploy` after pull.

- `GET /api/health` — JSON `{ ok, db }` after DB ping.
- `GET /api/doc-hub/v0/health` — facade probe (no DB).
- `GET /api/instruments/[id]/ledger` — append-only ledger slice for one instrument (authenticated registrar, reviewer, or admin).
- `GET /api/doc-hub/v0/ledger/entries?doc_id=` — same ledger data keyed by `doc_id` / `idrRef` / cuid (DocHUB vocabulary).

Authentication is intentionally minimal for this phase; do not expose this prototype publicly without hardening.
