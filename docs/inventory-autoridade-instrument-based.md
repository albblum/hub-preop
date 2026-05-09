# Inventário IBA-0 — autoridade institucional baseada em instrumento (read-only)

## Objetivo do inventário

Mapear o ponto de partida e a superfície de mudança para evoluir
`resolveAuthorityForAction` do modo **adapter RBAC** (entregue em AT2P) para um modo
**híbrido real**, capaz de ler autoridade institucional a partir da
`CommitteeMembership` ativa e do `authorityInstrumentId` registado, sem quebrar
contratos REST nem remover o fallback RBAC. Esta fase pressupõe a base AT2P já
entregue (resolver central + migração das 4 rotas críticas + guarda PRC → SG).

---

## Estado atual verificado (ponto de partida)

- Resolver central em `hub-preop/lib/authority/resolve-authority.ts`, tipos em
  `hub-preop/lib/authority/types.ts`, sinais em
  `hub-preop/lib/authority/instrument-membership.ts`, fachada em
  `hub-preop/lib/authority/index.ts` (entregue na fase IBA, ex.: commit `0aca80a`).
- `AuthorityDecision` inclui campos aditivos: `resolutionMode`
  (`instrument_first` | `hybrid_fallback` | `role_fallback`) e
  `authorityEvidence` (`committeeId`, `authorityInstrumentId` quando aplicável).
- `decideTransition` usa `canTransition` + sinal `resolveActorAuthorityAny`: quando
  só a membership concede a transição, o modo é `hybrid_fallback` (transição não
  sobe a `instrument_first` por desenho IBA).
- `decideCommitteeAction` usa `resolveActorAuthorityForCommittee`: com
  `authorityInstrumentId` na membership → `instrument_first` / `instrument_based`;
  membership sem nomeação → `hybrid_fallback` / `hybrid`; supervisor →
  `role_fallback` / `role_based`. Validação de `endedAt` no claim de sessão segue
  fora de escopo (claims só de memberships `active` no sign-in).
- Rotas críticas que já consomem o resolver:
  - `hub-preop/app/api/instruments/[id]/transition/route.ts`
  - `hub-preop/app/api/committee/instruments/[id]/consultation/route.ts`
  - `hub-preop/app/api/committee/instruments/[id]/deliberation/route.ts`
  - `hub-preop/app/api/committee/instruments/[id]/formal-approval/route.ts`
- `committeeFormalApproval` já exige acto PRC prévio (marcador
  `prc:deliberation_recorded` em `TransitionEvent.note`).
- Sessão (`hub-preop/auth.ts` + `types/next-auth.d.ts`) carrega
  `committeeMemberships: CommitteeMembershipClaim[]` com `committeeId`, `code`,
  `startedAt` e `authorityInstrumentId` (já resolvidos no `signIn` apenas para
  memberships com `status === "active"`). **Não** carrega `endedAt` nem `status`
  por claim, e o instantâneo não é refrescado entre sign-ins.
- Schema Prisma já tem `CommitteeMembership.authorityInstrumentId String?` e
  `endedAt DateTime?` com relação `Instrument @relation("CommitteeMembershipAuthority")`.
  **Nenhuma migração nova é estritamente necessária para esta fase.**

---

## Como ler a autoridade vigente nesta fase

### Fonte primária: `CommitteeMembership` ativa do ator

Para cada acção institucional, a leitura mínima é:

1. Ator identificado (`actor.id !== null`); caller anónimo cai imediatamente em
   ramo RBAC (sem mudança).
2. Memberships **ativas** do ator: `status === "active"` e (`endedAt IS NULL`
   OU `endedAt > timestamp`) — `startedAt <= timestamp`.
3. Para acções com escopo de comité (`committee_consultation_open`,
   `committee_deliberation`, `committee_formal_approval`), filtrar membership por
   `committeeId === instrument.committeeId`.
4. Para acções `transition` (instrumento sem escopo de comité no contrato
   actual), considerar membership **qualquer** do ator como base híbrida; o
   ramo `instrument_based` só se activa se o instrumento alvo trouxer
   `committeeId` no contexto (ver decisão D abaixo).

