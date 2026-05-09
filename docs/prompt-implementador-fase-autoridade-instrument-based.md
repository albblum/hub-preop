# Prompt — Implementador — Fase autoridade baseada em instrumento (hub-preop)

Você é o Implementador, seguindo a metodologia Pilot + AI Dev Machine.

## Objetivo

Evoluir o `resolveAuthorityForAction` do modo adapter RBAC para um modo **hybrid real** com leitura de autoridade institucional em fonte registada, mantendo compatibilidade do MVP e sem breaking changes REST.

Esta fase começa após a base AT2P já entregue (resolver central + migração de rotas críticas + guarda PRC → SG).

---

## Estado atual verificado (ponto de partida)

- `resolveAuthorityForAction` existe em `lib/authority/resolve-authority.ts`.
- Rotas críticas já usam o resolver (`transition` e actos de comité).
- `committeeFormalApproval` já exige acto PRC prévio.
- Working tree esperado para esta fase: limpo.

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md`
2. `docs/methodology/pilot-machine-methodology.md`
3. `hub-preop/docs/ADR-0014-autoridade-por-instrumento-e-transicao-dois-passos.md`
4. `hub-preop/lib/authority/types.ts`
5. `hub-preop/lib/authority/resolve-authority.ts`
6. `hub-preop/lib/committee-acts.ts`
7. `hub-preop/prisma/schema.prisma` (CommitteeMembership + authorityInstrumentId)

---

## Restrições

- Não remover fallback RBAC nesta fase.
- Não quebrar contratos das APIs já consumidas pela UI.
- Sem dependências novas npm.
- Mudanças Prisma apenas se estritamente necessárias e reversíveis.

---

## Fase IBA-0 — Inventário (read-only)

Criar `hub-preop/docs/inventory-autoridade-instrument-based.md` com:

- como ler autoridade vigente a partir de `CommitteeMembership` ativa + `authorityInstrumentId`;
- regras mínimas de validade (status, startedAt/endedAt);
- impacto por rota crítica;
- riscos e rollback.

Gate: aprovação do Pilot.

---

## Fase IBA-1 — Fonte institucional mínima

Implementar função de domínio (ex.: `lib/authority/instrument-membership.ts`) para resolver:

- memberships ativas do actor;
- vínculo opcional a instrumento de nomeação (`authorityInstrumentId`);
- sinalização de qualidade da autoridade:
  - `instrument_linked`
  - `membership_only`
  - `none`

Sem exigir nova tabela nesta fase.

---

## Fase IBA-2 — Resolver híbrido real

Atualizar `resolveAuthorityForAction` para:

1. usar decisão institucional quando houver `instrument_linked`;
2. usar decisão híbrida quando houver `membership_only`;
3. cair para RBAC quando não houver base institucional suficiente.

Atualizar `AuthorityDecision` com campos aditivos (sem breaking):

- `authorityEvidence` (ids relevantes, ex.: `authorityInstrumentId`);
- `resolutionMode` (`instrument_first`, `hybrid_fallback`, `role_fallback`).

---

## Fase IBA-3 — Rotas e auditoria

Nas rotas críticas já migradas:

- propagar os novos metadados de decisão para actos/ledger;
- incluir `reasonCode` e modo de resolução no payload de auditoria onde já existe `authorityDecision`.

---

## Validação

- `npm run lint`
- `npm run test:no-db`
- novos testes:
  - `lib/authority/*` cobrindo `instrument_linked`, `membership_only`, `none`;
  - rotas críticas com negação/permissão por modo de resolução.
- `npm run build`

---

## Checkpoint de commit (sugerido)

`feat(hub-preop): Phase IBA — hybrid instrument-based authority resolution`

---

## Handoff (obrigatório)

Atualizar `parallel-project-kit/docs/handoffs.md` com:

- decisões de resolução implementadas;
- limitações remanescentes;
- plano sugerido seguinte: nomeação PRC totalmente derivada por instrumento (sem fallback administrativo).

