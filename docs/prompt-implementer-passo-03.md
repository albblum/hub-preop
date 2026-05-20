# Prompt do implementador — Passo 3 (Fase 3)

**Passo 3** = scripts de **carga piloto** do par constitucional v2 na BD lab.  
**Pré-requisitos:** Passo 1 (schema + migrate) e Passo 2 (`lib/normative/`) concluídos — ver [`handoff-passo-01.md`](./handoff-passo-01.md), [`handoff-passo-02.md`](./handoff-passo-02.md).  
**Plano:** [`work-plan-schema-v2-implementation.md`](./work-plan-schema-v2-implementation.md) — Fase 3.

---

## Decisão Pilot (obrigatória na carga)

**Quando houver ambiguidade de capitalização nos segmentos do path (`idrRef`, `articleCode`, `paragraphCode`, `clauseCode`, `code` de secção): usar só minúsculas.**

| Situação | Decisão |
|----------|---------|
| Mapa diz `§5-A` | Persistir e compor `§5-a` (parágrafo `5-a`) |
| Mapa / ADR exemplifica `art.I` | **Não usar** na Fase 3; o mapa PO usa `art.en` / `art.pt` |
| Código de documento | `foundation`, `preop-regime` (já minúsculas) |
| Normalização na carga | Função `normalizeSegmentCode(s: string): string` → `s.trim().toLowerCase()` antes de `composeIdrRef` / gravação |

Se a gramática actual (`CODE_LABEL` com maiúsculas) divergir, **ajustar `idr-ref-grammar.ts` e testes** para alinhar a esta decisão (minúsculas em todos os segmentos hierárquicos). Documentar no handoff.

---

## Estado Pilot (2026-05-18)

- Migrate v2 aplicada em lab; domínio v2 em `lib/normative/`.
- **Autorizado:** Fase 3 + **commit** na branch de trabalho (mensagem abaixo).
- Migração **atómica do par:** Foundation (s0+s2) + Norma completa (s0–s2).

---

## Prompt (copiar a partir da linha seguinte)

