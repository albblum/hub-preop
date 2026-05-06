# Prompt — Implementador — Fase 1: Hardening operacional (pré-produção)

Você é o Implementador, seguindo a metodologia Pilot + AI Dev Machine.

## Objetivo

Fechar um **primeiro ciclo de hardening operacional** do `hub-preop`: documentação e ferramentas mínimas para **secrets**, **saúde do sistema**, **backup/restore da PostgreSQL local (Docker)** e **resposta a incidentes leves**, **sem** alterar o modelo de domínio nem contratos públicos das APIs já estabilizadas.

Este passo prepara uso contínuo do protótipo (laboratório ou demo interna), não é deploy em cloud.

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md` (raiz do workspace Cursor, se existir no contexto da sessão)
2. `Docs/Methodology/pilot-machine-methodology.md` (ou equivalente no repo)
3. `hub-preop/README.md`
4. `hub-preop/docker-compose.yml`
5. `hub-preop/.env.example`
6. `hub-preop/middleware.ts`
7. `hub-preop/auth.config.ts` e `hub-preop/auth.ts` (superfície de auth)
8. `Docs/adr/0007-hub-preop-git-edit-agent-mvp.md` (privacidade / agente)
9. Runbook formal (se acessível): `AlblumZ deeds/IDR/02_Documentos/HUB_PREOP/Fase2_Tech_Setup_and_Runbook.md`

Em conflito de escopo ou governança: **parar** e pedir decisão ao Pilot.

---

## Escopo fechado

### A) Documento de operações (entregável principal)

Criar **`hub-preop/docs/OPERATIONS.md`** (ou nome acordado com Pilot) com secções mínimas:

1. **Ambiente**
   - Variáveis obrigatórias (`DATABASE_URL`, `AUTH_SECRET`, passwords de seed se usados).
   - Regra: **nunca** commitar `.env`; rotação de `AUTH_SECRET` implica invalidar sessões.

2. **Arranque e verificação**
   - `docker compose up -d`, `npx prisma migrate deploy`, `npm run dev`.
   - Probes: `GET /api/health` (inclui ping DB), `GET /api/doc-hub/v0/health` (facade sem DB).

3. **Backup da base (Docker Compose atual)**

   - Documentar comandos **`pg_dump`** contra o contentor `db` (service `db` em `docker-compose.yml`: user `hub`, DB `hub_preop`).
   - Sugestão: exemplo com `docker compose exec -T db pg_dump -U hub -d hub_preop -Fc` para ficheiro em `./backups/` (pasta já no `.gitignore`).
   - Documentar **restore** com `pg_restore` ou `psql` para ambiente de laboratório.

4. **Incidentes (nível laboratório)**

   - Checklist curto: app não sobe, DB recusa ligação, migrações falham, auth falha após mudar secret.
   - Onde olhar: logs do `npm run dev`, `docker compose logs db`, resposta JSON de `/api/health`.

5. **Superfície exposta**

   - Lembrar: protótipo com auth minimal; não expor publicamente sem hardening adicional (Pilot).
   - Listar rotas/prefixos protegidos pelo `middleware.ts` (`/ops`, `/normalization`, `/review`).

### B) Scripts npm (opcional mas recomendado)

Se o Pilot aprovar scripts pequenos **sem novas dependências npm**:

- `npm run db:backup` — invoca `docker compose exec` + `pg_dump` para `./backups/hub_preop_$(date +%Y%m%d_%H%M%S).dump` (format custom `-Fc`).
- `npm run db:restore` — **documentar** que restore é destrutivo em lab; aceitar argumento de ficheiro ou variável de ambiente; **não** executar restore automático sem confirmação interativa (`read -p`) no script shell.

Implementação preferencial: `bash scripts/backup-db.sh` e `bash scripts/restore-db.sh` chamados pelo `package.json`.

### C) `.env.example`

- Revisar e alinhar com `OPERATIONS.md`: comentários curtos sobre geração de `AUTH_SECRET` (já referido), aviso sobre OAuth opcional.

### D) Registry / handoff

- Atualizar **`System registry.MD`** (workspace pai, fora do repo hub-preop, se for política do Pilot): novo processo operacional, por exemplo `PR-010` backup / `PR-011` incident response — **ou** acrescentar subentrada em `PR-009` se preferirem não proliferar IDs (uma linha no handoff a explicar).
- Acrescentar entrada em **`parallel-project-kit/docs/handoffs.md`** (ou handoff interno acordado) com data, o que foi entregue e limitações.

---

## Fora de escopo

- Deploy em cloud, Kubernetes, CDN, WAF.
- Rate limiting, WAF, SIEM, observabilidade enterprise.
- Alteração de RBAC profunda, novos roles, SSO enterprise.
- Mudanças em Prisma schema ou fluxos de ledger/conteúdo oficial.
- Integração LLM externa no agente.

---

## Validação

1. `npm run lint`
2. `npm run test:no-db` (e `npm test` se ambiente DB disponível)
3. Verificação manual:
   - `docker compose up -d` + `/api/health` retorna `ok: true, db: true`
   - Se script de backup existir: correr uma vez e confirmar ficheiro em `./backups/` (não commitar o ficheiro)

---

## Checkpoint de commit (sugerido)

`docs(hub-preop): Phase 1 operational hardening runbook and DB backup scripts`

(ajustar `scope` se só documentação sem scripts)

---

## Handoff (obrigatório)

- O que foi documentado vs scripts adicionados.
- Riscos residuais (protótipo não endurecido para internet pública).
- Próximo passo sugerido pelo Pilot: multi-Part editorial ou UX.
