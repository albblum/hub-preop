# Prompt do implementador — Passo 6 (Fase 6)

**Passo 6** = **verificação final**, evidências para o PO/Pilot, actualização de registry, **PR** e encerramento do ciclo schema v2 Fase 1.  
**Pré-requisitos:** Passos 1–5 concluídos — handoffs [`01`](./handoff-passo-01.md) … [`05`](./handoff-passo-05.md).  
**Plano:** [`work-plan-schema-v2-implementation.md`](./work-plan-schema-v2-implementation.md) — Fase 6.

**Nota:** Esta fase é sobretudo **validação e documentação**; evitar código novo salvo correções bloqueantes encontradas na verificação.

---

## Estado prévio (lab)

| Passo | Commit / estado (referência) |
|-------|------------------------------|
| 1 | Migrate `20260518120000_schema_v2_normative_tree` |
| 2 | `lib/normative/*` |
| 3 | Carga `idr:c:foundation` + `idr:c:preop-regime` |
| 4 | Agregado derived + facade |
| 5 | `POST …/clauses/{clauseId}/versions` + guards v1/v2 |

Branch: `feat/hub-preop-schema-v2-phase1`

---

## Prompt (copiar a partir da linha seguinte)

```markdown
# Implementador Hub-preop — Passo 6: Fase 6 (verificação + PR + encerramento)

## Papel
És o **AI Dev Machine** em **`hub-preop/`** (PR e commits na app) e, para registry/ADR na raiz do workspace, apenas ficheiros explicitamente listados abaixo. O **Pilot** aprova o PR e a decisão sobre `publishedAt`.

## Objetivo
1. Provar que o **piloto Fase 1** cumpre os critérios do mapa PO e os critérios de aceite das Fases 1–5.
2. Consolidar evidências reproduzíveis (comandos, queries, logs).
3. Actualizar **System registry** e documentação de ciclo.
4. Abrir **Pull Request** (ou entregar corpo do PR + diff pronto se o Pilot preferir abrir manualmente).
5. Registar decisão Pilot sobre **`publishedAt`** no piloto (sem implementar mudança de política salvo instrução).

## Leitura obrigatória
1. `hub-preop/docs/migration-map-phase1-constitutional-pair.md` — § Critérios de aceite do mapa
2. Handoffs `handoff-passo-01.md` … `handoff-passo-05.md`
3. `hub-preop/docs/phase5-out-of-scope.md`
4. `hub-preop/docs/rollback-schema-v2-phase1.md`
5. `System registry.MD` (raiz workspace) — `AR-016` … `AR-020`
6. `parallel-project-kit/STATUS.md` (se existir — actualizar secção Hub v2)

## Escopo permitido
- `docs/handoff-passo-06.md` — relatório final
- `docs/pilot-evidence-phase1-v2.md` — checklist + outputs de comandos (opcional mas recomendado)
- Actualizar `System registry.MD` (raiz) e `parallel-project-kit/STATUS.md`
- Correcções **mínimas** bloqueantes (bug na verificação) — documentar no handoff
- **Commit(s)** na branch de feature
- **`gh pr create`** se o Pilot pediu PR explícito neste passo
- **Não** nova migração Prisma, **não** nova fase de produto (s1–s8, UI comité)

## Proibições
- **Não** `prisma migrate reset` em ambiente partilhado sem OK Pilot
- **Não** force-push a `main`
- **Não** alterar ADRs sem instrução
- **Não** expandir âmbito para Foundation s1/s3–s8 ou landing page

---

## Step 6.1 — Suite automatizada

```bash
cd hub-preop
docker compose up -d
npx prisma validate
npx prisma migrate deploy   # confirmar sem pendentes
npm test                    # com BD
SKIP_DB=1 npm test          # registar pass/skip
npx eslint . --max-warnings 0   # se o projecto usa eslint no CI
```

Registar no handoff: contagens exactas, versão Node, hash do último commit da branch.

**Regressão v1:** confirmar que testes de `createInstrument`, `appendInstrumentVersion`, transition monolith/multipart em v1 continuam verdes.

---

## Step 6.2 — Checklist manual (mapa PO)

Executar e colar resultados resumidos em `pilot-evidence-phase1-v2.md`.

### A) Foundation (`idr:c:foundation`)

| # | Critério | Como verificar |
|---|----------|----------------|
| A1 | s0 + s2 com cláusulas e texto | SQL: contagem `NormativeClause` por secção; amostra `idrRef` |
| A2 | s1, s3–s8 `deferred` sem `ClauseVersion.body` | SQL: secções com `migrationPhase=deferred` e zero versões |
| A3 | Ordem secções position 0,1,2,… | `SELECT code, position, "migrationPhase" FROM "NormativeSection" WHERE … ORDER BY position` |
| A4 | Agregado derived legível | `curl` GET facade + `/render` |
| A5 | Resolução `idrRef` semântico | `curl` `idr%3Ac%3Afoundation` e uma cláusula piloto |

Queries SQL sugeridas:

```sql
-- Instrumentos v2 piloto
SELECT "idrRef", "structuralProfile", "currentVersion" FROM "Instrument"
WHERE "idrRef" IN ('idr:c:foundation', 'idr:c:preop-regime');

