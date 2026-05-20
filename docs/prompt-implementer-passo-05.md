# Prompt do implementador — Passo 5 (Fase 5)

**Passo 5** = **escrita v2** só via `ClauseVersion` + **convivência strangler** com v1; bloqueios no fluxo legado.  
**Pré-requisitos:** Passos 1–4 concluídos — handoffs [`01`](./handoff-passo-01.md) … [`04`](./handoff-passo-04.md).  
**Plano:** [`work-plan-schema-v2-implementation.md`](./work-plan-schema-v2-implementation.md) — Fase 5.

---

## Decisões Pilot (herdadas)

| Tema | Regra |
|------|--------|
| Escrita v2 | **Nunca** `UPDATE` em `ClauseVersion.body`; sempre `appendClauseVersion` |
| Agregado após emenda | Chamar `aggregateAndPersistInstrument` na mesma TX ou imediatamente a seguir (documentar escolha) |
| `idrRef` novos v2 | **Só semânticos** (`idr:c:…`); **proibido** `idr:HUB-INSTR-*` em `structuralProfile = v2` |
| Criação v2 via API Hub | **Fora** desta fase — instrumentos v2 nascem por scripts Fase 3; API só **emenda cláusula** |
| Segmentos de path | **Minúsculas** (Passo 3) |
| UI comité / transições multi-acto | **Fora** — documentar em Step 5.4 |

---

## Estado prévio (lab)

- `idr:c:foundation`, `idr:c:preop-regime` com agregado `derived` (Passo 4)
- `lib/normative/`: gramática, registry, `appendClauseVersion`, `aggregateAndPersistInstrument`
- Branch: `feat/hub-preop-schema-v2-phase1`

---

## Prompt (copiar a partir da linha seguinte)

