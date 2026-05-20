# Prompt — Implementador — Revisão completa do ecossistema (Hub + landing + integrações)

Você é o **Implementador**, seguindo a metodologia **Pilot + AI Dev Machine** (`docs/methodology/pilot-machine-methodology.md`).

## Situação relatada pelo Pilot

O ecossistema está **considerado quebrado** após evoluções recentes na **landing pública** (repo `v0-idr-landing-page`), **login a partir da landing** (`POST /api/auth/landing-login`), **CORS**, **navegação “Home” → site público** (`NEXT_PUBLIC_LANDING_ORIGIN`), e ajustes no **seed / palavras-passe**. O Pilot pediu uma **revisão de todo o projeto**, não um remendo isolado sem diagnóstico.

O teu trabalho é **diagnosticar com evidência**, **priorizar** e **propor ou executar** correções em passos reversíveis, com aprovação do Pilot quando a metodologia exigir gate.

---

## Objectivo desta revisão

1. **Restaurar confiança**: fluxos críticos documentados e testáveis (local e, quando aplicável, deploy).
2. **Mapear regressões**: lista reproduzível (passos, URL, env, sintoma, causa provável, fix proposto).
3. **Evitar “consertos às cegas”**: inventário antes de grandes mudanças; uma hipótese de cada vez quando possível.

---

## Leitura obrigatória (ordem)

1. Raiz do workspace: `CLAUDE.md` (repositórios, onde é Git, convenções).
2. `docs/methodology/pilot-machine-methodology.md`
3. `hub-preop/docs/ECOSYSTEM-REPOS.md` — mapa Hub ↔ landing e contratos.
4. `hub-preop/docs/OPERATIONS.md` — arranque, Docker, seed, verificação.
5. `hub-preop/README.md`
6. Landing (espelho no workspace): `v0-idr-landing-page/README.md` e `v0-idr-landing-page/INSTRUCOES-DEPLOY.pt.md`
7. Planejamento / handoffs (se existirem no workspace): `parallel-project-kit/STATUS.md`, `parallel-project-kit/docs/handoffs.md`

---

## Repositórios no âmbito

| Área | Pasta / repo | Git |
|------|----------------|-----|
| App operacional | `hub-preop/` | Sim (fonte da app) |
| Landing v0 | `v0-idr-landing-page/` | Repo separado (espelho no workspace) |
| Metodologia / kit | `parallel-project-kit/`, raiz | Conforme convenção do Pilot |

Commits da aplicação: **apenas** dentro de `hub-preop/` (e clone da landing no respectivo remoto).

---

## Restrições

- **Spec-first / inventário primeiro**: não refactors largos sem inventário aprovado quando o Pilot marcar gate.
- **Não expandir produto** nesta revisão (sem novas features) salvo instrução explícita do Pilot após diagnóstico.
- **Reversibilidade**: preferir flags, correções localizadas, e documentação de rollback; migrações destrutivas só com aprovação.
- **Sem dependências npm novas** salvo aprovação do Pilot (metodologia).
- **Não apagar** fluxos ainda referenciados na documentação sem actualizar docs e avisar o Pilot.

---

## Fase R-0 — Inventário (read-only, obrigatório)

**Produzir** `hub-preop/docs/inventory-revisao-ecossistema-landing-hub.md` (nome ajustável pelo Pilot) contendo:

### R-0.1 Superfície Hub (código + rotas)

- Rotas **App Router** relevantes: `/`, `/login`, `/recognition`, `/ops`, `/public`, `/public/[idrRef]`, `/review`, `/normalization`, `/instruments/.../edit`, `/comite/...`
- APIs públicas / cross-origin:
  - `POST /api/public/subscribers`
  - `POST /api/auth/landing-login` e `OPTIONS` correspondente
- `middleware.ts` — matcher e interacção com sessão
- Auth: `auth.ts`, `auth.config.ts`, `app/api/auth/[...nextauth]/route.ts`
- CORS: `lib/public-subscriber-cors.ts` (lista partilhada para subscritores e login da landing)
- Navegação “site público”: `components/public-marketing-home-link.tsx`, `lib/public-marketing-home.ts`, `lib/safe-internal-path.ts`
- Seed: `scripts/seed-founding.ts`, variável `SEED_UPDATE_EXISTING_PASSWORDS`, scripts `package.json` relacionados

### R-0.2 Superfície landing (repo v0)

- `app/page.tsx` — `NEXT_PUBLIC_HUB_ORIGIN`, URLs derivadas
- `components/idr-landing.tsx`, `components/member-login-form.tsx`, `components/follow-the-idr-form.tsx`
- Build / lint da landing

### R-0.3 Matriz de variáveis de ambiente

Tabela **Hub** vs **Landing**: nome da variável, obrigatoriedade, exemplo local vs Vercel, e **quem consome**.

Incluir no mínimo:

- Hub: `AUTH_SECRET`, `DATABASE_URL`, `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS`, `NEXT_PUBLIC_LANDING_ORIGIN` (opcional), `SEED_*`, `AUTH_URL` / `NEXTAUTH_URL` se usados
- Landing: `NEXT_PUBLIC_HUB_ORIGIN`

### R-0.4 Riscos conhecidos (para validar na revisão)

