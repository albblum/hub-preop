# Hub pré-op — Operações (laboratório / demo interna)

Documento mínimo para **secrets**, **arranque**, **backup e restore** da PostgreSQL em Docker, **verificação de saúde** e **resposta a incidentes leves**. Não substitui o runbook formal bilingue em `AlblumZ deeds/IDR/02_Documentos/HUB_PREOP/Fase2_Tech_Setup_and_Runbook.md` quando esse ficheiro estiver acessível.

**Âmbito:** protótipo local com `docker compose`; **não** é runbook de produção nem deploy em cloud.

---

## 1. Ambiente

### Variáveis obrigatórias

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Ligação PostgreSQL (ex.: `postgresql://hub:hub@localhost:5432/hub_preop` com o compose por defeito). |
| `AUTH_SECRET` | Segredo do Auth.js / NextAuth (sessões JWT). Gerar valor forte e único por ambiente (ex.: `openssl rand -base64 32`). |

### Transição monólito → multiparte (ADR 0009)

| Variável | Uso |
|----------|-----|
| `TRANSITION_MONOLITH_TO_MULTIPART_ENABLED` | Quando `1` ou `true` (case-insensitive), permite a operação; **ausente**, `0` ou `false` — desligada (a rota HTTP responde 403 `TRANSITION_DISABLED` sem tocar na BD). |

**Quem pode:** mesmas roles que `canAppendContent` (`admin` ou `registrar`), com sessão (cookie) como nas outras rotas internas.

**Endpoint:** `POST /api/instruments/[id]/transition-to-multipart` com corpo JSON opcional `{ "dryRun": true }`. Em dry-run, a resposta inclui `dryRun: true` e um `report` com ids e metadados do conteúdo **sem** escritos na base.

**Limites:** um instrumento de cada vez; sem migração em lote; sem nova revisão nem entrada nova no ledger; reversão em laboratório = **restaurar backup** (secção 3 deste documento).

**CLI (opcional):** com a flag activa e `DATABASE_URL` definida:

```bash
TRANSITION_MONOLITH_TO_MULTIPART_ENABLED=1 npm run transition:monolith-to-multipart -- --instrument-id "<cuid>" --dry-run
```

Evitar duas transições concorrentes no mesmo instrumento (um operador por alvo).

### Variáveis de seed (laboratório)

Se usar `npm run seed:founding` ou equivalente, as passwords em `.env` (`SEED_ADMIN_PASSWORD`, `SEED_REVIEWER_PASSWORD`, `SEED_VIEWER_PASSWORD`) definem as credenciais dos utilizadores de desenvolvimento. **Altere-as** em qualquer ambiente que não seja descartável.

### Regras

- **Nunca** commitar `.env` (mantém-se apenas `.env.example` no repositório).
- **Rotação de `AUTH_SECRET`:** todas as sessões existentes deixam de ser válidas; os utilizadores têm de voltar a autenticar-se.
- **OAuth opcional:** `AUTH_GITHUB_ID` e `AUTH_GITHUB_SECRET` — se estiverem definidos, o GitHub passa a ser um provider; se estiverem em branco, permanece apenas o fluxo Credentials (ver `auth.config.ts`). Em deploy não local, ajustar também `AUTH_URL` para a URL pública da aplicação (callbacks OAuth).

---

## 2. Arranque e verificação

Na pasta `hub-preop`:

1. Copiar `.env.example` → `.env` e preencher (em especial `DATABASE_URL`, `AUTH_SECRET`).
2. Subir a base de dados:
   ```bash
   docker compose up -d
   ```
3. Aplicar migrações:
   ```bash
   npx prisma migrate deploy
   ```
4. Arrancar a aplicação:
   ```bash
   npm run dev
   ```

### Probes (saúde)

