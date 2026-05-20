# Prompt — Implementador — P0.1 Sessão e login (Hub + landing)

Você é o **Implementador**, seguindo a metodologia **Pilot + AI Dev Machine** (`docs/methodology/pilot-machine-methodology.md`).

## Contexto

Este passo é **P0.1** da revisão do ecossistema (ver `hub-preop/docs/prompt-implementador-revisao-completa-ecossistema.md`). O Pilot reportou o sistema **quebrado**; a prioridade absoluta é restaurar o fluxo:

**credenciais válidas → sessão no Hub → `/recognition` → destino interno (por defeito `/ops`)**

Inventário de referência (já produzido): `hub-preop/docs/inventory-revisao-ecossistema-landing-hub.md`.

**Fora de escopo deste passo (não implementar aqui salvo bloqueio directo de P0.1):** P0.2 (matriz CORS/env), P0.3 (seed documentado), P1 (navegação “Home”), P2 (rate limit, deploy HTTPS).

---

## Objetivo P0.1

Garantir que **dois caminhos de login** funcionam de forma reproduzível em laboratório (e documentar o que falta para produção):

| Caminho | Entrada | Resultado esperado |
|--------|---------|-------------------|
| **A — Landing (principal)** | Formulário em `#member-login` na landing | `POST {HUB}/api/auth/landing-login` com `credentials: "include"` → cookies de sessão do Hub → redirect para `{HUB}/recognition?next=…` → utilizador autenticado em `/ops` após “Continuar” |
| **B — Hub (alternativo)** | `{HUB}/login?callbackUrl=%2Fops` (opcional `&from=public-site`) | `signIn("credentials")` no browser → mesma cadeia `/recognition` → `/ops` |

Ambos devem usar a **mesma** validação de credenciais: `auth.ts` → Prisma + `bcrypt` (sem duplicar lógica de password noutro sítio).

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md` (raiz do workspace)
2. `hub-preop/docs/inventory-revisao-ecossistema-landing-hub.md` — secções Auth, APIs, R-2.1
3. `hub-preop/docs/ECOSYSTEM-REPOS.md` — contrato login landing ↔ Hub
4. Código:
   - `hub-preop/auth.ts`, `hub-preop/auth.config.ts`
   - `hub-preop/app/api/auth/landing-login/route.ts`
   - `hub-preop/app/login/page.tsx`
   - `hub-preop/app/recognition/page.tsx`
   - `hub-preop/lib/public-subscriber-cors.ts`
   - `hub-preop/lib/safe-internal-path.ts`
   - `v0-idr-landing-page/components/member-login-form.tsx`
   - `v0-idr-landing-page/app/page.tsx`

---

## Estado conhecido (não repetir trabalho às cegas)

- **R-2.1 já entregue:** `lib/public-subscriber-cors.ts` inclui `Access-Control-Allow-Credentials: true` para origens em `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS`; testes em `lib/public-subscriber-cors.test.ts`.
- **Hipótese P0.1 ainda em aberto:** `signIn()` dentro de `app/api/auth/landing-login/route.ts` pode definir cookies via `cookies()` do Next.js **sem** o browser receber `Set-Cookie` na resposta do `fetch` cross-origin — **validar com DevTools ou `curl -v`** antes de refactor grande.
- **Seed:** utilizadores de lab `admin@hub-preop.local` etc.; senha = `SEED_ADMIN_PASSWORD` no `.env` do Hub. Se login falhar com “senha errada” após mudança de `.env`, usar `npm run seed:users-refresh-passwords` (não é o núcleo de P0.1, mas bloqueia o teste).

---

## Fase P0.1-A — Reprodução e evidência (obrigatório antes de corrigir)

Documentar em **`hub-preop/docs/p0-1-sessao-login-evidencia.md`** (criar este ficheiro):

### Ambiente de teste (registar valores exactos)

| Item | Exemplo local |
|------|----------------|
| Hub | `http://localhost:3000` — `cd hub-preop && docker compose up -d && npx prisma migrate deploy && npm run dev` |
| Landing | `http://localhost:3001` — `cd v0-idr-landing-page && npm run dev:alt` |
| Hub `.env` | `AUTH_SECRET`, `DATABASE_URL`, `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS=http://localhost:3001` |
| Landing `.env.local` | `NEXT_PUBLIC_HUB_ORIGIN=http://localhost:3000` (uma única linha activa, sem placeholder duplicado) |

### Checklist manual (pass / fail / nota)

1. **Caminho B:** `/login` → `admin@hub-preop.local` + senha do seed → `/recognition` → Continuar → `/ops` mostra painel (não redirect para login).
2. **Caminho A:** landing `#member-login` → mesmo email/senha → redirect para Hub `/recognition` → mesma sessão que em B.
3. **Credenciais inválidas:** landing e `/login` devolvem erro claro (401 / mensagem UI), sem 500.
4. **DevTools (Caminho A):** no `POST …/api/auth/landing-login` — ver `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials`, e **`Set-Cookie`** na resposta; no redirect seguinte, pedido a `/recognition` envia cookie.
5. **Preflight:** `OPTIONS` para `landing-login` com `Origin: http://localhost:3001` → 204 com headers CORS correctos.

