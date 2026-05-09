# Inventário AT2P-0 — autoridade normativa + transição em dois passos

## Objetivo do inventário (read-only)

Mapear os pontos de alteração para iniciar a evolução do MVP centrado em `HubRole`/`can*`
para um contrato de autoridade extensível por instrumento, preservando comportamento atual e
preparando o fluxo composto PRC → SG (ADR 0014), sem breaking changes REST.

## Ficheiros a tocar nesta fase

### Autoridade (novo contrato + adapter)

- `hub-preop/lib/authority/types.ts` (novo)
- `hub-preop/lib/authority/resolve-authority.ts` (novo)
- `hub-preop/lib/authority/index.ts` (novo)
- `hub-preop/lib/rbac.ts` (somente reutilização da lógica atual via adapter; sem remover `can*`)

### Rotas críticas (migração para resolver)

- `hub-preop/app/api/instruments/[id]/transition/route.ts`
- `hub-preop/app/api/committee/instruments/[id]/consultation/route.ts`
- `hub-preop/app/api/committee/instruments/[id]/deliberation/route.ts`
- `hub-preop/app/api/committee/instruments/[id]/formal-approval/route.ts`

### Actos e fluxo PRC → SG

- `hub-preop/lib/committee-acts.ts`

### Ledger / rastreabilidade

- `hub-preop/lib/ledger/append-ledger.ts` (estender payload de actos quando aplicável)
- `hub-preop/lib/ledger/entry-types.ts` (apenas se necessário novo tipo; preferência é reutilizar o atual)

### Testes

- `hub-preop/lib/authority/resolve-authority.test.ts` (novo)
- testes de rota em `hub-preop/app/api/**` (novos/ajustes para autorização e dependência PRC → SG)
- testes de actos em `hub-preop/lib/**` (novos/ajustes para vínculo causal mínimo)

## Comportamento atual preservado (compatibilidade obrigatória)

- `HubRole` e funções `can*` continuam existindo e operacionais nesta fase.
- Sem alteração de contratos REST existentes (códigos HTTP e formas de resposta mantidos).
- Sem mudança ampla do ciclo canônico de estados além do estritamente necessário para suportar o
  encadeamento PRC → SG.
- Sem dependências npm novas.

## Lacunas para o fluxo de dois passos (estado atual)

- A autorização está distribuída em checks diretos de rota (`canTransition` e guardas de workspace),
  sem um ponto único explicável de decisão normativa.
- `committeeFormalApproval` não exige explicitamente evidência de acto PRC prévio; hoje basta
  `status === "under-review"` para avançar.
- O ledger já regista actos de comité e transição, mas não garante metadados mínimos de
  encadeamento causal entre o acto PRC e o acto SG.
- O fluxo ainda admite, em caminhos alvo, conclusão de transição por ato efetivo de um único ator
  sem validação composta explícita PRC → SG.

## Riscos da intervenção

- Regressão de autorização (negação indevida ou permissão indevida) ao centralizar decisão.
- Deriva de compatibilidade de mensagens/HTTP nas rotas migradas.
- Endurecimento prematuro do modelo de estados sem decisão formal do Pilot.
- Acoplamento irreversível do resolver a detalhes de rota/DB.

## Estratégia de mitigação

- `resolveAuthorityForAction` inicia com adapter estritamente compatível com `can*` (fonte
  `role_based`/`hybrid`), sem alterar semântica decisória do MVP.
- Migração incremental apenas das quatro rotas críticas listadas.
- `reasonCode` estável e `normativeRefs` explícitas para diagnóstico e auditoria.
- Regras PRC → SG implementadas como guarda mínima reversível (sem reforma total de estado).

## Plano de rollback lógico

- Manter `can*` intacto e funcional para retorno rápido.
- Em rollback, as rotas voltam aos checks diretos atuais removendo apenas chamadas ao novo resolver.
- Guardas PRC → SG podem ser desativadas revertendo validações adicionadas em `committee-acts`.
- Metadados adicionais de ledger/eventos são aditivos e não quebram leitura do histórico existente.

## Critérios de aceite para sair do AT2P-0

- Inventário aprovado pelo Pilot.
- Escopo de alteração fechado aos módulos acima.
- Conflitos de governança/implementação inexistentes ou explicitamente decididos pelo Pilot antes
  do início do código.