| Endpoint | O que valida |
|----------|----------------|
| `GET /api/health` | Resposta JSON com `ok` e `db`; executa `SELECT 1` via Prisma. Sucesso típico: `{ "ok": true, "db": true }`. Em falha de DB: HTTP 503 com `ok: false`, `db: false` e `error` descritivo. |
| `GET /api/doc-hub/v0/health` | Facade DocHUB v0 **sem** ping à base; confirma que a rota da facade responde (ex.: `ok`, `facade`, `version`). |

Exemplos:

```bash
curl -sS http://localhost:3000/api/health
curl -sS http://localhost:3000/api/doc-hub/v0/health
```

### Facade DocHUB v0 — escrita multi-Part (ADR 0010)

- **`POST /api/doc-hub/v0/instruments/{docId}/versions/multipart`** — mesmo contrato de corpo que `POST /api/instruments/{id}/versions/multipart` (`bodiesByPartId`, `revisionNote` opcional). O `{docId}` no path é **cuid** ou **`idrRef`** (codificar `:` em URL, ex. `idr%3AHUB-INSTR-00000001`).
- **RBAC:** sessão com papel `admin` ou `registrar` (`canAppendContent`), como na rota canónica.
- Resposta: JSON em forma DocHUB (`docId`, `instrumentId`, …) após sucesso.

Exemplo (substituir cookie de sessão válido):

```bash
curl -sS -X POST "http://localhost:3000/api/doc-hub/v0/instruments/idr%3AHUB-INSTR-00000001/versions/multipart" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=<valor>" \
  -d '{"bodiesByPartId":{"<partId>":"# Corpo"},"revisionNote":"via facade"}'
```

---

## 2.1 Base de dados limpa (laboratório — **destrutivo**)

Apaga **todos** os dados e reaplica migrações do zero (esquema vazio, sem utilizadores nem instrumentos). **Nunca** usar em produção.

Com Postgres acessível pela `DATABASE_URL` (ex.: `docker compose up -d`):

```bash
npx prisma migrate reset --force
```

Atalho: `npm run db:reset` (equivalente). O Prisma pode exigir confirmação extra em alguns ambientes de agente; em terminal local o comando acima é suficiente.

Depois, recriar utilizadores com `npm run seed:founding` ou `npm run seed:users-only` se precisares de login de teste.

---

## 3. Backup da base (Docker Compose atual)

Serviço: **`db`** (`docker-compose.yml`). Utilizador: **`hub`**. Base de dados: **`hub_preop`**.

### Dump (formato custom, `-Fc`)