```markdown
# Implementador Hub-preop — Passo 3: Fase 3 (carga piloto v2)

## Papel
És o **AI Dev Machine** em **`hub-preop/`** apenas. O Pilot aprovou Fase 3 e **pede commit** ao final. Não alteres ADRs sem instrução.

## Objetivo
Carregar na BD lab dois instrumentos v2 conforme o mapa PO, usando `lib/normative/` (registry, `appendClauseVersion`, `composeIdrRef`, aliases). Secções `deferred` sem texto de cláusula. **Sem** Fase 4 (agregado), **sem** novas rotas HTTP, **sem** alterar `instrument-service` além de imports opcionais partilhados se já existirem utilitários reutilizáveis.

## Regra de capitalização (Pilot)
**Só minúsculas** em códigos de secção, artigo, parágrafo e cláusula ao gravar e ao compor `idrRef`. Normalizar com `toLowerCase()` na carga. Ver tabela em `prompt-implementer-passo-03.md`.

## Leitura obrigatória
1. `hub-preop/docs/migration-map-phase1-constitutional-pair.md` (tabelas 1 e 2 + critérios de aceite)
2. `hub-preop/docs/corpus-paths-phase1-v2.md`
3. `hub-preop/lib/normative/index.ts` (contrato público)
4. `hub-preop/scripts/ingest-constitutional-foundation.ts` (ordem `FILE_ORDER` + `idr:HUB-INSTR-*` legados — só referência para aliases)
5. Corpus:
   - `../AlblumZ deeds/IDR/02_Documentos/I. CONSTITUTIONAL FOUNDATION/*.md`
   - `../AlblumZ deeds/IDR/02_Documentos/Foudational Norm - Pre-Operational Stage.md`

## Escopo permitido
- `scripts/load-v2-constitutional-foundation.ts`
- `scripts/load-v2-preop-regime.ts`
- `lib/normative/load/` (opcional: parser Markdown partilhado, `normalize-segment.ts`, tipos)
- Ajuste mínimo em `lib/normative/idr-ref-grammar.ts` + testes se necessário para **minúsculas estritas**
- `docs/handoff-passo-03.md`
- Testes: parser unitário (sem BD) + smoke de carga com `describeIfDb` ou script `--dry-run`
- **Commit** único ou dois commits lógicos (ver secção Commit)

## Proibições
- **Não** implementar `aggregate-instrument.ts` nem `InstrumentVersion` derivado (Fase 4)
- **Não** apagar instrumentos v1 existentes; **não** converter monólitos in-place
- **Não** publicar `publishedAt` nas cláusulas salvo instrução Pilot (piloto em rascunho / `in-force` conforme decisão documentada no handoff)
- **Não** push nem PR sem pedido explícito
- **Não** editar fora de `hub-preop/`

## Tarefas (ordem)

### Step 3.0 — Parser e normalização
- Extrair de cada `.md` blocos EN/PT (cabeçalhos `## English` / `## Português` ou convenção do ficheiro).
- Mapear `§N`, alíneas `(i)(ii)…`, corpo único → nós `NormativeParagraph` + `NormativeClause`.
- **Gate 3.7:** antes de gravar Preamble PT, validar §6; se texto corrupto → **abortar** com mensagem clara (escalar Pilot).
- `normalizeSegmentCode` em todos os códigos antes de persistir.

### Step 3.1 — `load-v2-constitutional-foundation.ts`
Criar **um** `Instrument`:
| Campo | Valor |
|-------|--------|
| `idrRef` | `idr:c:foundation` |
| `structuralProfile` | `v2` |
| `semanticDocumentCode` | `foundation` |
| `documentType` | `constitutional` |
| `layer` | `0` |
| `title` | `I. Constitutional Foundation` |
| `status` | `in-force` (ou valor canónico já usado no Hub para constitucionais) |

**Secções:**
| code | position | migrationPhase | Conteúdo |
|------|----------|----------------|----------|
| `s0` | 0 | `pilot` | Preamble EN+PT — cláusulas completas do mapa |
| `s1` | 1 | `deferred` | Introduction — **só estrutura** (sem `ClauseVersion.body`) |
| `s2` | 2 | `pilot` | Article I — ficheiro `ARTICLE I · RIGHTS IN PRODUCED DATA.md` |
| `s3`–`s8` | 3–8 | `deferred` | só estrutura |

Fontes: `PREAMBLE.md` (s0), `ARTICLE I · RIGHTS IN PRODUCED DATA.md` (s2).

Por cláusula: TX com `registerIdrRef` + `appendClauseVersion` (versão 1). `idrRef` = `composeIdrRef` após normalização minúscula.

### Step 3.2 — Aliases legados
Após Foundation criado, para cada monólito v1 existente com `idr:HUB-INSTR-*` (consultar BD ou output histórico do ingest):

| Ficheiro legado (FILE_ORDER) | Alias sugerido |
|------------------------------|----------------|
| `PREAMBLE.md` | `legacyRef` → `idr:c:foundation` (documento) ou secção `s0` conforme política documentada |
| `ARTICLE I · RIGHTS IN PRODUCED DATA.md` | → `idr:c:foundation:s2` ou documento |
| Outros 7 ficheiros | → `idr:c:foundation` + secção `deferred` correspondente (`s1`, `s3`…`s8`) **sem** texto |

Usar `registerAlias` na mesma TX ou TX dedicada. Documentar tabela final no handoff.

### Step 3.3 — `load-v2-preop-regime.ts`
Criar **um** `Instrument`:
| Campo | Valor |
|-------|--------|
| `idrRef` | `idr:c:preop-regime` |
| `parentInstrumentId` | id interno de `idr:c:foundation` |
| `structuralProfile` | `v2` |
| `semanticDocumentCode` | `preop-regime` |
| `layer` | `1` |
| `status` | `foundational-provisional` |
| `terminationDate` | `2026-12-31` |
| `terminationRequiresExplicitAct` | `true` |
| `terminationAuthorizedBy` | `secretary_general` |
| `terminationConditions` | `["committees_constituted","committee_members_active","formal_act_by_secretary_general"]` |

**Secções:**
| code | position | nonNormative | Conteúdo |
|------|----------|--------------|----------|
| `s0` | 0 | false | Corpo EN — ficheiro completo secção EN |
| `s1` | 1 | false | Corpo PT — espelho; `§2.0` no fonte → parágrafo `2` (minúsculas) |
| `s2` | 2 | **true** | Change Log EN+PT |

Fonte: `Foudational Norm - Pre-Operational Stage.md`.

### Step 3.4 — Idempotência e CLI
Ambos os scripts:
- Flag `--dry-run`: percorre parser, imprime contagens e amostra de `idrRef`, **sem** TX.
- Re-run: upsert por `idrRef` (documento e cláusula) ou abortar se já existir com hash diferente — documentar comportamento escolhido no handoff.
- `npx tsx scripts/load-v2-constitutional-foundation.ts [--dry-run]`
- `npx tsx scripts/load-v2-preop-regime.ts [--dry-run]`

Ordem de execução: **Foundation primeiro**, depois Preop-regime.

### Step 3.5 — Verificação
- Contagem de `NormativeClause` e `IdrRefRegistry` vs mapa (amostragem PO).
- Query: secções `deferred` sem `ClauseVersion`.
- `npm test` verde (`SKIP_DB=1` ok para suites sem BD).
- `npx prisma validate`

### Step 3.6 — Commit (obrigatório)
Na pasta `hub-preop/`, branch `feat/hub-preop-schema-v2-phase1` (ou branch acordada):

```bash
cd hub-preop
git add lib/normative/ scripts/load-v2-*.ts lib/normative/load/ docs/handoff-passo-03.md
# incluir ajustes em idr-ref-grammar*.ts se houver
git status
git commit -m "$(cat <<'EOF'
feat(hub-preop): Phase 01 step 03 — load v2 constitutional pilot pair

Load idr:c:foundation (s0+s2 pilot, s1/s3-s8 deferred) and idr:c:preop-regime
with sunset metadata and non-normative s2; HUB-INSTR aliases; lowercase idrRef segments.
EOF
)"
```

**Não** fazer `git push` salvo pedido do Pilot.

## Entregáveis
1. Scripts de carga + parser partilhado (se aplicável)
2. `docs/handoff-passo-03.md` (template abaixo)
3. Commit na branch de feature
4. Log de execução `--dry-run` e execução real (contagens)

## Handoff — Passo 3 (template)

```markdown
## Handoff — Passo 3 (Fase 3)

- Branch: …
- Commit: …
- Foundation: idr:c:foundation — secções pilot/deferred; N cláusulas; N registry
- Preop-regime: idr:c:preop-regime — …
- Aliases HUB-INSTR: N linhas (tabela)
- Normalização minúsculas: alterações em idr-ref-grammar? sim/não
- PREAMBLE PT §6: validado / bloqueado
- dry-run / carga real: …
- npm test: …
- Próximo passo: Fase 4 (agregado + leitura)
- Riscos: …
```

## Critério de aceite (mapa PO + Pilot)
- [ ] Foundation s0+s2 com cláusulas desdobradas; s1,s3–s8 `deferred` sem texto
- [ ] Preop-regime s0–s2 completo; metadados sunset; s2 `nonNormative=true`
- [ ] Todos os `idrRef` de cláusulas em `IdrRefRegistry`
- [ ] Segmentos de path em **minúsculas**
- [ ] Aliases legados para monólitos Foundation
- [ ] Commit criado; sem push
- [ ] `npm test` verde

## Conflito spec / mapa
Parar e reportar ao Pilot; não improvisar.
```

---

## Variante curta (só dry-run)

```markdown
Executa Passo 3 em modo **--dry-run** apenas: parser + contagens + amostra de idrRef normalizados (minúsculas), sem TX na BD. Entrega handoff parcial. Sem commit até Pilot autorizar carga real.
```