-- Secções Foundation
SELECT code, position, "migrationPhase", "nonNormative"
FROM "NormativeSection" s
JOIN "Instrument" i ON i.id = s."instrumentId"
WHERE i."idrRef" = 'idr:c:foundation'
ORDER BY position;

-- Cláusulas por secção (amostra)
SELECT s.code, COUNT(c.id) AS clauses
FROM "NormativeSection" s
JOIN "NormativeArticle" a ON a."sectionId" = s.id
JOIN "NormativeParagraph" p ON p."articleId" = a.id
JOIN "NormativeClause" c ON c."paragraphId" = p.id
JOIN "Instrument" i ON i.id = s."instrumentId"
WHERE i."idrRef" = 'idr:c:foundation'
GROUP BY s.code, s.position ORDER BY s.position;
```

### B) Preop-regime (`idr:c:preop-regime`)

| # | Critério | Como verificar |
|---|----------|----------------|
| B1 | s0–s2 completos | Contagem cláusulas ~57 (handoff-03); ajustar se parser mudou |
| B2 | Metadados sunset | `terminationDate`, `terminationRequiresExplicitAct`, `terminationAuthorizedBy`, `terminationConditions` |
| B3 | `s2` `nonNormative=true` | SQL + GET facade `sectionsSummary` |
| B4 | `parentInstrumentId` → foundation | SQL join |
| B5 | §5(ii) no texto (data referência) | Amostra `ClauseVersion.body` em `…:§5:cl:3` EN/PT |

```bash
curl -sS "http://localhost:3000/api/doc-hub/v0/instruments/idr%3Ac%3Apreop-regime" \
  | jq '.structuralProfile,.terminationDate,.sectionsSummary'