Criar a pasta `./backups/` (já está em `.gitignore`; **não** commitar ficheiros de backup).

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U hub -d hub_preop -Fc > "./backups/hub_preop_$(date +%Y%m%d_%H%M%S).dump"
```

Atalho npm (equivalente):

```bash
npm run db:backup
```

### Restore (laboratório — destrutivo)

**Aviso:** `pg_restore --clean` remove objectos existentes na base **antes** de recriar a partir do dump. Pode apagar dados atuais. Use só em ambiente de laboratório descartável.

1. Parar consumidores da base (recomendado: parar `npm run dev` e qualquer outro cliente).
2. Confirmar interativamente o script ou seguir o comando manual abaixo.

**Script (pede confirmação `YES`):**

```bash
npm run db:restore -- ./backups/hub_preop_YYYYMMDD_HHMMSS.dump
# ou: RESTORE_DUMP=./backups/ficheiro.dump npm run db:restore
```

**Manual:**

```bash
docker compose exec -T db pg_restore -U hub -d hub_preop --clean --if-exists -v < ./backups/seu_ficheiro.dump
```

Se `pg_restore` falhar por ligações ativas, garantir que não há sessões abertas à base ou reiniciar o contentor `db` após parar a app.

---

## 4. Incidentes (nível laboratório)

Checklist curto:

| Sintoma | O que verificar |
|---------|------------------|
| App não sobe | Consola de `npm run dev`; erros de build; `DATABASE_URL` e `AUTH_SECRET` definidos. |
| DB recusa ligação | `docker compose ps`; `docker compose logs db`; porta `5432` livre no host; credenciais alinhadas com `docker-compose.yml`. |
| Migrações falham | Versão do Prisma; estado da base; mensagem completa do `prisma migrate`; volume Docker não corrompido (último recurso em lab: novo volume — **perda de dados**). |
| Auth falha após mudar secret | Esperado: rotação de `AUTH_SECRET` invalida JWTs antigos — fazer novo login. |
| Health diz DB down | Resposta JSON de `GET /api/health` (campo `error`); conectividade `localhost:5432`; migrações aplicadas. |

**Onde olhar:**

- Terminal: `npm run dev`
- Docker: `docker compose logs db` (e `docker compose logs -f db` para seguir)
- API: `GET /api/health`

---

## 5. Superfície exposta

- O protótipo usa **autenticação minimal** para esta fase. **Não** exponha publicamente na Internet sem hardening adicional (rede, TLS, políticas de auth, decisão do Pilot).

### Rotas de UI protegidas pelo middleware

O `middleware.ts` exige sessão para:

- `/ops/*`
- `/normalization/*`
- `/review` (índice de documentos para leitura de revisão)
- `/review/*` (leitura de um documento por `idrRef`)
- **`/instruments/{id}/edit`** — edição de Markdown (evita carregar a página sem sessão; a API continua com RBAC próprio).

Utilizadores não autenticados são redirecionados para `/login` com `callbackUrl` preservado.

### Robustecimento HTTP (configuração Next)

- **`next.config.ts`:** cabeçalhos em todas as respostas — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (câmara/microfone/geolocalização desligados). Com **`NODE_ENV=production`**, acrescenta **`Strict-Transport-Security`** — em deploy real use **HTTPS** (TLS no proxy ou no host).
- **`npm run check:env`** — verifica `.env` mínimo (`DATABASE_URL`, `AUTH_SECRET` com ≥ 16 caracteres). Se não existir `.env`, sai com sucesso (útil em CI sem secrets locais). O gate **`npm run verify:reliability`** chama este passo após `prisma migrate deploy`.

### Privacidade / agente (MVP)

Qualquer envio de rascunhos a fornecedores LLM externos está **fora** do MVP e sujeito a decisão do Pilot e ADR 0007. O endpoint `POST /api/agent/validate` opera em modo **stub** local sem tráfego externo.

---

## 6. Validação recomendada após alterações operacionais

### Verificação de confiabilidade (automatizada)

Com Docker disponível e `.env` com `DATABASE_URL` alinhado ao Compose, um único comando em `hub-preop/` executa: subida do Postgres, espera por `pg_isready`, `prisma migrate deploy`, **`check-env`** (se existir `.env`), lint, testes Vitest **com** base de dados (saúde das rotas, fluxo documento único, fluxo multiparte) e build de produção.

```bash
npm run verify:reliability
```

Não substitui pen-test nem testes E2E com browser; exige Docker local (ou ambiente equivalente com Postgres acessível pela `DATABASE_URL`).

### Validação rápida (CI / sem Docker)

```bash
npm run lint
npm run test:no-db
```

Com base de dados local já migrada, opcionalmente: `npm test`.

---

## Referências no repositório

- `docker-compose.yml` — serviço `db`, utilizador e nome da base
- `.env.example` — variáveis documentadas
- `middleware.ts` — prefixos protegidos
- `auth.config.ts`, `auth.ts` — OAuth opcional e Credentials
- [ADR 0007](../../Docs/adr/0007-hub-preop-git-edit-agent-mvp.md) — limites de privacidade e agente
- [ADR 0008](../../Docs/adr/0008-hub-preop-multipart-editorial-mvp.md) — multi-Part editorial; após deploy, aplicar migração `20260506140000_multipart_editorial_mvp` (`PartVersion.markdownBody`, unique `(instrumentVersionId, partId)`). `npm run backfill:parts` continua a actuar só em instrumentos **monolíticos**.