```markdown
# Implementador Hub-preop — Passo 5: Fase 5 (escrita v2 + guards v1/v2)

## Papel
És o **AI Dev Machine** em **`hub-preop/`** apenas. O Pilot autorizou Fase 5 e **pede commit** ao final.

## Objetivo
1. Impedir que instrumentos **v2** usem fluxos de escrita **v1** (monólito / multipart / `allocateIdrRef`).
2. Expor escrita editorial v2: **nova versão de cláusula** + re-agregação do documento.
3. Garantir que tentativas inválidas falham com erros de domínio claros (HTTP 400/409).
4. Manter instrumentos **v1** inalterados em comportamento e testes.

## Leitura obrigatória
1. `Docs/adr/0015-dochub-schema-v2-normative-tree.md` — §4 perfis v1/v2, §2.2 imutabilidade
2. `hub-preop/docs/handoff-passo-04.md`
3. `hub-preop/lib/instrument-service.ts` — `createInstrument`, `appendInstrumentVersion`, `appendMultipartInstrumentVersion`, `allocateIdrRef`
4. `hub-preop/lib/normative/clause-version.ts`, `aggregate-instrument.ts`
5. `hub-preop/app/api/instruments/[id]/content/route.ts`
6. `hub-preop/app/api/instruments/[id]/versions/multipart/route.ts` (se existir)
7. `hub-preop/lib/rbac.ts` — `canAppendContent`

## Escopo permitido
- `lib/normative/append-clause-and-reaggregate.ts` (ou nome equivalente) — orquestração TX
- `lib/instrument-service.ts` — guards v1/v2 (alterações mínimas)
- `lib/domain/v2-write-guards.ts` (opcional) — `assertV1WritePath`, `assertSemanticIdrRefForV2`, `rejectHubInstrForV2`
- `lib/validation/normative.ts` — schema Zod corpo da emenda
- `app/api/instruments/[id]/clauses/[clauseId]/versions/route.ts` — `POST` emenda v2
- Testes: `*.test.ts` + actualizar `content/route.auth.test.ts` se v2 passar a 403
- `docs/handoff-passo-05.md`
- `docs/phase5-out-of-scope.md` (Step 5.4)
- **Commit** (secção Commit)

## Proibições
- **Não** criar novos instrumentos v2 via `POST /api/instruments` (manter bloqueio ou 501 documentado)
- **Não** UI comité / workspace editorial por cláusula
- **Não** implementar ADR 0012 (authority multi-acto) nem ADR 0011 (grafo)
- **Não** alterar scripts de carga Fase 3 salvo fix crítico
- **Não** push / PR sem pedido

---

## Step 5.1 — Bloquear escrita v1 em instrumentos v2

Em `instrument-service.ts` (ou `v2-write-guards.ts` importado):

| Função | Comportamento se `structuralProfile === 'v2'` |
|--------|-----------------------------------------------|
| `appendInstrumentVersion` | `DomainError`: *"v2 instruments use clause-level append; POST …/clauses/{clauseId}/versions"* |
| `appendMultipartInstrumentVersion` | Idem |
| `transitionMonolithToMultipart` (se aplicável) | Rejeitar |
| `syncMonolithicPartForInstrumentVersion` | Não invocar para v2 (já deve estar assim — confirmar) |

**Criação legada (`createInstrument`):** permanece **v1** (`structuralProfile` default `v1`, `allocateIdrRef`). Não aceitar `structuralProfile: v2` no body público sem ADR novo.

Testes: fixture v2 mínima → `appendInstrumentVersion` falha; v1 existente → continua a passar.

---

## Step 5.2 — `IdrSequence` / `HUB-INSTR` desactivado para v2

| Local | Regra |
|-------|--------|
| `allocateIdrRef()` | Documentar: **apenas** criação v1; nunca chamar para v2 |
| Validação ao persistir v2 (load scripts já usam idr semântico) | `assertValidV2InstrumentIdrRef(idrRef)`: deve passar `validateIdrRef`; **rejeitar** `isLegacyHubInstrRef(idrRef)` |
| Opcional: helper `registerV2InstrumentHead` interno (scripts only) — se extrair de load, não expor em API |

Teste unitário: `idr:HUB-INSTR-00000001` + `structuralProfile v2` → erro.

---

## Step 5.3 — API de emenda por cláusula + re-agregação

### Rota nova (mínima)

`POST /api/instruments/{id}/clauses/{clauseId}/versions`

**Auth:** mesma política que `POST …/content` (`canAppendContent` + comité do instrumento).

**Body (Zod):**
```json
{ "body": "string", "revisionNote": "optional string" }
```

**Fluxo (TX recomendada):**
1. Carregar `Instrument` por `id`; falhar se não `structuralProfile === 'v2'`.
2. Verificar `clauseId` pertence ao instrumento (join `NormativeClause` → … → `instrumentId`).
3. `appendClauseVersion(tx, { clauseId, body, revisionNote, createdBy })` — `createdBy` = email ou id do utilizador da sessão.
4. `aggregateAndPersistInstrument(instrumentId, { force: false })` — ou `{ force: true }` se PO quiser sempre nova revisão; **preferência:** sem force se hash igual (reutilizar lógica Passo 4).
5. Retornar JSON: `{ clauseVersion, instrument: InstrumentDetail resumido, aggregate: { revisionNumber, contentHash } }`.

**Proibições na rota:**
- Não aceitar `instrumentVersionId` nem `content` agregado no body.
- Não fazer `prisma.clauseVersion.update` em `body`.

### Facade DocHUB (opcional, mínimo)

Se trivial: `POST /api/doc-hub/v0/instruments/{docId}/clauses/{clauseId}/versions` — proxy para o mesmo serviço, `docId` = cuid ou `idrRef` via `resolveInstrumentDetail`.

### Testes
- v2: POST válido → nova `ClauseVersion`, `InstrumentVersion` derived incrementado ou idempotente, hash coerente.
- v1: POST na rota de cláusula → 404 ou 400 “not a v2 instrument”.
- v2: POST em `/content` → 400 com mensagem clara (actualizar testes auth existentes).

---

## Step 5.4 — Documentar fora de âmbito

Criar `docs/phase5-out-of-scope.md` (≤30 linhas):

- UI comité para editar cláusula
- Criação de árvore v2 via formulário Hub
- Transições multi-acto (ADR 0012)
- Grafo normativo (ADR 0011)
- Publicação automática `publishedAt` no piloto
- Desactivação global de `idr:HUB-INSTR-*` em leitura (continua resolvível via alias)

Referenciar em `handoff-passo-05.md`.

---

## Step 5.5 — Verificação

```bash
cd hub-preop
npm test
npx prisma validate
# Manual (sessão admin/registrar):
# POST /api/instruments/{foundationId}/clauses/{clauseId}/versions  { "body": "…", "revisionNote": "pilot edit" }
# GET /api/doc-hub/v0/instruments/idr%3Ac%3Afoundation/render
```

Confirmar: instrumento v1 `appendInstrumentVersion` ainda funciona nos testes de regressão.

---

## Step 5.6 — Commit (obrigatório)

```bash
cd hub-preop
git add lib/normative/ lib/instrument-service.ts lib/domain/v2-write-guards.ts \
  lib/validation/normative.ts \
  app/api/instruments/ app/api/doc-hub/v0/ \
  docs/handoff-passo-05.md docs/phase5-out-of-scope.md \
  **/*.test.ts
git status
git commit -m "$(cat <<'EOF'
feat(hub-preop): Phase 01 step 05 — v2 clause write path and v1/v2 guards

Block monolith/multipart append on v2; reject HUB-INSTR for semantic profile;
POST clause versions with appendClauseVersion and derived re-aggregation.
EOF
)"
```

**Não** fazer `git push` salvo pedido do Pilot.

---

## Entregáveis
1. Guards em `instrument-service` (+ helpers)
2. `POST …/clauses/{clauseId}/versions`
3. `docs/handoff-passo-05.md` + `docs/phase5-out-of-scope.md`
4. Commit na branch de feature

## Handoff — Passo 5 (template)

```markdown
## Handoff — Passo 5 (Fase 5)

- Branch / commit: …
- Rotas novas: POST …/clauses/{clauseId}/versions — …
- Guards v1: appendInstrumentVersion OK em v1 · bloqueado em v2
- HUB-INSTR + v2: rejeitado em …
- Teste emenda piloto: clauseId … · nova versão N · agregado hash …
- npm test: …
- Fora de âmbito: ver phase5-out-of-scope.md
- Próximo passo: Fase 6 (verificação final + PR)
- Riscos: …
```

## Critério de aceite (Pilot)
- [ ] `appendInstrumentVersion` em v2 → erro explícito
- [ ] `POST …/clauses/{clauseId}/versions` em v2 → nova `ClauseVersion` + agregado actualizado
- [ ] Tentativa de associar `idr:HUB-INSTR-*` a perfil v2 → erro (teste ou validação documentada)
- [ ] v1 regressão verde
- [ ] `phase5-out-of-scope.md` presente
- [ ] Commit criado; sem push

## Conflitos
Parar e reportar ao Pilot.
```

---

## Variante curta (só guards, sem API)

```markdown
Executa Fase 5 Steps 5.1–5.2 e 5.4 apenas: guards em instrument-service, validação HUB-INSTR vs v2, phase5-out-of-scope.md, testes. **Sem** rota POST de cláusula. Commit: `feat(hub-preop): Phase 01 step 05a — v2 write guards only`.
```
