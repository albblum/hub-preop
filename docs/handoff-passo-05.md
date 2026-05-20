## Handoff — Passo 5 (Fase 5)

- **Branch / commit:** `feat/hub-preop-schema-v2-phase1` · `d465cd5`
- **Rotas novas:**
  - `POST /api/instruments/{id}/clauses/{clauseId}/versions` — emenda v2 + re-agregação
  - `POST /api/doc-hub/v0/instruments/{docId}/clauses/{clauseId}/versions` — proxy DocHUB (docId = cuid ou idrRef)
- **Guards v1:** `appendInstrumentVersion` / `appendMultipartInstrumentVersion` / `transitionMonolithToMultipartProfile` OK em v1 · bloqueados em v2 (`V2_WRITE_PATH_BLOCKED`, HTTP 400)
- **HUB-INSTR + v2:** rejeitado em `assertValidV2InstrumentIdrRef` (`INVALID_V2_IDR_REF`) — teste unitário em `lib/domain/v2-write-guards.test.ts`
- **Orquestração:** `appendClauseVersion` (TX 1) + `aggregateAndPersistInstrument` sem `force` (TX 2, idempotente se conteúdo derivado igual)
- **npm test:** 179 pass (com BD)
- **Fora de âmbito:** [`phase5-out-of-scope.md`](./phase5-out-of-scope.md)
- **Próximo passo:** Fase 6 — verificação final + PR
- **Riscos:** segunda TX de agregação não atómica com a emenda de cláusula; falha intermédia deixa cláusula actualizada sem derived head actualizado (re-correr agregação CLI)

### Verificação manual (Pilot)

```bash
cd hub-preop
npm test
npx prisma validate

# POST emenda (sessão admin/registrar):
# POST /api/instruments/{foundationId}/clauses/{clauseId}/versions
#   { "body": "…", "revisionNote": "pilot edit" }

curl -sS "http://localhost:3000/api/doc-hub/v0/instruments/idr%3Ac%3Afoundation/render?mode=restricted" -H "Cookie: …"
```
