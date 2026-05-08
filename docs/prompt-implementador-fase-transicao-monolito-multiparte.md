# Prompt — Implementador — Fase transição monólito → multiparte (hub-preop)

Você é o Implementador, seguindo a metodologia Pilot + AI Dev Machine.

## Objetivo

Permitir que **instrumentos já existentes no perfil monolítico** (`MONOLITH_BODY`, uma entrada de composição) passem **de forma controlada e reversível** ao **perfil multiparte** (várias parts `SECTION` / `ANNEX`, **sem** `MONOLITH_BODY` na composição activa), **preservando** o texto da última versão oficial como fonte de verdade e respeitando os invariantes do **ADR 0008** (Decisão C).

O ADR 0008 declara esta transição **fora do MVP** até **sub-passos explícitos do Pilot**. Esta fase **só começa** depois de **ADR novo ou emenda** aceite pelo Pilot (ver «Fase T-0»).

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md` (workspace)
2. `Docs/Methodology/pilot-machine-methodology.md`
3. `Docs/adr/0008-hub-preop-multipart-editorial-mvp.md` (integral, em especial Decisão B–C e invariantes)
4. `Docs/adr/0009-hub-preop-monolith-to-multipart-transition.md` (fase T-0; ver Status)
5. `Docs/adr/0003-hub-preop-part-store-composition-mvp.md`
6. `Docs/adr/0004-hub-preop-part-status-two-level-mvp.md`
7. `hub-preop/lib/instrument-service.ts`, `hub-preop/lib/part-composition.ts`
8. `parallel-project-kit/STATUS.md`

Conflito de governança: **parar** e pedir decisão ao Pilot.

---

## Fase T-0 — ADR (obrigatório antes de código)

O ADR **`Docs/adr/0009-hub-preop-monolith-to-multipart-transition.md`** é o artefacto T-0 (**Accepted**). Não reabrir o texto salvo correcção de bugs de redacção ou emenda formal. O documento fixa **no mínimo**:

1. **Quem pode disparar** a transição (papéis RBAC).
2. **Pré-condições** (ex.: instrumento em estado X; sem composição ambígua; última versão existente).
3. **Estratégia de repartição do texto** — conforme **ADR 0009 Decisão C** (MVP: uma `SECTION` na posição 1 com o texto da revisão corrente; sem ANNEX obrigatório; sem cortes múltiplos nesta fase).
4. **Comportamento do ledger:** confirmar **sem** novos `entryType` salvo o Pilot decidir o contrário (padrão: alinhar ao ADR 0008 F).
5. **Reversibilidade:** feature flag ou passo de «dry-run» documentado; plano de rollback **conceptual** (mesmo que rollback seja «restaurar backup BD» em laboratório).
6. **Idempotência:** segunda chamada para o mesmo instrumento já convertido deve falhar com erro de domínio claro.

**Gate:** **ADR 0009** com **Status: Accepted** pelo Pilot.

---

## Fase T-1 — Inventário (read-only)

Ficheiro **`hub-preop/docs/inventory-transicao-monolito-multiparte.md`**:

- Ficheiros e funções a tocar (`instrument-service`, rotas API ou script operacional, Prisma se necessário).
- Transacção: lista de escritas na mesma `$transaction`.
- Testes: casos feliz, idempotência, instrumento já multiparte, instrumento sem versão.
- Riscos (downtime, tempo de lock, dados legados).

**Gate:** aprovação Pilot do inventário.

---

## Fase T-2 — Implementação

**Prompt executável (T-2 apenas):** [prompt-implementador-fase-transicao-t2-implementacao.md](./prompt-implementador-fase-transicao-t2-implementacao.md)

Resumo: implementar conforme **inventário T-1** (endpoint + serviço + flag + testes + OPERATIONS); script npm **opcional**. **Não** expandir para migração em massa sem passo separado aprovado.

---

## Validação

- `npm run lint`
- `npm run test:no-db` e **`npm run verify:reliability`**
- Testes Vitest novos cobrindo regras de domínio da transição (pode exigir mocks ou DB conforme padrão do repo).

---

## Checkpoint de commit (sugerido)

`feat(hub-preop): Phase T — monolith to multipart transition (ADR 0009)`

---

## Handoff (obrigatório)

Entrada em **`parallel-project-kit/docs/handoffs.md`**: ADR link, comando ou rota, limites (sem mass migrate), **próximo foco** sugerido: item 3 do `STATUS.md` (fachada DocHUB escrita multiparte) ou hardening adicional.