### Sinalização de qualidade

Para a membership efectivamente seleccionada, classificar:

- `instrument_linked` — membership ativa **e** `authorityInstrumentId` não nulo
  (acto de nomeação registado).
- `membership_only` — membership ativa **sem** `authorityInstrumentId`.
- `none` — sem membership ativa aplicável ao contexto.

### Regras mínimas de validade (MVP IBA)

- `status === "active"` é condição necessária. `suspended` ou `revoked` cai em
  `none` mesmo se houver `authorityInstrumentId`.
- `startedAt` no passado relativo ao `timestamp` do contexto.
- `endedAt` ausente ou no futuro relativo ao `timestamp`.
- Validade do **instrumento de nomeação** (estado, vigência) **não** é re-checada
  nesta fase — registo do `authorityInstrumentId` é tratado como prova
  declarativa suficiente para o sinal `instrument_linked`. Validação plena
  fica para fase posterior (ver «Limitações remanescentes»).

---

## Modos de resolução (a serem espelhados em `AuthorityDecision`)

Mapeamento entre qualidade da autoridade e novos campos aditivos:

| Qualidade | `resolutionMode`     | `authoritySource` |
| --------- | -------------------- | ----------------- |
| `instrument_linked` | `instrument_first` | `instrument_based` |
| `membership_only`   | `hybrid_fallback`  | `hybrid`           |
| `none` (mas RBAC permite) | `role_fallback` | `role_based`   |
| `none` (e RBAC nega) | `role_fallback`   | `role_based`       |

`authorityEvidence` (aditivo, opcional):

- `authorityInstrumentId?: string | null`
- `membershipId?: string | null`
- `committeeId?: string | null`

Regra de não-regressão: se RBAC actual concederia `allowed: true` para o
contexto, o novo resolver continua a conceder; pode mudar `authoritySource` /
`resolutionMode` (campos aditivos), mas **não** o `allowed`.

---

## Ficheiros a tocar nas fases IBA-1 / IBA-2 / IBA-3

### Domínio de autoridade (novo módulo + tipos aditivos)

- `hub-preop/lib/authority/instrument-membership.ts` (**novo** — IBA-1)
- `hub-preop/lib/authority/types.ts` (**aditivo** — IBA-2: `authorityEvidence`,
  `resolutionMode`; sem remover campos)
- `hub-preop/lib/authority/resolve-authority.ts` (IBA-2)
- `hub-preop/lib/authority/index.ts` (re-exportar tipos novos)

### Rotas críticas (apenas propagação de metadados)

- `hub-preop/app/api/instruments/[id]/transition/route.ts`
- `hub-preop/app/api/committee/instruments/[id]/consultation/route.ts`
- `hub-preop/app/api/committee/instruments/[id]/deliberation/route.ts`
- `hub-preop/app/api/committee/instruments/[id]/formal-approval/route.ts`

Ajuste mínimo: continuar a passar `authorityDecision` para os actos; os campos
extra fluem por estrutura (passagem por valor) sem mudança de assinatura.

### Actos / auditoria (payload aditivo)

- `hub-preop/lib/committee-acts.ts` — `AuthorityAuditSnapshot` ganha
  `resolutionMode` e `authorityEvidence` (campos opcionais); `authority_reason:`
  no `TransitionEvent.note` mantido para compatibilidade; **nada removido**.
- `hub-preop/lib/ledger/append-ledger.ts` / `entry-types.ts` — **sem** alterações
  (corpo do `appendCommitteeProcessLedger` já aceita `body: Record<string, unknown>`
  e o snapshot vai pelo `authorityDecision` existente).

### Testes

- `hub-preop/lib/authority/instrument-membership.test.ts` (**novo**)
- `hub-preop/lib/authority/resolve-authority.test.ts` (estender com casos
  `instrument_linked`, `membership_only`, `none`, mantendo os actuais)
- `hub-preop/app/api/instruments/[id]/transition/route.auth.test.ts` (estender:
  permissão por modo de resolução; manter casos 401/403 atuais)
- `hub-preop/app/api/committee/instruments/[id]/formal-approval/route.auth.test.ts`
  (estender: 200 com `instrument_first` mockado; 403 com `none`/RBAC nega)

