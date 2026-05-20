# Prompt do implementador — Passo 4 (Fase 4)

**Passo 4** = **agregado derivado** + **leitura v2** via serviços e facade DocHUB existentes.  
**Pré-requisitos:** Passos 1–3 concluídos — [`handoff-passo-01.md`](./handoff-passo-01.md), [`handoff-passo-02.md`](./handoff-passo-02.md), [`handoff-passo-03.md`](./handoff-passo-03.md).  
**Plano:** [`work-plan-schema-v2-implementation.md`](./work-plan-schema-v2-implementation.md) — Fase 4.

---

## Decisões Pilot (herdadas)

| Tema | Regra |
|------|--------|
| Segmentos `idrRef` | **Só minúsculas** (Passo 3); leitura e resolução usam refs já persistidas |
| Fonte de verdade | `ClauseVersion.body` (`isCurrent = true`) |
| Agregado | Cache derivado em `InstrumentVersion.content` — **nunca** editado directamente em v2 |
| Secções `deferred` | **Excluir** do Markdown agregado (sem placeholder); só secções com pelo menos uma cláusula com corpo |
| `nonNormative` | Expor no payload DocHUB quando o pedido for ao nível de secção/cláusula; documento completo mantém texto mas metadado `nonNormative: true` em `s2` da Norma |

---

## Estado prévio (lab)

- `idr:c:foundation` — 54 cláusulas (s0+s2 pilot; s1/s3–s8 deferred sem texto)
- `idr:c:preop-regime` — 57 cláusulas; `s2` `nonNormative=true`
- Branch: `feat/hub-preop-schema-v2-phase1`
- **Sem** `InstrumentVersion` derivado ainda para v2 (esperado antes deste passo)

---

## Prompt (copiar a partir da linha seguinte)

```markdown
# Implementador Hub-preop — Passo 4: Fase 4 (agregado derivado + leitura)

## Papel
És o **AI Dev Machine** em **`hub-preop/`** apenas. O Pilot autorizou Fase 4 e **pede commit** ao final. Não alteres ADRs sem instrução.

## Objetivo
1. Construir agregado Markdown **reproduzível** a partir da árvore v2 e gravar `InstrumentRevision` + `InstrumentVersion` (`contentSourceKind = derived`).
2. Integrar leitura v2 na stack existente (`instrument-service`, `doc-hub-facade`, rotas `GET /api/doc-hub/v0/instruments/{docId}` e `/render`) sem regressão v1.
3. Resolver `idrRef` semântico **e** legado (`idr:HUB-INSTR-*` via `IdrRefAlias`) na facade.

**Fora de âmbito:** Fase 5 (bloqueios de escrita v2), UI comité, novos endpoints além do mínimo na facade, Fase 6 (PR final).

## Leitura obrigatória
1. `Docs/adr/0015-dochub-schema-v2-normative-tree.md` — §2.3 agregado derivado
2. `hub-preop/docs/handoff-passo-03.md` — contagens e parser
3. `hub-preop/lib/normative/index.ts`
4. `hub-preop/lib/integrity/content-hash.ts` — reutilizar `computeContentHash`
5. `hub-preop/lib/instrument-service.ts` — `getInstrumentById`, `getInstrumentByIdrRef`, `attachCompositionDetailFields`
6. `hub-preop/lib/doc-hub-facade.ts` — `resolveInstrumentDetail`, `instrumentDetailToDocHubShape`
7. `hub-preop/app/api/doc-hub/v0/instruments/[docId]/route.ts` e `.../render/route.ts`

## Escopo permitido
- `lib/normative/aggregate-instrument.ts` (+ testes)
- `lib/normative/read-v2-instrument.ts` (opcional: loader da árvore para agregado e leitura)
- `scripts/aggregate-v2-instruments.ts` — CLI: `--instrument idr:c:foundation|idr:c:preop-regime|all`
- Alterações **mínimas** em `lib/instrument-service.ts`, `lib/doc-hub-facade.ts` (ramo `structuralProfile === v2`)
- Completar TODO em `lib/normative/immutability.ts` — `LedgerEntry` + `payloadHash` **se** houver ligação clara; senão documentar limite no handoff
- Extensão leve do shape DocHUB (campos opcionais: `structuralProfile`, `nonNormative` por secção quando aplicável)
- `docs/handoff-passo-04.md`
- Testes Vitest (unit + `describeIfDb`)
- **Commit** (secção Commit)

## Proibições
- **Não** alterar scripts de carga Fase 3 excepto bugfix bloqueante acordado com Pilot
- **Não** editar `InstrumentVersion.content` de instrumentos **v1**
- **Não** criar Part/CompositionEntry para v2
- **Não** implementar append editorial v2 nas APIs de escrita (Fase 5)
- **Não** push / PR sem pedido

## Step 4.1 — Agregado (`aggregate-instrument.ts`)

### Algoritmo (ADR 0015 §2.3)
1. Carregar `Instrument` v2 por `id` ou `idrRef`.
2. Listar `NormativeSection` por `position` ASC.
3. **Ignorar** secções `migrationPhase = deferred` **ou** sem qualquer `ClauseVersion` com corpo.
4. Por secção incluída: opcional cabeçalho Markdown `## {title || code}` (documentar constante).
5. Por `NormativeArticle` (`position`), `NormativeParagraph` (`position`), `NormativeClause` (`position`):
   - Ler `ClauseVersion` com `isCurrent = true`.
   - Concatenar `body` com separadores **fixos** (exportar constantes):

