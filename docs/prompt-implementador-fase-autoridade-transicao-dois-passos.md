# Prompt — Implementador — Fase autoridade normativa + transição em dois passos (hub-preop)

Você é o Implementador, seguindo a metodologia Pilot + AI Dev Machine.

## Objetivo

Iniciar a evolução do MVP de um modelo centrado em `HubRole`/`can*` para um modelo extensível de **autoridade por instrumento**, sem quebrar a operação atual, e preparar o fluxo de transição normativa para actos compostos de dois passos (**PRC → SG**), conforme ADR 0014.

Esta fase é de **arranque arquitetural**: criar os pontos de extensão corretos, migrar rotas críticas para o novo contrato e manter compatibilidade funcional.

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md` (workspace)
2. `docs/methodology/pilot-machine-methodology.md`
3. `hub-preop/docs/ADR-0014-autoridade-por-instrumento-e-transicao-dois-passos.md`
4. `hub-preop/lib/rbac.ts`
5. `hub-preop/lib/committee-acts.ts`
6. `hub-preop/app/api/committee/**` e `hub-preop/app/api/instruments/[id]/transition/route.ts`
7. `hub-preop/lib/ledger/append-ledger.ts` e `hub-preop/lib/ledger/entry-types.ts`

Conflito entre governança e implementação: **parar e pedir decisão do Pilot**.

---

## Restrições

- Não remover `HubRole` nem `can*` nesta fase.
- Não introduzir breaking changes em contratos REST já existentes.
- Não alterar sem decisão explícita o ciclo canônico de estados além do necessário para suportar PRC → SG.
- Não adicionar dependências npm novas sem aprovação do Pilot.
- Toda nova decisão de domínio deve ser reversível.

---

## Fase AT2P-0 — Inventário (read-only)

Criar `hub-preop/docs/inventory-autoridade-transicao-dois-passos.md` com:

- ficheiros a tocar (autoridade, rotas, acts, ledger, testes);
- comportamento atual preservado;
- lacunas para fluxo de dois passos;
- riscos e plano de rollback lógico.

**Gate:** aprovação do Pilot.

---

## Fase AT2P-1 — Contrato de autoridade (mínimo implementável)

Implementar um contrato central em `hub-preop/lib/authority/`:

- `resolveAuthorityForAction(context): AuthorityDecision`

### Contexto mínimo

- actor autenticado (id, roles, memberships);
- instrumento alvo;
- tipo de acto (`transition`, `committee_consultation_open`, `committee_deliberation`, `committee_formal_approval`, etc.);
- timestamp.

### Saída mínima

- `allowed: boolean`
- `reasonCode: string`
- `authoritySource: "role_based" | "instrument_based" | "hybrid"`
- `normativeRefs: string[]`

### Implementação desta fase

- Adapter inicial para lógica existente (`can*`), sem alterar decisão funcional do MVP.
- Resultado deve ser explicável e testável.

---

## Fase AT2P-2 — Migração de rotas críticas

Migrar checks diretos de autorização nas rotas normativas para o novo contrato:

- `app/api/instruments/[id]/transition/route.ts`
- `app/api/committee/instruments/[id]/consultation/route.ts`
- `app/api/committee/instruments/[id]/deliberation/route.ts`
- `app/api/committee/instruments/[id]/formal-approval/route.ts`

Manter respostas HTTP e mensagens atuais, adicionando apenas códigos/razões quando útil.

---

## Fase AT2P-3 — Preparação do fluxo PRC → SG

Sem ruptura total nesta fase:

- garantir que a aprovação SG depende de acto PRC registado;
- evitar transição final implícita por actor único em fluxos alvo;
- registrar encadeamento causal mínimo em ledger/eventos (quando aplicável).

Se necessário, criar campos auxiliares mínimos para referenciar acto anterior (somente com aprovação do Pilot em caso de migração Prisma adicional).

---

## Fase AT2P-4 — Auditoria e observabilidade mínima

- assegurar que cada acto crítico gera rastro claro;
- incluir metadados suficientes para reconstruir:
  - quem agiu;
  - em qual capacidade;
  - com base em qual decisão de autoridade;
  - qual acto anterior foi confirmado/complementado.

---

## Validação

- `npm run lint`
- `npm run test:no-db`
- testes novos para:
  - contrato `resolveAuthorityForAction`;
  - regras de autorização por rota migrada;
  - dependência PRC → SG quando aplicável.
- `npm run build`

Opcional/recomendado:

- `npm run verify:reliability`

---

## Checkpoint de commit (sugerido)

`feat(hub-preop): Phase AT2P — authority resolver + two-step transition groundwork`

Se metodologia exigir granularidade estrita: um commit para inventário/docs e outro para código/testes.

---

## Handoff (obrigatório)

Registar em `parallel-project-kit/docs/handoffs.md`:

- escopo AT2P executado;
- ficheiros alterados;
- decisões de compatibilidade mantidas;
- riscos pendentes;
- próximo passo recomendado (instrument-based authority real + composição PRC por instrumento de nomeação).

