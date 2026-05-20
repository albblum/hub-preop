# Prompt do implementador — Passo 2 (Fase 2)

**Passo 2** = camada de domínio v2 em `lib/normative/*` — sem UI, sem APIs novas, sem carga de dados.  
**Pré-requisito:** Passo 1 concluído (schema v2 migrado em lab; ver [`handoff-passo-01.md`](./handoff-passo-01.md)).  
**Plano completo:** [`work-plan-schema-v2-implementation.md`](./work-plan-schema-v2-implementation.md) — secção Fase 2.

---

## Estado Pilot (2026-05-18)

- Schema v2 aplicado em lab (migração `20260518120000_schema_v2_normative_tree`).
- `npm test`: 132/132 verdes pós-migrate.
- **Autorizado avançar para Fase 2** (Pilot).

---

## Prompt (copiar a partir da linha seguinte)

```markdown
# Implementador Hub-preop — Passo 2: Fase 2 (domínio v2)

## Papel
És o **AI Dev Machine** no repositório **`hub-preop/`** apenas. O **Pilot** aprova gates; não tomes decisões de produto, não alteres ADRs nem reabras Fase 1.

## Objetivo deste passo
Implementar a camada de domínio v2 — módulos puros + serviços Prisma — que a Fase 3 (carga piloto) e Fase 4 (agregado) vão consumir. **Sem** UI, **sem** novas rotas HTTP, **sem** inserir dados constitucionais.

## Estado prévio (não alterar)
- Branch: `feat/hub-preop-schema-v2-phase1` (continuar aqui ou nova `feat/hub-preop-domain-v2`)
- Schema v2 aplicado em lab; CHECK annex→pai activo
- Instrumentos existentes: 27 com `structuralProfile = v1`

## Leitura obrigatória (ordem)
1. `docs/methodology/pilot-machine-methodology.md`
2. `Docs/adr/0014-dochub-phase1-constitutional-structural-model.md` — §1 gramática `idrRef`
3. `Docs/adr/0015-dochub-schema-v2-normative-tree.md` — §1 entidades, §2 imutabilidade
4. `hub-preop/docs/work-plan-schema-v2-implementation.md` — Fase 2 apenas
5. `hub-preop/prisma/schema.prisma` — modelos v2
6. `hub-preop/lib/integrity/content-hash.ts` — padrão de hash a reutilizar

## Escopo permitido
- Criar pasta `lib/normative/` (novos ficheiros TypeScript)
- Usar Prisma client existente (`@prisma/client`); transacções via `prisma.$transaction`
- Reutilizar `computeContentHash` para `ClauseVersion.contentHash`
- Testes Vitest em `*.test.ts` paralelos (sem BD real ou com Prisma mocked — preferir testes de unidade puros para gramática; testes de integração com BD lab para serviços transaccionais, marcados com `describeIfDb` se já existir padrão, caso contrário criar)
- Commit incremental por step **só** se Pilot pedir

## Proibições explícitas
- **Não** criar instrumentos `idr:c:foundation` ou `idr:c:preop-regime` nesta fase (é Fase 3)
- **Não** modificar `lib/instrument-service.ts`, `lib/part-composition.ts`, facade `app/api/doc-hub/v0/*`, RBAC, comité
- **Não** criar endpoints HTTP novos
- **Não** desactivar `IdrSequence` (Fase 5)
- **Não** mexer em dados v1 nem em migrações já aplicadas
- **Não** fazer push ou PR sem instrução

## Tarefas (executar na ordem)

### Step 2.1 — Gramática e composição de `idrRef`
**Ficheiro:** `lib/normative/idr-ref-grammar.ts` (+ `.test.ts`)

Implementar (ADR 0014 §1.2–§1.3):

- `IdrRefSegments` (tipo): `{ typePrefix: 'c'|'o'|'i'|'f'|'p'|'r', documentCode, section?, article?, paragraph?, clause?, annex? }`
- `composeIdrRef(segments): string` — gera path canónico (`idr:c:foundation:s0:art.en:§5:cl:1`)
- `parseIdrRef(ref): IdrRefSegments` — inverso; lança erro com código tipado em colisão de regex
- `validateIdrRef(ref): { ok: true } | { ok: false; reason }`
- Regras: ordem fixa (doc → s → art → § → cl); sem omissão intermédia; alfabeto `[a-z0-9.-]` em códigos; `:` apenas como separador; annex como `idr:<prefixo>:<doc>:annex:<código>` (sem prefixo de tipo próprio)

**Testes:** casos do ADR (`idr:c:foundation`, `idr:c:foundation:s0:art.I:§1:cl:1`, `idr:o:2.5:s5:art.15:§2:cl:1`); rejeitar `idr:c:foundation:cl:1` (salta níveis); aceitar `cl:a` (alínea letra).

### Step 2.2 — Registo `IdrRefRegistry`
**Ficheiro:** `lib/normative/idr-ref-registry.ts` (+ `.test.ts`)

- `registerIdrRef(tx, { idrRef, ownerKind, ownerId, grammarVersion? })` — insere em `IdrRefRegistry`; lança `IdrRefCollisionError` se já existe
- `assertIdrRefAvailable(tx, idrRef)` — leitura
- `lookupOwner(idrRef): { ownerKind, ownerId } | null`
- API recebe `Prisma.TransactionClient` para uso dentro de `$transaction`

**Testes (integração com BD lab):** inserir nó + registar idrRef na mesma TX; segunda tentativa com mesmo idrRef falha com `IdrRefCollisionError`; rollback da TX se erro a meio.

### Step 2.3 — Resolução de leitura + alias
**Ficheiro:** `lib/normative/resolve-idr-ref.ts` (+ `.test.ts`)

- `resolveIdrRef(input: string): ResolvedRef` — aceita semântico **ou** legado (`idr:HUB-INSTR-*`); ordem: registry → alias → null
- `ResolvedRef`: `{ canonical, legacy?, ownerKind, ownerId }`
- `registerAlias(tx, { legacyRef, canonicalRef, ownerKind?, ownerId?, note? })`

**Testes:** alias 1:N (um legado, múltiplos canónicos — aceita o primeiro e expõe lista quando solicitado); idrRef inexistente retorna null sem lançar.

### Step 2.4 — `ClauseVersion` (append-only)
**Ficheiro:** `lib/normative/clause-version.ts` (+ `.test.ts`)

- `appendClauseVersion(tx, { clauseId, body, revisionNote?, createdBy? }): ClauseVersion`
  - calcula `version = max(existing) + 1` (ou 1 se nenhuma); usa `computeContentHash(version, body)`; preenche `previousContentHash` com hash da versão N-1; marca `isCurrent=true` e desliga `isCurrent` das anteriores na mesma TX; actualiza `NormativeClause.currentVersionId`
- `getCurrentClauseVersion(clauseId)`

**Testes:** sequência de 3 appends produz versões 1,2,3 com `previousContentHash` encadeado; apenas uma versão `isCurrent` por cláusula.

### Step 2.5 — Guards de imutabilidade
**Ficheiro:** `lib/normative/immutability.ts` (+ `.test.ts`)

- `assertClauseNotPublished(tx, clauseId)` — lê `publishedAt`; lança `ClauseImmutableError` se preenchido
- `assertClauseVersionNotReferenced(tx, clauseVersionId)` — falha se a versão aparece em `InstrumentRevisionClauseVersion` ou em qualquer `LedgerEntry.payloadHash` que dependa dela (Fase 1: verificação apenas em `InstrumentRevisionClauseVersion`; ledger é Fase 4 — documentar TODO)
- `assertSectionStructureMutable(tx, sectionId)` — bloqueia reorder se `publishedAt` definido

**Testes:** publicar cláusula → tentar `appendClauseVersion` falha apenas se a regra de negócio escolher bloquear (ADR 0015 §2.2: emendas geram **nova versão**, ok; o que falha é `UPDATE body` directo, que não existe no domínio); incluir teste explícito mostrando que tentativa de `prisma.clauseVersion.update({ body })` é rejeitada pelo guard quando chamada do serviço.

### Step 2.6 — Bateria de testes consolidada
- `vitest run` verde em ambiente com BD lab
- Cobertura mínima: gramática 100% das regras §1.3 ADR 0014; transações em registry; encadeamento de hash em clause-version
- Adicionar `lib/normative/index.ts` exportando o público

## Verificação pós-Fase 2
- `npm test` — todos verdes
- `npx prisma validate` — OK
- Inspeccionar BD: nada inserido em tabelas v2 por testes que não limpem; se houver, criar utilitário `withCleanV2Tables` em `lib/normative/test-helpers.ts`
- Documentar em `docs/handoff-passo-02.md` os módulos criados e o seu contrato público

## Entregáveis

1. Módulos em `lib/normative/`:
   - `idr-ref-grammar.ts`
   - `idr-ref-registry.ts`
   - `resolve-idr-ref.ts`
   - `clause-version.ts`
   - `immutability.ts`
   - `index.ts`
   - testes `.test.ts` correspondentes
2. `docs/handoff-passo-02.md` com o template abaixo
3. Sem alterações em código v1; sem novas migrações Prisma

## Formato do relatório (preencher no handoff)

```markdown
## Handoff — Passo 2 (Fase 2)

- Branch: …
- Módulos criados: lib/normative/{…}
- Cobertura testes (descrita): gramática …, registry …, clause-version …, immutability …
- npm test: …
- prisma validate: …
- TODOs assumidos (com referência ADR): …
- Próximo passo recomendado: Fase 3 (scripts de carga piloto) — aguardar OK Pilot
- Riscos / dúvidas ao Pilot: …
```

## Critério de aceite (Pilot)
- [ ] Gramática rejeita salto de nível e caracteres inválidos
- [ ] `IdrRefRegistry` rejeita colisão dentro da mesma TX
- [ ] `appendClauseVersion` encadeia hash e mantém apenas uma `isCurrent`
- [ ] Guards `publishedAt` activos
- [ ] Sem alterações fora de `lib/normative/` (excepto `lib/normative/index.ts` e testes)
- [ ] `npm test` verde

## Se encontrares conflito com spec ou ADR
Para. Lista o conflito. Não improvises. Escala ao Pilot antes de codificar fora do contrato.
```

---

## Variante curta (sandbox sem BD)

```markdown
Executa **apenas Steps 2.1 e 2.5** do prompt acima (gramática + guards puros, sem Prisma). Adia 2.2/2.3/2.4 até BD lab acessível. Entrega `lib/normative/idr-ref-grammar.ts` + `immutability.ts` (versão pura sobre objectos) + testes Vitest verdes.
```