```

### C) Convivência v1/v2 (Fase 5)

| # | Critério | Como verificar |
|---|----------|----------------|
| C1 | v1 count inalterado (27 ou valor handoff-01) | `SELECT COUNT(*) FROM "Instrument" WHERE "structuralProfile"='v1'` |
| C2 | POST `/content` em v2 → 400 | Teste manual ou teste automatizado existente |
| C3 | POST cláusula v2 → nova versão + agregado | Um POST piloto + GET render |

### D) Registry `IdrRef`

```sql
SELECT COUNT(*) FROM "IdrRefRegistry";
-- Deve cobrir documento + todas as cláusulas piloto
```

Marcar cada linha ✅ / ❌ / ⚠️ no ficheiro de evidências.

---

## Step 6.3 — System registry e STATUS

Actualizar na **raiz do workspace** `System registry.MD`:

| ID | Actualização sugerida |
|----|------------------------|
| AR-017 | `migrate applied` + piloto lab carregado |
| AR-019 | `Implemented` — Fases 0–5 lab |
| AR-020 | `Completed` — plano executado |
| (novo) AR-021 | `hub-preop/docs/handoff-passo-06.md` — evidência encerramento piloto |

**Open Gaps:** remover ou actualizar linha “próximo: Fase 2/3”; acrescentar itens **fora de âmbito** (s1–s8, aliases quando monólitos existirem, UI).

**Change log:** entrada 2026-05-18 (ou data actual) — piloto v2 Fase 1 verificado em lab.

Se existir `parallel-project-kit/STATUS.md`, parágrafo curto: schema v2 piloto em lab; PR #… pendente merge.

---

## Step 6.4 — Pull Request

### Pré-PR

```bash
cd hub-preop
git status
git log main..HEAD --oneline
git diff main...HEAD --stat
```

Confirmar: sem `.env`, sem `backups/*.dump` no commit.

### Push (só se Pilot autorizar)

```bash
git push -u origin feat/hub-preop-schema-v2-phase1
```

### Criar PR (`gh`)

```bash
cd hub-preop
gh pr create --title "feat(hub-preop): constitutional schema v2 phase 1 pilot" --body "$(cat <<'EOF'
## Summary
- Schema v2 (normative tree, ClauseVersion, IdrRefRegistry) with strangler coexistence for v1 instruments.
- Pilot load: `idr:c:foundation` (s0+s2) and `idr:c:preop-regime` (s0–s2, non-normative change log).
- Derived aggregate + DocHUB read path; clause-level write API for v2 with v1 write guards.

## Test plan
- [ ] `npx prisma validate` and `npm test` (with Postgres)
- [ ] `SKIP_DB=1 npm test`
- [ ] Manual: GET `idr:c:foundation` and `idr:c:preop-regime` via doc-hub v0
- [ ] Manual: Foundation sections order s0,s1…s8; s1/s3–s8 deferred without clause bodies
- [ ] Manual: preop `s2` shows `nonNormative: true` in API
- [ ] Manual: POST clause version on v2 updates derived render
- [ ] Manual: POST `/content` on v2 instrument returns 400
- [ ] Regression: v1 instrument append content still works

## Rollback
See `hub-preop/docs/rollback-schema-v2-phase1.md` (restore dump + revert migrate) and revert PR.

## Out of scope (follow-up)
- Foundation s1, s3–s8 content load
- Committee UI for per-clause edit
- ADR 0011 / 0012

## Pilot sign-off
- [ ] Map criteria (`migration-map-phase1-constitutional-pair.md`) accepted by PO
- [ ] Decision on `publishedAt` for pilot instruments: _____________

EOF
)"
```

Devolver **URL do PR** no handoff.

Se `gh` indisponível: entregar corpo markdown completo para o Pilot colar no GitHub.

---

## Step 6.5 — Decisão `publishedAt` (Pilot)

No `handoff-passo-06.md`, secção obrigatória:

| Opção | Descrição |
|-------|-----------|
| **A** | Manter piloto **sem** `publishedAt` (rascunho / `in-force` só no instrumento) |
| **B** | Publicar nós piloto (`publishedAt` preenchido) — requer script ou acto documentado |
| **C** | Adiar decisão — bloquear merge até PO |

O implementador **não** aplica B sem ordem escrita do Pilot.

---

## Step 6.6 — Commit (obrigatório)

Commit na branch de feature (docs + registry):

```bash
# Na raiz do workspace (registry) — se alterado:
git add System\ registry.MD parallel-project-kit/STATUS.md

cd hub-preop
git add docs/handoff-passo-06.md docs/pilot-evidence-phase1-v2.md
git status

# Um commit hub-preop:
git commit -m "$(cat <<'EOF'
docs(hub-preop): Phase 01 step 06 — pilot verification evidence and final handoff
EOF
)"

# Se registry na raiz for repo separado ou mesmo repo — seguir estrutura real do workspace;
# o Pilot definiu hub-preop/ como repo Git da app: registry pode estar fora — commit registry
# apenas se a raiz Cursor_project1 for o mesmo remote ou em commit separado conforme convenção.
```

**Convenção deste projecto:** Git da app = **`hub-preop/`** apenas. Ficheiros `System registry.MD` na raiz: incluir no handoff como **pendência Pilot** para commit manual na raiz, ou commit separado se o Pilot o pedir.

Mensagem alternativa se registry for commitado pelo Pilot na raiz:

```
docs: update system registry for schema v2 phase 1 pilot completion
```

**Não** push sem pedido explícito (excepto se Step 6.4 já autorizou push para PR).

---

## Entregáveis

1. `docs/handoff-passo-06.md`
2. `docs/pilot-evidence-phase1-v2.md` (checklist preenchida)
3. System registry actualizado (ou nota “Pilot commit na raiz”)
4. URL do PR ou corpo do PR pronto
5. Commit(s) documentados

## Handoff — Passo 6 (template)

```markdown
## Handoff — Passo 6 (Fase 6) — ENCERRAMENTO PILOTO LAB

- Branch: …
- Commits (range main..HEAD): …
- npm test (BD / SKIP_DB): …
- prisma validate / migrate deploy: …
- Checklist mapa PO: A1–A5 … B1–B5 … C1–C3 … (✅/❌)
- IdrRefRegistry count: …
- PR: <url> ou pendente
- publishedAt decisão Pilot: A / B / C — …
- Registry: AR-017/019/020/021 actualizados? …
- Itens abertos pós-piloto: …
- Recomendação: merge / não merge até …
```

## Critério de aceite (Pilot + PO)
- [ ] Todos os critérios do mapa § Critérios de aceite verificados e assinalados
- [ ] `npm test` verde com BD
- [ ] PR aberto com test plan e rollback
- [ ] Registry reflecte estado “piloto lab completo”
- [ ] Decisão `publishedAt` registada
- [ ] Sem secrets nem dumps no PR

## Se verificação falhar
Abrir lista de defeitos com severidade; **não** mergear; opcionalmente revert para commit pré-carga com rollback doc.
```

---

## Variante curta (só evidências, sem PR)

```markdown
Executa Fase 6 Steps 6.1–6.2 e 6.6: testes + checklist SQL/curl + `handoff-passo-06.md` + `pilot-evidence-phase1-v2.md`. **Não** abras PR nem push. Commit docs apenas.
```