### Sem alteração

- `hub-preop/prisma/schema.prisma` (sem migração nesta fase).
- `hub-preop/auth.ts` / `auth.config.ts` (claim de sessão já carrega
  `authorityInstrumentId`).
- `hub-preop/lib/rbac.ts` (`can*` preservado integralmente — fallback).

---

## Impacto por rota crítica

| Rota | `actionType` | Antes (AT2P) | Depois (IBA) | Risco de regressão |
| --- | --- | --- | --- | --- |
| `POST /api/instruments/[id]/transition` | `transition` | `role_based` via `canTransition` | mantém comportamento; `resolutionMode` e `authoritySource` podem mudar para `hybrid_fallback`/`hybrid` quando ator tem membership ativa, mas **`allowed` igual**. | Baixo — `decideTransition` não precisa do `committeeId` para conceder. |
| `POST /api/committee/instruments/[id]/consultation` | `committee_consultation_open` | `role_based` ou `hybrid` quando há *match* de membership | promove a `instrument_based`/`instrument_first` se membership tem `authorityInstrumentId`; restantes ramos preservados. | Baixo — caminho de negação inalterado (`INSTRUMENT_COMMITTEE_REQUIRED`, `COMMITTEE_ACTION_DENIED`). |
| `POST /api/committee/instruments/[id]/deliberation` | `committee_deliberation` | idem | idem | Baixo. |
| `POST /api/committee/instruments/[id]/formal-approval` | `committee_formal_approval` | idem; PRC → SG já guardado | idem; guarda PRC → SG **não** muda nesta fase. | Baixo — `PRC_ACT_REQUIRED` mantém-se. |

Códigos HTTP, formas de resposta e `reasonCode` existentes permanecem; novos
`reasonCode` são acrescentados apenas para distinguir modos (ex.:
`COMMITTEE_ACTION_ALLOWED_INSTRUMENT_LINKED`, `COMMITTEE_ACTION_ALLOWED_MEMBERSHIP`,
`COMMITTEE_ACTION_ALLOWED_RBAC`) — **sem reciclar** semântica dos existentes para
preservar consumidores.

---

## Riscos da intervenção

- Regressão silenciosa em `allowed` por bug de filtragem de membership
  (ex.: timezone em `endedAt`, `status` ignorado).
- Custo de leitura: se `instrument-membership` consultar BD a cada decisão de
  rota, adiciona latência por requisição vs. usar o claim de sessão já presente.
- Decisão depende de `actor.id !== null` para ramo institucional; rotas
  anónimas (não há entre as 4 críticas) caem em `role_based` por construção.
- Snapshot de sessão (`committeeMemberships`) é resolvido só no `signIn` —
  alterações em `CommitteeMembership` durante a sessão não se reflectem até
  re-autenticar. Cabe ao Pilot decidir se este caminho é aceitável para o MVP.
- Endurecimento prematuro do contrato `AuthorityDecision` (ex.: tornar
  `authorityEvidence` obrigatório) quebraria callers — **manter aditivo**.
- `authority_reason:<reasonCode>` no `TransitionEvent.note` ficará com novos
  códigos; alguma observabilidade externa que faça parsing por valor exacto
  precisa ser revisitada (não há, pelo que sabemos hoje).

---

## Estratégia de mitigação

- Função pura `resolveActorAuthorityForCommittee(...)` em
  `instrument-membership.ts` testável sem BD: aceita lista de
  `CommitteeMembershipClaim` + `committeeId` opcional + `timestamp` e devolve
  `{ quality, membershipId?, authorityInstrumentId?, committeeId? }`. Quando
  `endedAt` não estiver disponível por claim, considerar o claim como “ainda
  ativo” (decisão D2 abaixo) — função fica pronta para receber leitura fresca de
  BD numa fase posterior sem mudança de assinatura.
- `AuthorityDecision.authorityEvidence` e `resolutionMode` **opcionais** para
  manter retrocompatibilidade dos consumidores.
- Cobertura por matriz mínima em `resolve-authority.test.ts` (transition vs
  committee × `instrument_linked` vs `membership_only` vs `none`).
