# Inventário — Multi-Part editorial MVP (MP-1)

**ADR:** [ADR 0008 — Multi-Part editorial MVP](../../Docs/adr/0008-hub-preop-multipart-editorial-mvp.md) (Accepted)  
**Prompt:** [prompt-implementador-fase-multipart-editorial-mvp.md](./prompt-implementador-fase-multipart-editorial-mvp.md)

---

## Ficheiros a tocar

| Área | Ficheiros |
|------|-----------|
| Schema / BD | `prisma/schema.prisma`, nova migração SQL (`PartVersion.markdownBody`; unique composto `(instrumentVersionId, partId)`; relação `InstrumentVersion.partVersions[]`) |
| Domínio composição | `lib/part-composition.ts` — `assembleInstrumentMarkdown`, perfil monólito vs multi, `syncMultipartPartVersionsForInstrumentVersion`, ajuste `syncMonolithicPartForInstrumentVersion` (upsert composto, `markdownBody: null`) |
| Serviço instrumento | `lib/instrument-service.ts` — `createMultipartInstrument`, `appendMultipartInstrumentVersion`, `addInstrumentCompositionPart`; guardas em `appendInstrumentVersion`; `transitionInstrument` → `part.updateMany` sem filtrar só `MONOLITH_BODY`; `getInstrumentById` / `getInstrumentByIdrRef` → parts ordenadas pela composição |
| Validação | `lib/validation/instrument.ts` — `segments` opcional no create; schemas para append multi e add part |
| API | `app/api/instruments/route.ts` (create multi via body), `app/api/instruments/[id]/parts/route.ts`, `app/api/instruments/[id]/versions/multipart/route.ts` |
| Backfill | `scripts/backfill-part-composition.ts` — detectar perfil monólito; `findFirst` / composto em vez de `findUnique(instrumentVersionId)` |
| Testes | `lib/part-composition.test.ts`, `lib/instrument-service` (se existir ficheiro dedicado) ou testes de validação; auth tests se necessário |
| Docs operação | `README.md`, `docs/OPERATIONS.md` — nota modo multi-Part |

**Sem alteração obrigatória neste MVP:** facade DocHUB GET composition (já usa `getInstrumentCompositionView`); publicação usa `InstrumentVersion.content` agregado.

---

## Comportamento a preservar (monólito)

- `createInstrument` + `appendInstrumentVersion` + `syncMonolithicPartForInstrumentVersion`: uma `MONOLITH_BODY`, uma entrada composição posição 1, `PartVersion.markdownBody` permanece `null`.
- `computeContentHash` / `VERSION_RECORDED` / invariantes de cadeia de versão inalterados para instrumentos monolíticos.
- Instrumentos existentes na BD: migrados com `markdownBody` NULL; unique antigo substituído por unique composto com uma linha por versão (monólito continua com uma linha por `InstrumentVersion`).

---

## Riscos e decisões

| Risco | Mitigação |
|-------|-----------|
| Quebra de código que assumia `PartVersion` 1:1 com `InstrumentVersion` | Actualizar upserts/backfill; gerar cliente Prisma após schema |
| Clientes POST create sem `segments` | Compatível: fluxo monólito inalterado |
| `appendInstrumentVersion` chamado em instrumento multi-Part | `DomainError` com mensagem clara; usar rota multipart |

**Decisões já fechadas no ADR 0008:** agregado + hash em `InstrumentVersion.content`; `assembleInstrumentMarkdown` com `\n\n`; `partKind` SECTION/ANNEX em multi; invariante N>1 sem MONOLITH; `partStatus` derivado do instrumento para todas as Parts.

---

## Gate MP-2

- [x] ADR 0008 Accepted  
- [x] Inventário MP-1 (este documento)
- [x] MP-2 implementado (schema, serviço, rotas, testes, docs)

---

## Handoff — Phase MP-2

**Completed**
- ADR 0008 Accepted (2026-05-06).
- MP-2 entregue: migração `20260506140000_multipart_editorial_mvp` (`PartVersion.markdownBody`, unique `(instrumentVersionId, partId)`), `assembleInstrumentMarkdown` determinístico (`\n\n`), fluxos `createMultipartInstrument` / `appendMultipartInstrumentVersion` / `addInstrumentCompositionPart` em `instrument-service`, rotas `POST /api/instruments` (com `segments`), `POST /api/instruments/[id]/parts`, `POST /api/instruments/[id]/versions/multipart`. Regressão monólito intacta (smoke + part-composition tests).
- Validações sessão de commit: `npm run lint` ✓ (sem warnings/errors); `npm run test:no-db` ✓ (72 passed, 1 skipped, 0 failed).

**Decisions made**
- ADR 0008 Decisão E: opção (1) — projeção derivada do estado do instrumento para todas as Parts (Pilot, 2026-05-06).
- Invariante composição vs monólito (Decisão C) confirmada pelo Pilot (2026-05-06).

**ADRs committed**
- [ADR 0008 — Multi-Part editorial MVP](../../Docs/adr/0008-hub-preop-multipart-editorial-mvp.md) — Accepted.

**Deferred**
- Migração automática de instrumento monólito → multi-Part.
- Facade DocHUB **escrita** multi-Part (GET inalterado).
- Estados de Part independentes complexos (PRC/SG, votos).
- Testes com BD live (`npm test` completo) — sessão actual ficou em `test:no-db`; correr antes de releases que envolvam migração em produção.

**Blockers**
- Nenhum a bloquear sessão actual.

**Next focus**
- Pilot: priorizar entre (a) UI por Part (já adiantada — ver "Deviations"), (b) transição monólito → multi-Part, (c) Facade DocHUB write multi-Part.

**Deviations from MP-MVP scope (Pilot acknowledgement, 2026-05-07)**
- `app/instruments/[id]/edit/page.tsx` recebeu editor multi-Part por segmento (≈167 linhas) que submete para `versions/multipart`. ADR 0008 declara "UI por Part (entrega separada)" como **fora de escopo**. Pilot autorizou (2026-05-07) commit separado pós-MP-2 (`feat(hub-preop): multi-Part editor UI (post-MP-2; deviation from ADR 0008 fora-de-escopo)`) **sem** reabertura formal do ADR; este registo cobre a auditoria de governança.
- Tooling de dados independente do MP-2: `SEED_SKIP_INSTRUMENTS=1` em `seed-founding.ts` (pareado com `seed:users-only`) e novo `scripts/ingest-constitutional-foundation.ts` que ingere os ficheiros de "I. CONSTITUTIONAL FOUNDATION" como instrumentos **monólito** (justificação no header do script: `@@unique([instrumentId, partKind])` impede agrupar SECTION/ANNEX múltiplos por instrumento sem expansão de vocabulário). Commitado como `chore(hub-preop): seed:users-only + ingest CONSTITUTIONAL FOUNDATION as monolith instruments`.
