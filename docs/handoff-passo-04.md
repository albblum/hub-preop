## Handoff — Passo 4 (Fase 4)

- **Branch:** `feat/hub-preop-schema-v2-phase1` (commit após este passo)
- **Agregado (lab, pós `aggregate-v2-instruments.ts --all`):**
  - `idr:c:foundation` — hash `73843aa827d24cacd30af691fe80f4e953599ec09b6e1ff7d7f691aeaece65e6` · 54 cláusulas · ~12.5k chars
  - `idr:c:preop-regime` — hash `0f2b86c9e595d2824f4175bb8447198b5d2d22abd091283906281d16e72d016d` · 57 cláusulas · ~15.7k chars
- **InstrumentRevision:** rev 1 por documento (lab); junção `InstrumentRevisionClauseVersion` alinhada com `clauseVersionIds` do agregado
- **Facade:**
  - `resolveInstrumentDetail('idr:c:foundation')` — registry → `getInstrumentById`
  - Legado `idr:HUB-INSTR-*` — via `resolveIdrRef` + alias (testes unitários; aliases na carga foundation quando monólitos v1 existirem)
  - `instrumentDetailToDocHubShape` — `structuralProfile`, metadados Norma, `sectionsSummary`, `resolvedClause` (pedido clause-level)
  - `/render` — usa `currentVersionRecord.content` (derivado após CLI)
- **v1 regressão:** suites existentes verdes; `attachCompositionDetailFields` ignora Part/Composition para `structuralProfile=v2`
- **Leitura v2 sem CLI:** fallback on-read com `console.warn` (Pilot: preferir CLI antes de testar API)
- **immutability + ledger:** `InstrumentRevision` coberto em `assertClauseVersionNotReferenced`; `LedgerEntry` permanece ao nível instrumento — sem ligação directa a `ClauseVersion` (documentado em `immutability.ts`)
- **npm test:** 166 pass (com BD) · 141 pass + 25 skip (`SKIP_DB=1`)
- **Próximo passo:** Fase 5 — guards de escrita v1/v2, append editorial v2
- **Riscos:** re-agregar com `--force` incrementa versão mesmo com conteúdo idêntico; idempotência sem `--force` compara `content` do último `derived`

### Verificação manual (Pilot)

```bash
cd hub-preop
npx tsx scripts/aggregate-v2-instruments.ts --all

curl -sS "http://localhost:3000/api/doc-hub/v0/instruments/idr%3Ac%3Afoundation" \
  | jq '.structuralProfile,.currentVersionRecord.contentSourceKind'

curl -sS "http://localhost:3000/api/doc-hub/v0/instruments/idr%3Ac%3Apreop-regime/render?mode=restricted" -H "Cookie: …"
```