```ts
export const AGGREGATE_SEP = {
  betweenClauses: "\n\n",
  betweenParagraphs: "\n\n",
  betweenArticles: "\n\n---\n\n",
  betweenSections: "\n\n---\n\n",
} as const;
```

6. `content = aggregateMarkdown`; `versionNum = instrument.currentVersion + 1` ou `1` se primeira derivação.
7. `contentHash = computeContentHash(versionNum, content)`.
8. Devolver `{ content, contentHash, clauseVersionIds: string[] }` para persistência.

### Reprodutibilidade
- Mesma árvore + mesmas versões `isCurrent` ⇒ mesmo hash (teste unitário obrigatório).

## Step 4.2 — Persistência (`aggregateAndPersistInstrument`)

Função transaccional (mesma TX):

| Passo | Acção |
|-------|--------|
| 1 | `aggregateInstrument(tx, instrumentId)` |
| 2 | `InstrumentRevision.create` — `revisionNumber` = último + 1; `aggregateContentHash` = `contentHash` |
| 3 | `InstrumentRevisionClauseVersion.createMany` — uma linha por `clauseVersionId` |
| 4 | `InstrumentVersion.create` — `content`, `contentHash`, `contentSourceKind: derived`, `previousContentHash` da versão anterior se existir |
| 5 | `Instrument.update` — `currentVersion`, `currentVersionRecordId` |

**Idempotência:** flag `--force` no script para nova revisão; sem `--force`, abortar se já existe `InstrumentVersion` `derived` com mesmo hash.

## Step 4.3 — Integração leitura (`instrument-service` + facade)

### `getInstrumentById` / `getInstrumentByIdrRef`
- Se `structuralProfile === 'v2'`:
  - Se **não** há `currentVersionRecord` **ou** última versão não é `derived`: chamar agregado on-read **ou** documentar que o script CLI deve correr primeiro — **preferência Pilot:** script CLI obrigatório no piloto; on-read só como fallback com log `warn`.
  - `attachCompositionDetailFields`: para v2, `compositionProfile = 'monolith'` sintético; `parts = []`; conteúdo vem de `currentVersionRecord.content` (agregado).

### `resolveInstrumentDetail(docIdParam)` (`doc-hub-facade.ts`)
Ordem de resolução:
1. `resolveIdrRef(docIdParam)` (`lib/normative`)
   - Se `ownerKind === 'instrument'` → `getInstrumentById(ownerId)`
   - Se `ownerKind === 'clause'` → resolver instrumento pai + incluir no JSON `resolvedClause: { idrRef, body, nonNormative? }` (extensão mínima)
   - Se `legacyRef` via alias → canónico → repetir
2. `getInstrumentById(docIdParam)` (cuid)
3. `getInstrumentByIdrRef(docIdParam)` (idrRef directo na tabela `Instrument`)

