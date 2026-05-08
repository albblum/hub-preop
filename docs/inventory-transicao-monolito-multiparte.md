# Inventário — Transição monólito → multiparte (T-1)

**ADR:** [ADR 0009 — Transição controlada monólito → multi-Part](../../Docs/adr/0009-hub-preop-monolith-to-multipart-transition.md) (Accepted)  
**Prompt T-2 (implementação):** [prompt-implementador-fase-transicao-t2-implementacao.md](./prompt-implementador-fase-transicao-t2-implementacao.md) · [visão geral T-0–T-2](./prompt-implementador-fase-transicao-monolito-multiparte.md)

---

## Escolhas fixadas neste inventário (superfície T-2)

| Tópico | Decisão |
|--------|---------|
| Superfície primária | **Endpoint** `POST /api/instruments/[id]/transition-to-multipart` com corpo JSON `{ "dryRun"?: boolean }`. |
| Núcleo de domínio | Função exportada em `lib/instrument-service.ts`, por exemplo `transitionMonolithToMultipartProfile({ instrumentId, dryRun })`, invocada pela rota. |
| Script CLI | **Opcional** na mesma entrega: `npm run transition:monolith-to-multipart -- --instrument-id <id> [--dry-run]` chamando a mesma função (evita duplicar lógica). |
| Feature flag | `TRANSITION_MONOLITH_TO_MULTIPART_ENABLED` — quando `0`, `false` ou ausente, a rota responde **403** ou **503** com mensagem estável (definir uma; testar). Quando `1` ou `true`, operação permitida. |
| Códigos de erro | `DomainError` (ou variantes) com mensagens estáveis: pré-condição falhou, `ALREADY_MULTIPART_PROFILE`, flag desligada, instrumento não encontrado. |

---

## Ficheiros a tocar

| Área | Ficheiros |
|------|-----------|
| Domínio | `hub-preop/lib/instrument-service.ts` — nova função; possivelmente tipo de retorno `{ dryRun: true, report: … }` vs `InstrumentDetail`. |
| Erros | `hub-preop/lib/domain/transitions.ts` (`DomainError`) — reutilizar; evitar `throw new Error` genérico em caminhos de produto. |
| Composição | `hub-preop/lib/part-composition.ts` — **leitura apenas** para reutilizar `isMonolithCompositionProfile`, `mapInstrumentStatusToPartStatus`, constantes `PART_KIND_*`; **ou** import mínimo na nova função. |
| API | `hub-preop/app/api/instruments/[id]/transition-to-multipart/route.ts` — novo; espelhar RBAC de `app/api/instruments/[id]/content/route.ts` (`canAppendContent`, `auth()`). |
| Validação | `hub-preop/lib/validation/instrument.ts` (ou ficheiro dedicado) — schema Zod para corpo `{ dryRun?: boolean }`. |
| Testes | `hub-preop/lib/instrument-service.transition-monolith.test.ts` (nome ajustável) ou extensão de suíte existente — preferir testes com Prisma mock / transação isolada conforme padrão do repo. |
| Docs | `hub-preop/docs/OPERATIONS.md` — secção curta: flag, endpoint, exemplo `curl`, dry-run. |
| Package | `hub-preop/package.json` — script opcional `transition:monolith-to-multipart`. |

**Sem alteração obrigatória nesta fase:** `schema.prisma`, fachada DocHUB v0, UI.

---

## Comportamento a preservar

- Pós-transição, `getInstrumentById` / `attachCompositionDetailFields` devem reportar `compositionProfile: "multipart"` e `multipartSegments` com uma `SECTION` e texto = conteúdo corrente.
- `appendInstrumentVersion` (**monólito**) deve continuar a falhar para esse instrumento; `appendMultipartInstrumentVersion` deve passar a ser o caminho de nova revisão.
- Revisões **anteriores** à corrente: leitura canónica via `InstrumentVersion.content` e `PartVersion` da Part `MONOLITH_BODY` **inalteradas** (sem backfill obrigatório).
- Ledger: **nenhuma** nova entrada; `VERSION_RECORDED` existente mantém-se ligado à mesma `InstrumentVersion`.

---

## Ordem lógica dentro de `prisma.$transaction` (T-2)