- Fallback RBAC permanece sempre como ramo final — remoção fica fora do escopo
  desta fase por restrição explícita do prompt.

---

## Decisões em aberto (precisam confirmação do Pilot antes de IBA-1)

- **D1 — Fonte de leitura das memberships.** Ler do claim de sessão
  (`session.user.committeeMemberships`) sem nova consulta à BD, *ou* fazer
  `prisma.committeeMembership.findMany` filtrado por `userId`/`committeeId`/
  `status`/datas a cada chamada de rota crítica? **Recomendação:** começar pelo
  claim (zero latência adicional, alinhado com AT2P) e deixar gancho para
  futura leitura fresca quando o Pilot decidir endurecer revogação em runtime.
- **D2 — Validade temporal sem `endedAt` no claim.** O claim actual não traz
  `endedAt`. Aceitamos o claim como prova de actividade (já filtrado no
  `signIn`)? **Recomendação:** sim para o MVP, registando explicitamente a
  limitação na auditoria/handoff.
- **D3 — Escopo de comité para `actionType: "transition"`.** A rota
  `/instruments/[id]/transition` não passa `instrument.committeeId` hoje. Para
  permitir `instrument_first` em transições, é preciso enriquecer o contexto
  (consulta extra do head) ou manter `transition` apenas em ramo
  `role_fallback`/`hybrid_fallback`. **Recomendação:** manter `transition` sem
  consulta extra ao head nesta fase (zero impacto em latência); só committee
  actions sobem para `instrument_first`.
- **D4 — Granularidade de `reasonCode` por modo.** Acrescentar
  `*_INSTRUMENT_LINKED` / `*_MEMBERSHIP` / `*_RBAC` ou manter o `reasonCode`
  actual e diferenciar apenas via `resolutionMode`? **Recomendação:** manter
  os actuais e diferenciar via `resolutionMode` (menos códigos novos para o
  consumidor REST). `normativeRefs` ganha referências adicionais quando
  aplicável.
- **D5 — Validação do estado do instrumento de nomeação.** Olhar
  `Instrument.status` do `authorityInstrumentId` (ex.: exigir
  `foundational-provisional` ou superior) já nesta fase, ou tratar em fase
  seguinte (nomeação PRC totalmente derivada por instrumento)? **Recomendação:**
  diferir — está fora do escopo IBA e exige decisão normativa do Pilot sobre
  estados aceites.

---

## Plano de rollback lógico

- IBA-1: módulo novo `instrument-membership.ts` é puro e isolado; remover o
  ficheiro e os testes restaura o estado AT2P.
- IBA-2: campos novos em `AuthorityDecision` são opcionais; reverter o
  `resolve-authority.ts` para a versão actual descarta o ramo institucional sem
  quebrar callers que continuem a ler apenas `allowed`/`reasonCode`/
  `authoritySource`/`normativeRefs`.
- IBA-3: payload de auditoria recebe campos opcionais; consumidores antigos do
  ledger continuam a ler corretamente — basta reverter as três rotas + o snapshot
  em `committee-acts.ts` para a forma anterior.
- Sem migração Prisma, sem alteração de schema, sem nova dependência npm —
  rollback é puramente revert de ficheiros TypeScript.

---

## Limitações remanescentes (após IBA, antes da próxima fase)

- Snapshot de sessão em vez de leitura ao vivo de `CommitteeMembership` —
  revogação em runtime só aplica após re-autenticação.
- Validade do instrumento de nomeação não é cruzada com o estado do
  `Instrument` (ver D5).
- Composição PRC ainda admite supervisores (`admin`/`registrar`) — eliminação
  do fallback administrativo é a fase seguinte sugerida.
- `actionType: "transition"` permanece em ramo majoritariamente RBAC.

---

## Critérios de aceite para sair do IBA-0

- Inventário aprovado pelo Pilot.
- Decisões D1–D5 acima resolvidas (mesmo que confirmando as recomendações).
- Escopo de alteração fechado aos módulos listados em «Ficheiros a tocar».
- Confirmação explícita de que **não** há migração Prisma nesta fase.