### Comandos automáticos (anexar exit codes)

Em `hub-preop/`:

```bash
npm run lint
npm run test:no-db
npm run build
```

Opcional se Docker disponível: `npm run verify:reliability`.

Teste HTTP mínimo (ajustar senha via env, não commitar):

```bash
curl -sS -D - -o /tmp/landing-login-body.json \
  -X POST "http://localhost:3000/api/auth/landing-login" \
  -H "Origin: http://localhost:3001" \
  -H "Content-Type: application/json" \
  --data '{"email":"admin@hub-preop.local","password":"…","next":"/ops"}'
```

Registar se a resposta inclui cabeçalhos `Set-Cookie`.

---

## Fase P0.1-B — Correcções permitidas (só o necessário para P0.1)

Implementar **apenas** o que a evidência P0.1-A exigir. Candidatos conhecidos (escolher com base em prova, não por suposição):

| Sintoma | Direcção de fix (exemplos) | Ficheiros prováveis |
|--------|----------------------------|---------------------|
| CORS bloqueia `fetch` credentialed | Confirmar R-2.1; origem exacta em `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS` | `lib/public-subscriber-cors.ts`, `.env` |
| POST 200 mas sem cookie na resposta | Garantir que cookies de `signIn` chegam ao cliente: p.ex. propagar cookies do `cookies()` para `NextResponse`, ou fluxo alternativo documentado (redirect same-origin) | `app/api/auth/landing-login/route.ts`, eventual `auth.config.ts` (cookies `sameSite` / `secure` só se necessário e testado) |
| Cookie existe mas `/recognition` “não reconhecida” | Verificar domínio/path do cookie, `AUTH_SECRET`, middleware não aplicável a `/recognition` | `auth.config.ts`, `app/recognition/page.tsx` |
| `/login` não redirecciona após sucesso | `res?.url` vazio; alinhar `callbackUrl` com `/recognition?next=` | `app/login/page.tsx` |
| Open redirect | Garantir `safeInternalPath` em todos os `next` / `callbackUrl` | `lib/safe-internal-path.ts`, rotas que leem query |

**Restrições:**

- Sem novas dependências npm sem aprovação do Pilot.
- Sem remover `/login` do Hub.
- Sem alterar contratos REST fora de `landing-login` salvo necessidade para cookies.
- Mudanças reversíveis; preferir patch local + teste.

Se a única forma fiável de cookies cross-origin for **redirect browser** (form POST ou 302 para Hub em vez de JSON), documentar no ficheiro de evidência e propor ao Pilot antes de mudança de UX grande.

---

## Fase P0.1-C — Testes automatizados (mínimo)

Adicionar ou actualizar testes **sem DB** quando possível:

- CORS credentialed (já existe `lib/public-subscriber-cors.test.ts` — manter verde).
- Opcional: teste de integração leve para `landing-login` (mock `signIn` ou handler com origem permitida / negada) — só se não exigir Docker.

Após alterações: `npm run lint`, `npm run test:no-db`, `npm run build` em `hub-preop/` — todos a passar.

---

## Critérios de aceite P0.1

- [ ] `hub-preop/docs/p0-1-sessao-login-evidencia.md` preenchido com ambiente, checklist e resultado Caminho A + B.
- [ ] Caminho **B** (`/login` → recognition → `/ops`) **pass** em lab.
- [ ] Caminho **A** (landing → `landing-login` → recognition → `/ops`) **pass** em lab, com evidência de cookie (DevTools ou `curl -D -`).
- [ ] Credenciais inválidas: 401 + UI de erro; sem 500 não tratado.
- [ ] `npm run lint`, `npm run test:no-db`, `npm run build` no Hub a passar.
- [ ] Se código mudou: nota curta no inventário ou handoff — o que era a causa raiz e o que ficou pendente para deploy HTTPS (P2).

---

## Handoff (obrigatório ao fechar P0.1)

Registar em `parallel-project-kit/docs/handoffs.md` (secção nova datada):

- **Causa raiz** (1–3 bullets)
- **Ficheiros alterados**
- **Como o Pilot valida** (3 passos manuais)
- **Deferido** (ex.: cookies em Vercel com domínios diferentes)

---

## Formato de commit (quando houver código)

```
fix(hub-preop): P0.1 — session login landing and Hub /login
```

Ou, se alinhado a fase R: `fix(hub-preop): Phase R P0.1 — landing-login session cookies`.

---

## Checkpoint para o Pilot (responder no fecho da sessão)

1. Caminho A e B passam em local? (sim/não + nota)
2. O `POST /api/auth/landing-login` devolve `Set-Cookie`? (sim/não)
3. O que falta para produção (Vercel, dois domínios)?

*Não avançar para P0.2/P1 até o Pilot confirmar P0.1 ou autorizar excepção documentada.*
