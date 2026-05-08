# Prompt — Implementador — T-2 Implementação: transição monólito → multiparte

Você é o Implementador, seguindo a metodologia Pilot + AI Dev Machine.

## Escopo deste documento

Este ficheiro é **apenas a fase T-2 (código, testes, documentação operacional)**. **Não** reexecutar T-0/T-1.

**Pré-requisitos fechados:**

- [ADR 0009](../../Docs/adr/0009-hub-preop-monolith-to-multipart-transition.md) — **Accepted**
- [Inventário T-1](./inventory-transicao-monolito-multiparte.md) — **Gate T-1 aprovado pelo Pilot**

Em caso de conflito entre este prompt, o inventário e o ADR, **prevalece o ADR**, depois o inventário.

---

## Objetivo

Implementar a operação que converte um instrumento **elegível** do perfil **monólito** para o perfil **multiparte mínimo** (uma `SECTION` na posição 1, texto da revisão corrente), conforme **ADR 0009** e a ordem de transação do **inventário T-1**, **sem** nova revisão, **sem** novo `entryType` no ledger, **sem** alterar `InstrumentVersion.content` nem `contentHash` da cabeça.

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md` (workspace)
2. `Docs/Methodology/pilot-machine-methodology.md`
3. `Docs/adr/0009-hub-preop-monolith-to-multipart-transition.md`
4. `hub-preop/docs/inventory-transicao-monolito-multiparte.md` (integral — especialmente «Escolhas fixadas», «Ordem lógica dentro de `$transaction`», «Testes»)
5. `hub-preop/app/api/instruments/[id]/content/route.ts` — padrão de `auth` + `canAppendContent`
6. `hub-preop/lib/instrument-service.ts` — `appendMultipartInstrumentVersion`, `getInstrumentById`, `isMonolithCompositionProfile` (via `part-composition`)
7. `hub-preop/lib/part-composition.ts` — `PART_KIND_SECTION`, `isMonolithCompositionProfile`, `mapInstrumentStatusToPartStatus` (import de `@/lib/domain/part-status` se necessário)

**Parar** e pedir decisão ao Pilot se algo estiver ambíguo ou em conflito com a spec.

---

## Entregáveis (checklist)

### 1. Domínio — `lib/instrument-service.ts`

- Exportar função (nome livre, sugestão: `transitionMonolithToMultipartProfile`) com assinatura do tipo:
  - entrada: `{ instrumentId: string; dryRun?: boolean }`
  - saída: se `dryRun === true`, objeto de **relatório** estável (JSON-serializável) com ids relevantes, `currentVersionRecordId`, ids da Part monólito / nova SECTION, e **metadados** do conteúdo (ex.: `contentLength`, opcionalmente prefixo do hash — **não** obrigatório logar o texto completo); se `dryRun === false`, retorno alinhado ao resto do serviço (ex.: `InstrumentDetail` via `getInstrumentById`) ou tipo documentado no handoff.
- Implementar pré-condições **ADR 0009 B** e idempotência **ADR 0009 G** (`ALREADY_MULTIPART_PROFILE` ou mensagem estável documentada).
- Executar passos **4–8** do inventário dentro de **uma** `prisma.$transaction` (passos **1–3** validação/dry-run conforme inventário).
- **Não** apagar a `Part` `MONOLITH_BODY`; **recomendação** do inventário: apagar só o `PartVersion` (revisão corrente + `partId` monólito) após criar o da SECTION.
- **Não** alterar `InstrumentVersion` (content / contentHash) da cabeça.
- **Não** criar linhas em `LedgerEntry` nem nova `InstrumentVersion`.

### 2. Feature flag

- Variável de ambiente **`TRANSITION_MONOLITH_TO_MULTIPART_ENABLED`**: quando `1` ou `true` (case-insensitive), permitir; caso contrário (**ausente**, `0`, `false`), a **rota HTTP** deve negar com corpo JSON claro (ex.: **403** `TRANSITION_DISABLED`) **sem** efeitos na BD.
- Documentar em `.env.example` (comentário curto).

### 3. API — `app/api/instruments/[id]/transition-to-multipart/route.ts`

- `POST` apenas; corpo JSON `{ "dryRun"?: boolean }` validado com Zod.
- Mesma política de sessão que `POST .../content`: não autenticado → **401**; sem `canAppendContent` → **403**; flag desligada → **403** (ou código acordado).
- Respostas JSON consistentes; erros de domínio mapeados para HTTP adequado (**400** / **409** / **404** — definir tabela mínima no código ou comentário da rota).

### 4. Validação — Zod

- Corpo opcional `dryRun`; ficheiro novo ou extensão de `lib/validation/instrument.ts` — seguir estilo existente.

### 5. Script opcional — `package.json`

- `transition:monolith-to-multipart` chamando `tsx` com os mesmos argumentos que o inventário (`--instrument-id`, `--dry-run`), lendo `DATABASE_URL` / reutilizando cliente Prisma; **sem** duplicar regra de negócio (chamar a função do `instrument-service`).

### 6. Testes — Vitest

- Cobrir a matriz do inventário: sucesso, dry-run sem persistência, já multiparte, sem cabeça, flag (testar rota ou função com `process.env` temporário, conforme padrão do repo).
- Preferir **BD de teste** se o projeto já o usa; caso contrário, mocks documentados — **não** deixar a suíte `test:no-db` mais frágil sem motivo.

### 7. Documentação — `docs/OPERATIONS.md`

- Secção **«Transição monólito → multiparte»**: flag, endpoint, exemplo `curl` autenticado (cookie/session), dry-run, limitação «um instrumento de cada vez», rollback = backup.

---

## Validação obrigatória antes de handoff

```bash
cd hub-preop
npm run lint
npm run test:no-db
npm run verify:reliability
```

Todos **sem falha**.

---

## Fora de escopo (não implementar)

- Migração em massa / lote.
- Backfill de revisões históricas para SECTION.
- Alteração a `schema.prisma`, fachada DocHUB v0, UI dedicada.
- Novas dependências npm sem aprovação explícita do Pilot.

---

## Checkpoint de commit (sugerido)

`feat(hub-preop): Phase T-2 — monolith to multipart transition API and service (ADR 0009)`

---

## Handoff (obrigatório)

Atualizar **`parallel-project-kit/docs/handoffs.md`** com tabela rápida:

| Item | Detalhe |
|------|---------|
| Rota | `POST /api/instruments/[id]/transition-to-multipart` |
| Flag | `TRANSITION_MONOLITH_TO_MULTIPART_ENABLED` |
| Serviço | nome da função exportada + ficheiro |
| Testes | ficheiros de teste novos |
| Limites | sem mass migrate; sem novo ledger entry |

**Próximo foco sugerido:** fachada DocHUB escrita multiparte (item 2 do `STATUS.md`), salvo orientação contrária do Pilot.

---

## Referência cruzada

- Prompt metodológico completo (T-0/T-1/T-2 resumidos): [prompt-implementador-fase-transicao-monolito-multiparte.md](./prompt-implementador-fase-transicao-monolito-multiparte.md)