### Shape DocHUB
Estender `instrumentDetailToDocHubShape` (campos opcionais, não quebrar clientes):
- `structuralProfile`
- `semanticDocumentCode`
- `terminationDate`, `terminationRequiresExplicitAct`, … (Norma)
- `sectionsSummary?: { code, position, nonNormative, migrationPhase }[]` — lista leve, sem árvore completa na Fase 4

## Step 4.4 — Script CLI

`scripts/aggregate-v2-instruments.ts`:

```bash
npx tsx scripts/aggregate-v2-instruments.ts --all
npx tsx scripts/aggregate-v2-instruments.ts --instrument idr:c:foundation
npx tsx scripts/aggregate-v2-instruments.ts --instrument idr:c:preop-regime --force
```

Após carga Fase 3, correr **`--all`** antes de testar `/render`.

## Step 4.5 — Testes

| Suite | O que cobre |
|-------|-------------|
| `aggregate-instrument.test.ts` | Ordem `position`; exclusão `deferred`; hash reproduzível; separadores |
| `doc-hub-facade.test.ts` | `resolveInstrumentDetail('idr:c:foundation')`; legado `idr:HUB-INSTR-*` com alias (mock ou BD) |
| `instrument-service` / regressão v1 | Instrumento v1 existente: comportamento inalterado (`structuralProfile=v1`) |
| `describeIfDb` | Persistência `InstrumentRevision` + `derived` `InstrumentVersion` para foundation |

Verificar manualmente (registar no handoff):
```bash
curl -sS "http://localhost:3000/api/doc-hub/v0/instruments/idr%3Ac%3Afoundation" | jq '.structuralProfile,.currentVersionRecord.contentSourceKind'
curl -sS "http://localhost:3000/api/doc-hub/v0/instruments/idr%3Ac%3Apreop-regime/render?mode=restricted" -H "Cookie: …"
```

## Step 4.6 — Commit (obrigatório)

```bash
cd hub-preop
git add lib/normative/aggregate-instrument.ts lib/normative/read-v2-instrument.ts \
  scripts/aggregate-v2-instruments.ts \
  lib/instrument-service.ts lib/doc-hub-facade.ts \
  lib/normative/immutability.ts \
  lib/doc-hub-facade.test.ts lib/normative/aggregate-instrument.test.ts \
  docs/handoff-passo-04.md
git status
git commit -m "$(cat <<'EOF'
feat(hub-preop): Phase 01 step 04 — v2 derived aggregate and DocHUB read path

Aggregate ClauseVersion trees into derived InstrumentVersion; InstrumentRevision
index; resolve semantic and legacy idrRef in facade; v1 read regression preserved.
EOF
)"
```

**Não** fazer `git push` salvo pedido do Pilot.

## Entregáveis
1. Módulo de agregado + script CLI
2. Integração leitura mínima (service + facade)
3. `docs/handoff-passo-04.md`
4. Commit na branch de feature

## Handoff — Passo 4 (template)

```markdown
## Handoff — Passo 4 (Fase 4)

- Branch / commit: …
- Agregado: foundation hash … · preop-regime hash …
- InstrumentRevision: rev 1 por documento? …
- Facade: idr:c:foundation GET OK · render OK · legado alias (se testado) …
- v1 regressão: N testes pass
- immutability + ledger TODO: fechado / pendente …
- npm test: …
- Próximo passo: Fase 5 (escrita / guards v1-v2)
- Riscos: …
```

## Critério de aceite (Pilot)
- [ ] `idr:c:foundation` e `idr:c:preop-regime` legíveis via `GET /api/doc-hub/v0/instruments/{docId}` com `content` derivado
- [ ] `/render` devolve Markdown agregado
- [ ] `InstrumentRevision` + junção com `clauseVersionIds` correctos
- [ ] Hash agregado reproduzível (teste)
- [ ] Instrumentos v1: testes de regressão verdes
- [ ] Commit criado; sem push
- [ ] `npm test` verde (com BD para suites de integração)

## Conflitos
Parar e reportar; não improvisar arquitectura.
```

---

## Variante curta (só agregado, sem facade)

```markdown
Executa Fase 4 Steps 4.1–4.2 e 4.5 (agregado + persistência + testes) apenas. **Não** alteres `doc-hub-facade` nem `instrument-service`. Entrega script CLI + handoff parcial. Commit com mensagem `feat(hub-preop): Phase 01 step 04a — v2 aggregate persistence only`.
```