Ordem sugerida (ajustar se o Prisma exigir por FKs — hoje `CompositionEntry` aponta para `Part`; criar Part SECTION antes de trocar composição):

1. **Bloqueio / leitura:** carregar `Instrument` com `currentVersionRecord`, Part monólito via `CompositionEntry` posição 1, validar pré-condições ADR 0009 B (incl. `isMonolithCompositionProfile`, uma entrada, `markdownBody === null` na `PartVersion` monólito da cabeça).
2. **Idempotência:** se a composição activa já for multiparte (sem `MONOLITH_BODY` na posição 1 / perfil não monólito conforme regra ADR G), falhar `ALREADY_MULTIPART_PROFILE`.
3. **Dry-run:** se `dryRun === true`, devolver relatório JSON (ids: instrumento, `currentVersionRecordId`, part monólito, texto a copiar — hash ou tamanho, não necessariamente conteúdo completo em log) e **rollback** da transação sem escritas — ou não abrir transação de escrita; implementação pode usar transação só-leitura + retorno antecipado.
4. Criar **`Part`** `SECTION` com `partStatus = mapInstrumentStatusToPartStatus(instrument.status)`.
5. Criar **`PartVersion`** para `(novo partId SECTION, currentVersionRecordId)` com `markdownBody = instrumentVersion.content` (cópia literal), `contentHash` e `ordinal = 1` alinhados ao padrão de `syncMultipartPartVersionsForInstrumentVersion` (mesmos valores que a revisão monólito usava para `contentHash` na linha `InstrumentVersion`).
6. **Remover** `CompositionEntry` da posição 1 que apontava para a Part `MONOLITH_BODY`.
7. Criar **`CompositionEntry`** posição 1 apontando para a nova Part `SECTION`.
8. **Recomendação:** apagar **`PartVersion`** da revisão corrente onde `partId =` Part monólito, para a cabeça não ficar com dois vínculos (monólito + SECTION) na mesma `InstrumentVersion`. *Não* apagar `Part` monólito nem `PartVersion` de revisões antigas.

Passos 4–8 devem ser **atómicos**; qualquer falha → rollback completo.

---

## PartVersion da cabeça — paridade técnica

- Reutilizar a mesma regra de `contentHash` em `PartVersion` que já se usa em multipart: igual a `InstrumentVersion.contentHash` da revisão corrente (já verificado em `appendMultipartInstrumentVersion`).
- `ordinal` = `1` (posição na composição).

---

## Testes a adicionar (Vitest)

| Caso | Expectativa |
|------|-------------|
| Sucesso | Instrumento monólito elegível → após chamada, `isMonolithCompositionProfile` falso, um `SECTION` na composição, `multipartSegments` coerentes; conteúdo agregado da cabeça inalterado. |
| Dry-run | Sem escritas persistentes (usar BD de teste ou mock; contar linhas antes/depois ou transação abortada). |
| Já multiparte | `ALREADY_MULTIPART_PROFILE` (ou mensagem estável). |
| Sem revisão corrente | Erro de domínio. |
| Flag desligada | Resposta de negação sem alterar dados. |
| Regressão | `npm run test:no-db` / `verify:reliability` após implementação. |

*(Detalhe de mock vs DB live: seguir padrão dos testes existentes de `instrument-service`.)*

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Leitores que assumem «uma PartVersion por revisão» | Documentar que a cabeça tem só SECTION na composição; histórico mantém monólito. |
| Export/audit que lista todas as `PartVersion` da cabeça | Apagar `PartVersion` monólito só na revisão corrente reduz duplicidade. |
| Corrida: duas transições simultâneas | Transação serializável ou lock pessimista no `Instrument` — avaliar em T-2; documentar «um operador por instrumento» em OPERATIONS. |
| Tempo de lock | Operação pequena (poucas linhas); aceitável para protótipo. |

---

## Rollback operacional

- Sem rollback automático de aplicação; restaurar **backup** PostgreSQL conforme `OPERATIONS.md`.

---

## Gate T-1

- [x] Inventário redigido (2026-05-08).
- [x] **Aprovação Pilot** antes de iniciar T-2 (implementação) — **aprovado em 2026-05-08** (Pilot).

---

## Handoff pós-T-2 (lembrar)

- Atualizar `parallel-project-kit/docs/handoffs.md` com endpoint, flag, e limites (sem migração em massa).