- Cookies de sessão em **login cross-origin** (`fetch` + `credentials: "include"`) — comportamento por browser e `SameSite` em produção HTTPS.
- **Origem** exacta na lista CORS (porta, `http` vs `https`, sem barra final).
- Utilizadores existentes vs **hashes** após mudança de `SEED_*_PASSWORD` sem `SEED_UPDATE_EXISTING_PASSWORDS`.

**Gate:** Pilot aprova o inventário antes de **Fase R-2+** com mudanças de código amplas (ajustes pontuais documentados podem seguir regra do Pilot).

---

## Fase R-1 — Reprodução e evidência

1. **Local**: documentar combinação exacta (portas Hub / landing, `.env` e `.env.local`) usada no teste.
2. **Checklist manual mínimo** (marcar pass / fail / skip):

   - Landing: Home, About, scroll para `#member-login`, formulário membro (email/senha), erro esperado com credenciais erradas, sucesso com seed.
   - Após login: Hub `/recognition` → continuar → `/ops` (ou destino configurado).
   - Landing: “Enter the Library” → `/public` no Hub.
   - Landing: “Follow the IDR” → `POST` subscritores.
   - Hub: `/login` alternativo e link “voltar ao site público” quando `NEXT_PUBLIC_LANDING_ORIGIN` + `from=public-site`.
   - Hub: links “Site público IDR” / “Início do Hub” conforme env.
   - Encerrar sessão no Hub (reconhecimento) → volta à landing quando configurado.

3. **Regressões automáticas**: correr no `hub-preop/`:

   - `npm run lint`
   - `npm run test:no-db`
   - `npm run build`
   - Se o ambiente permitir: `npm run verify:reliability` (Docker + BD)

4. **Landing**: `npm run lint`, `npm run build`.

Anexar ao inventário ou a um anexo: **log resumido** (comandos + exit codes) e capturas ou notas de erro de browser quando útil.

---

## Fase R-2 — Análise técnica dirigida (após R-0 aprovado ou correções pontuais autorizadas)

### Autenticação e sessão

- Confirmar que `authorize` em `auth.ts` e o fluxo `landing-login` usam a **mesma** fonte de verdade (Prisma + bcrypt).
- Tratar erros: `CredentialsSignin` e respostas HTTP consistentes (401 vs 500).
- Verificar se `signIn` em `app/api/auth/landing-login/route.ts` corre correctamente em **Route Handler** e se os **cookies** aparecem na resposta em ambiente real (não só em teoria).

### CORS

- `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS` cobre **ambas** as origens necessárias para subscritores e login da landing.
- Headers: `Access-Control-Allow-Origin` específico, `Vary: Origin`, métodos e headers permitidos alinhados ao que o browser envia.

### Navegação e UX

- Coerência entre `NEXT_PUBLIC_LANDING_ORIGIN`, `PublicMarketingHomeLink`, redirects em `review/*`, e `signOut` no reconhecimento.
- Evitar **open redirect** em `callbackUrl` / `next` (já existe `safeInternalPath` — confirmar todos os pontos de entrada).

### Seed e laboratório

- Documentar no inventário o fluxo **seed → login** e o comando `npm run seed:users-refresh-passwords` quando aplicável.

---

## Fase R-3 — Plano de correcção priorizado

Entregar lista **P0 / P1 / P2**:

- **P0**: bloqueia login, sessão, ou expõe dados indevidamente.
- **P1**: quebra fluxos principais ou CI.
- **P2**: documentação, DX, mensagens de erro.

Cada item: **ficheiros**, **mudança proposta**, **teste de validação**.

---

## Critérios de aceite (revisão considerada “fechada”)

- [ ] Inventário R-0 entregue e (se aplicável) aprovado pelo Pilot.
- [ ] Matriz de reprodução R-1 preenchida; P0 resolvido ou explicitamente aceite como limitação com ADR/nota.
- [ ] `npm run lint`, `npm run test:no-db`, `npm run build` em `hub-preop/` a passar.
- [ ] `npm run lint` e `npm run build` na landing a passar.
- [ ] `ECOSYSTEM-REPOS.md` e READMEs alinhados ao comportamento **real** pós-correcção.
- [ ] Handoff em `parallel-project-kit/docs/handoffs.md` (ou local definido pelo Pilot): o que estava partido, o que foi corrigido, o que ficou deferido, próximo foco.

---

## Formato de commit (quando houver código)

Seguir `CLAUDE.md`: por exemplo `fix(hub-preop): …` ou metodologia `fix(hub-preop): Phase R step R.N — …` se o Pilot numerar esta revisão.

---

## O que **não** fazer nesta revisão (sem ordem do Pilot)

- Redesenhar produto ou normas de autoridade além do necessário para desbloquear integração.
- Unificar repos ou mover a landing para dentro do Hub sem ADR/decisão.
- Desligar `/login` do Hub sem substituto documentado para suporte e bookmarks.

---

## Checkpoint para o Pilot

Antes de fechar, o Implementador deve deixar uma **lista curta** (3–5 bullets) respondendo:

1. O que estava fundamentalmente errado (causa raiz)?
2. O que mudou?
3. O que ainda é frágil (ex.: cookies em browsers específicos)?
4. Que teste manual o Pilot deve repetir após deploy?

---

*Documento gerado para suportar revisão integral do ecossistema após queixas de regressão. Ajustar títulos de fase (R-0, R-1, …) se o Pilot integrar isto num plano numerado oficial.*
