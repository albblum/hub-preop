# Prompt — Implementador — Fase Multi-Part editorial (MVP)

Você é o Implementador, seguindo a metodologia Pilot + AI Dev Machine.

## Objetivo

Introduzir **edição e composição multi-Part** alinhada ao espírito DocHUB (Part Store + Composition Registry), **sem** quebrar o perfil monolítico existente: instrumentos actuais continuam com uma única `MONOLITH_BODY`; instrumentos novos (ou opt-in) podem ter **várias Parts** ordenadas, cada uma com texto próprio no nível da versão.

**Princípio de compatibilidade (byte-identical mindset):** enquanto um instrumento tiver apenas `MONOLITH_BODY` com o comportamento actual, o resultado observável (API pública, hash da versão, ledger `VERSION_RECORDED`) deve permanecer equivalente ao pré-fase, salvo correção de bug documentada.

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md` (workspace)
2. `Docs/Methodology/pilot-machine-methodology.md`
3. `Docs/adr/0001-hub-preop-doc-hub-vocabulary-mapping.md`
4. `Docs/adr/0003-hub-preop-part-store-composition-mvp.md`
5. `Docs/adr/0004-hub-preop-part-status-two-level-mvp.md`
6. `Docs/adr/0002-hub-preop-conceptual-ledger.md` (ledger inalterado neste MVP)
7. `hub-preop/lib/part-composition.ts`, `hub-preop/lib/instrument-service.ts`
8. `hub-preop/app/api/instruments/[id]/content/route.ts`
9. [DocHUB — Product Specification](../../AlblumZ%20deeds/IDR/DocHUB%20%E2%80%94%20Product%20Specification.md) §3.3–3.4 (Part Store, Composition) — ajustar caminho relativo se o repo for clonado sem a pasta `AlblumZ deeds` na raiz do workspace.

Conflito de governança: **parar** e pedir decisão ao Pilot.

---

## Fase MP-0 — ADR (obrigatório antes de código)

Criar **`Docs/adr/0008-hub-preop-multipart-editorial-mvp.md`** (número ajustar se já existir) com **Status: Proposed** até aceitação do Pilot. O ADR deve fixar:

### Decisão A — Onde vive o texto por Part

- Acrescentar campo opcional em **`PartVersion`**, por exemplo **`markdownBody`** (`String?` / `Text`), **nulo** no perfil monolítico actual.
- **Regra:** para `partKind === MONOLITH_BODY`, `markdownBody` permanece **`null`**; o texto canónico lê-se de `InstrumentVersion.content` (comportamento actual ADR 0003).
- Para Parts editoriais adicionais (`partKind` novos, ver abaixo), `markdownBody` é a **fonte** do texto daquele fragmento naquela revisão.

### Decisão B — Texto agregado e hash (ledger / integridade)

- **`InstrumentVersion.content`** continua a ser o **corpo agregado** usado para `contentHash`, leitores legados, publicação e `VERSION_RECORDED` no ledger.
- Definir função **determinística** `assembleInstrumentMarkdown(parts ordenadas)` (ex.: separadores estáveis entre blocos documentados no ADR) que produz `InstrumentVersion.content` a partir das `PartVersion.markdownBody` da mesma revisão.
- Qualquer append de versão multi-Part deve, na **mesma transacção**, gravar `PartVersion` + `InstrumentVersion` com conteúdo agregado coerente.

### Decisão C — `partKind` além de `MONOLITH_BODY`

- Lista fechada MVP (ex.: `MONOLITH_BODY`, `SECTION`, `ANNEX` — valores exactos no ADR).
- `@@unique([instrumentId, partKind])` mantém-se; **vários** `partKind` por instrumento permitidos.

### Decisão D — Composição

- `CompositionEntry.position` define ordem global; MVP multi-Part: **N** linhas, posições `1..N` sem buracos.
- Transição desde monólito: **fora** deste MVP ou sub-passos explícitos Pilot (preferência: só instrumentos **novos** multi-Part no MVP 1).

### Decisão E — Estados de Part (ADR 0004)

- MVP: manter projeção **por Part** apenas onde já existe; documentar se Parts não-monólito partilham `partStatus` derivado do instrumento (igual ao monólito) ou ficam congeladas até fase posterior (**Pilot**).

### Decisão F — Ledger

- **Sem** novos `entryType` neste MVP; `VERSION_RECORDED` continua ligado a `InstrumentVersion` apenas.

### Fora de escopo MP-MVP

- PRC/SG, votos, estados independentes por Part complexos.
- Facade DocHUB escrita multi-Part (GET pode evoluir depois).
- Migração automática de instrumento monólito → multi-Part (salvo Pilot reabrir).

---

## Fase MP-1 — Inventário (read-only)

Ficheiro **`docs/inventory-multipart-mvp.md`** em `hub-preop/docs/` listando:

- Ficheiros a tocar (`schema.prisma`, migrações, `part-composition.ts`, `instrument-service.ts`, rotas API, testes, publicação se `assemble` alterar redacção).
- Comportamento a preservar (monólito).
- Riscos e decisões em aberto.

**Gate:** aprovação Pilot do inventário + ADR 0008 **Accepted**.

---

## Fase MP-2 — Implementação (após ADR aceite)

Ordem sugerida:

1. **Migração Prisma:** coluna `PartVersion.markdownBody` nullable; gerar migração; `prisma migrate`.
2. **`lib/part-composition.ts`:**  
   - extrair/ generalizar sincronização para suportar N parts;  
   - manter `syncMonolithicPartForInstrumentVersion` para caminho monólito **inalterado** em comportamento.
3. **`instrument-service.ts`:** novo fluxo `appendMultiPartInstrumentVersion` (nome interno ajustável) ou extensão controlada de `appendInstrumentVersion` com input discriminado (**Pilot**); sempre `computeContentHash` sobre **conteúdo agregado** final.
4. **API:** novas rotas mínimas, por exemplo:  
   - `POST /api/instruments/[id]/parts` — criar Part + entrada de composição (RBAC igual a append);  
   - `POST /api/instruments/[id]/content` **ou** rota dedicada `POST /api/instruments/[id]/versions/multipart` — submeter mapa partId → markdown; **não** contornar RBAC nem ledger.
5. **Testes Vitest:** monólito regressão; multi-part feliz + ordem composição + hash agregado.
6. **README + OPERATIONS:** nota sobre modo multi-Part.

---

## Validação

- `npm run lint`
- `npm run test:no-db` e `npm test` quando DB disponível
- Manual: criar instrumento multi-Part (fluxo novo), submeter versão, verificar `GET .../composition` e `GET /api/instruments/[id]` e ledger

---

## Checkpoint de commit (exemplo)

`feat(hub-preop): multipart editorial MVP (ADR 0008) — schema, assemble, API`

(um commit por step se seguir metodologia estrita)

---

## Handoff

- ADR 0008 link + limites MVP
- Se monólito-only regressão passou
- Próximo: UI por Part ou migração monólito→multi (Pilot)
