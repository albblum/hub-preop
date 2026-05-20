# Prompt do implementador — Passo 1 (Fases 0 e 1)

**Passo 1** = preparação reversível + aplicação do schema Prisma v2 em **lab**.  
**Não inclui:** carga de dados (Fase 3), serviços de domínio (Fase 2), alterações de UI/API além do estritamente necessário para migrate.

Plano completo: [`work-plan-schema-v2-implementation.md`](./work-plan-schema-v2-implementation.md)

---

## Pré-requisito (Pilot)

**Estado Pilot (2026-05-18):** migrate **AUTORIZADO**. Passo 1 executado parcialmente — ver [`handoff-passo-01.md`](./handoff-passo-01.md) (deploy BD pendente: Docker/Postgres).

- Se **não autorizado:** executa apenas Steps **0.1**, **0.3**, **0.4** e relatório de diff schema — **para** antes de alterar `schema.prisma` ou correr migrate.

---

## Prompt (copiar a partir da linha seguinte)

```markdown
# Implementador Hub-preop — Passo 1: Fase 0 + Fase 1 (schema v2)

## Papel
És o **AI Dev Machine** no repositório da aplicação **`hub-preop/`** apenas (Git, commits e PRs só dentro desta pasta). O **Pilot** aprova gates; não tomes decisões de produto nem alteres ADRs sem instrução.

## Autorização migrate
Estado: **[AUTORIZADO | NÃO AUTORIZADO]** — preencher pelo Pilot antes de enviar o prompt.

Se **NÃO AUTORIZADO**: não modifiques `prisma/schema.prisma`, não executes `prisma migrate`, não faças commit de migração SQL.

## Objetivo deste passo
Concluir **Fase 0** (preparação + reversibilidade) e **Fase 1** (schema v2 em `schema.prisma` + migração aplicada em lab + client regenerado), sem carga de dados constitucionais e sem refatorar a aplicação Hub.

## Leitura obrigatória (nesta ordem, antes de codificar)
1. `docs/methodology/pilot-machine-methodology.md`
2. `hub-preop/docs/work-plan-schema-v2-implementation.md` — secções Fase 0 e Fase 1 apenas
3. `hub-preop/docs/spec-prisma-migration-v2-phase1.md`
4. `hub-preop/prisma/schema.v2-proposed.prisma` (fonte da verdade para o merge)
5. `hub-preop/prisma/schema.prisma` (estado actual)

## Escopo permitido
- Branch, backup BD lab, nota de rollback
- Merge `schema.v2-proposed.prisma` → `schema.prisma` (se autorizado)
- `npx prisma migrate dev --name schema_v2_normative_tree`
- CHECK SQL annex → pai na migração, se Prisma não gerar:
  `(NOT "isAnnex") OR ("parentInstrumentId" IS NOT NULL)`
- `npx prisma generate` e `npx prisma validate`
- Commit **somente** se o Pilot pediu commit; mensagem sugerida:
  `feat(hub-preop): Phase 01 step 01 — apply schema v2 normative tree migration`

## Proibições explícitas
- **Não** executar Fase 2+ (lib/normative, scripts de carga, APIs novas)
- **Não** alterar `lib/instrument-service.ts`, facade DocHUB, UI, RBAC, comité
- **Não** apagar ou migrar dados v1; **não** remover tabelas `Part`, `PartVersion`, `CompositionEntry`
- **Não** criar instrumentos `idr:c:foundation` / `idr:c:preop-regime` neste passo
- **Não** fazer push nem PR sem pedido explícito do Pilot
- **Não** editar ficheiros fora de `hub-preop/` (exceto leitura de corpus em `AlblumZ deeds/…` para Step 0.4)

## Tarefas (executar na ordem)

### Fase 0
| Step | Tarefa | Critério de feito |
|------|--------|-------------------|
| 0.1 | Criar branch `feat/hub-preop-schema-v2-phase1` a partir de `main` (ou branch que o Pilot indicar) | `git branch` confirma |
| 0.2 | Backup da BD lab conforme `hub-preop/docs/OPERATIONS.md` | Ficheiro dump com data no nome; caminho registado no relatório |
| 0.3 | Escrever em `hub-preop/docs/rollback-schema-v2-phase1.md` (criar): como reverter migrate + restaurar dump | Procedimento em ≤15 linhas, comandos copiáveis |
| 0.4 | Listar paths do corpus que a Fase 3 usará (Foundation + Norma) | Lista com paths absolutos ou relativos ao workspace; assinalar se algum ficheiro não existe |

### Fase 1 (só se **AUTORIZADO**)
| Step | Tarefa | Critério de feito |
|------|--------|-------------------|
| 1.1 | Diff e merge: `schema.v2-proposed.prisma` → `schema.prisma` | Sem drift não documentado; comentário no PR se houver ajuste manual |
| 1.2 | `cd hub-preop && npx prisma migrate dev --name schema_v2_normative_tree` | Pasta `prisma/migrations/*schema_v2*` criada |
| 1.3 | Se falta CHECK annex→pai, editar SQL da migração e reaplicar em lab limpo ou `migrate resolve` conforme política do Pilot | Constraint presente no SQL final |
| 1.4 | `npx prisma generate` | Client regenerado sem erro |
| 1.5 | `npx prisma validate`; opcional verificar defaults: coluna `structuralProfile` default `v1` em SQL de migração | Validate OK |

### Verificação pós-migrate (lab)
- Contar instrumentos existentes: todos devem manter comportamento v1 (`structuralProfile` = `v1` ou equivalente default).
- Confirmar que **nenhuma** tabela v1 foi removida.
- `npm test` — se falhar por tipos Prisma, reportar; **não** corrigir serviços neste passo salvo fix mínimo de compilação acordado com Pilot.

## Entregáveis no final da sessão
1. **Relatório** (markdown no chat ou `hub-preop/docs/handoff-passo-01.md`) com:
   - Autorização migrate: sim/não
   - Branch e commit hash (se houver)
   - Nome da migração Prisma e path do ficheiro SQL
   - Path do backup BD
   - Resultado `prisma validate` e `npm test` (pass/fail/skipped)
   - Lista corpus Step 0.4
   - Bloqueios ou perguntas ao Pilot
2. Ficheiro `rollback-schema-v2-phase1.md`
3. Se autorizado: `schema.prisma` + migração em `prisma/migrations/`

## Formato do relatório (usar exactamente estas secções)

```markdown
## Handoff — Passo 1 (Fases 0–1)

- Migrate autorizado: …
- Branch: …
- Backup: …
- Migração: `…` em `prisma/migrations/…`
- CHECK annex→pai: sim/não
- prisma validate: …
- npm test: …
- Instrumentos v1 na BD (contagem): …
- Corpus paths: …
- Próximo passo recomendado: Fase 2 (domínio) — aguardar OK Pilot
- Riscos / pendências: …
```

## Se encontrares conflito com spec ou ADR
Para. Lista o conflito. Não improvises solução arquitectural.

## Critério de aceite (Pilot)
- [ ] Backup verificado
- [ ] Rollback documentado
- [ ] (Se autorizado) Migrate aplicada; defaults v1 preservados; Part* intactas
- [ ] Nenhuma carga de dados piloto neste passo
```

---

## Variante curta (só Fase 0 — migrate não autorizado)

```markdown
Executa **Passo 1 parcial** do plano `hub-preop/docs/work-plan-schema-v2-implementation.md`: apenas Fase 0 (Steps 0.1, 0.3, 0.4). **Não** alteres `schema.prisma` nem corras `prisma migrate`. Entrega `rollback-schema-v2-phase1.md`, lista de corpus, branch `feat/hub-preop-schema-v2-phase1`, e handoff com secções do template acima. Repositório: só `hub-preop/`.
```
