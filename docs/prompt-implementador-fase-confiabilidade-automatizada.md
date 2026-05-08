# Prompt — Implementador — Fase: Confiabilidade automatizada (hub-preop)

Você é o Implementador, seguindo a metodologia Pilot + AI Dev Machine.

## Objetivo

Executar **por completo**, de forma **100% automatizada**, a etapa de **aumentar a confiabilidade** descrita em `parallel-project-kit/STATUS.md` (seção **Plano — Etapa de confiabilidade**). **Não** pode haver passos que dependam de smoke manual, checklist na mão do Pilot ou cliques na interface para considerar a fase concluída.

O resultado observável é: **um único comando** (npm) que sobe o pré-requisito local (Postgres via Docker Compose), aplica migrações, roda lint, testes **com** banco, build de produção e uma bateria mínima de **testes de fluxo** que substituem os smokes manuais (saúde das rotas, documento único, multiparte).

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md` (workspace)
2. `Docs/Methodology/pilot-machine-methodology.md` (ou `docs/methodology/pilot-machine-methodology.md`)
3. `parallel-project-kit/STATUS.md` (seção do plano de confiabilidade)
4. `hub-preop/docs/OPERATIONS.md`
5. `hub-preop/docker-compose.yml` e `hub-preop/.env.example`
6. `hub-preop/lib/instrument-service.ts` (fluxos `createInstrument`, `appendInstrumentVersion`, `createMultipartInstrument`, `appendMultipartInstrumentVersion`)
7. `hub-preop/app/api/health/route.ts` e `hub-preop/app/api/doc-hub/v0/health/route.ts`

Conflito de governança ou escopo ambíguo: **parar** e pedir decisão ao Pilot.

---

## Restrições

- **Proibido** entregar ou exigir passos manuais (abrir browser, “verificar visualmente”, curl ad hoc) como critério de aceite desta fase.
- **Permitido** alterar/adicionar código, scripts e testes **somente** para cumprir a automação e os fluxos mínimos abaixo.
- **Sem** mudança de contrato público das APIs existentes, salvo correção de bug com regressão coberta por teste.
- Preferir **scripts shell** + **Vitest** já usado no projeto; **não** adicionar novas dependências npm sem aprovação explícita do Pilot (se algo for inevitável, propor no handoff antes de instalar).

---

## Entregáveis

### A) Script mestre de verificação

Criar **`hub-preop/scripts/verify-reliability.sh`** (executável) que, a partir do diretório **`hub-preop/`**:

1. Executa `docker compose up -d` (ou equivalente já usado no projeto).
2. Aguarda o Postgres aceitar conexões (ex.: loop com `docker compose exec` + `pg_isready` ou `SELECT 1` até timeout razoável; falhar com exit ≠ 0 se estourar).
3. Executa `npx prisma migrate deploy`.
4. Executa `npm run lint` (falha → exit ≠ 0).
5. Executa `npm test` com **`SKIP_DB` ausente ou vazio** (ou seja, **com** banco; falha → exit ≠ 0).
6. Executa `npm run build` (falha → exit ≠ 0).

O script deve terminar com **exit 0** só se todos os passos passarem. Documentar no próprio script (comentário no topo) pré-requisitos: Docker, Node, `.env` com `DATABASE_URL` coerente com o Compose.

### B) Entrada npm

Em **`hub-preop/package.json`**, adicionar script, por exemplo:

- `"verify:reliability": "bash scripts/verify-reliability.sh"`

(Ajustar se o projeto padronizar outro nome; manter um único comando documentado.)

### C) Testes que substituem smokes manuais

Adicionar ficheiro(s) Vitest que **só fazem sentido com DB** (mesmo padrão de `lib/smoke.test.ts`: usar `it.skipIf(!!process.env.SKIP_DB)` **ou** `describe.skipIf` conforme conveniência), cobrindo **automaticamente**:

1. **Saúde API interna** — invocar o handler `GET` de `/api/health` e assertir resposta JSON com `ok: true` e `db: true`.
2. **Saúde fachada DocHUB** — invocar o handler `GET` de `/api/doc-hub/v0/health` e assertir resposta de sucesso conforme o contrato actual (liveness sem DB, se for o caso).
3. **Fluxo documento único** — usando **serviços reais** (`createInstrument` + `appendInstrumentVersion` ou equivalentes já estáveis), criar instrumento e uma revisão; assertir no banco que versão e conteúdo agregado existem e são coerentes (campos mínimos definidos no teste).
4. **Fluxo multiparte** — usando **`createMultipartInstrument`** + **`appendMultipartInstrumentVersion`** (e dados mínimos válidos), criar instrumento com ≥2 partes e uma nova revisão; assertir composição/conteúdo agregado coerentes com as regras actuais (ver ADR 0008 e `lib/part-composition.ts`).

**Importante:** estes testes devem ser **determinísticos** em ambiente limpo: se precisarem de isolamento (títulos únicos, cleanup em `afterAll`), implementar de forma a não falhar em re-execuções locais comuns.

### D) Documentação

Atualizar **`hub-preop/docs/OPERATIONS.md`** com uma subsecção curta **“Verificação de confiabilidade (automatizada)”**: um único comando `npm run verify:reliability`, pré-requisitos e o que o comando cobre (sem pedir passos manuais ao leitor).

### E) Registo no planejamento

Atualizar **`parallel-project-kit/STATUS.md`**: na seção do plano de confiabilidade, indicar que a execução passa a ser **`npm run verify:reliability`** no `hub-preop` (e remover ou marcar como histórico qualquer redação que sugira smokes manuais obrigatórios, se ainda existir).

### F) Handoff

Acrescentar entrada em **`parallel-project-kit/docs/handoffs.md`** com data, comando único, ficheiros tocados e limitações (ex.: requer Docker; não substitui pen-test; não é CI cloud a menos que o ambiente tenha Docker).

---

## Validação (aceite da fase)

O Implementador só considera a fase fechada quando:

1. `npm run verify:reliability` conclui com **sucesso** na máquina de desenvolvimento referência (Docker disponível).
2. `npm run test:no-db` continua a passar no CI/local quando `SKIP_DB=1` (não quebrar o modo sem DB).
3. `npm run lint` e `npm run build` passam (já cobertos pelo script, mas repetir se o Pilot validar só parte dos passos).

---

## Checkpoint de commit (sugerido)

Pode ser **um** commit se o Pilot aceitar agregação; caso contrário, um commit por entregável, por exemplo:

- `feat(hub-preop): verify:reliability script and DB flow tests`
- `docs(hub-preop): OPERATIONS — automated reliability verification`

Formato metodologia:  
`<type>(<scope>): Phase reliability — <description>`

---

## Handoff (obrigatório)

- Comando único e caminho do script.
- Lista dos novos testes de fluxo (ficheiros).
- O que **não** está coberto (ex.: E2E com browser, carga, segurança ofensiva) — uma linha.
- Próximo foco sugerido: deixar para o Pilot (sem pedir decisão neste documento).
