# P0.1 — Sessão e login (evidência)

**Data:** 2026-05-15  
**Referência:** `docs/inventory-revisao-ecossistema-landing-hub.md`, `docs/prompt-implementador-p0-1-sessao-login.md`

---

## Ambiente de teste (registar valores exactos)

| Item | Valor recomendado (lab) | Esta sessão |
| --- | --- | --- |
| Hub | `http://localhost:3000` — `docker compose up -d`, `npx prisma migrate deploy`, `npm run dev` | **Não arrancado** — Docker daemon indisponível |
| Landing | `http://localhost:3001` — `npm run dev:alt` | **Não arrancado** |
| Hub `.env` | `AUTH_SECRET`, `DATABASE_URL`, `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS=http://localhost:3001`, opcional `NEXT_PUBLIC_LANDING_ORIGIN=http://localhost:3001` | Não validado em runtime |
| Landing `.env.local` | `NEXT_PUBLIC_HUB_ORIGIN=http://localhost:3000` (uma linha) | Confirmado no workspace |

---

## Checklist manual (pass / fail / skip)

| # | Fluxo | Estado | Nota |
| --- | --- | --- | --- |
| 1 | **Caminho B:** `/login` → seed → `/recognition` → `/ops` | **skip** | Requer Hub+BD em execução |
| 2 | **Caminho A:** landing `#member-login` → `landing-login` → `/recognition` → `/ops` | **skip** | Requer Hub+BD+landing |
| 3 | Credenciais inválidas (401 / UI) | **parcial** | Teste automatizado: `landing-login/route.test.ts` → 401 + CORS credentialed |
| 4 | DevTools: `Set-Cookie` no POST `landing-login` | **pendente** | Hipótese: `signIn` grava via `cookies().set()` e Next.js inclui na resposta do Route Handler — **não confirmado com `curl -D -`** |
| 5 | Preflight OPTIONS | **pass** (auto) | `route.test.ts`: 204 + `Access-Control-Allow-Credentials: true` |

---

## Comandos automáticos (exit codes)

Executados em `hub-preop/` em **2026-05-15**:

| Comando | Exit |
| --- | --- |
| `npm run lint` | 0 |
| `npm run test:no-db` | 0 (30 files, 121 tests) |
| `npm run build` | 0 |
| `npm run verify:reliability` | skip (Docker indisponível) |

Landing (`v0-idr-landing-page/`): `npm run lint` + `npm run build` → **0**.

---

## Análise técnica (sem browser)

### Fonte de verdade das credenciais

- `auth.ts` → `authorize` → Prisma `user.findUnique` + `bcrypt.compare`.
- `landing-login` → `signIn("credentials", …)` → mesmo provider (sem duplicação de hash).

### CORS (R-2.1 — feito)

`subscriberCorsHeaders` devolve, para origem permitida:

- `Access-Control-Allow-Origin: <origem exacta>`
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`
- `Vary: Origin`

### Cookies (`signIn` no Route Handler)

Auth.js (`next-auth/lib/actions.js`) após `Auth()`:

1. Itera `res.cookies` e chama `cookies().set(name, value, options)`.
2. Com `redirect: false`, devolve URL string (não faz redirect).

O handler devolve `NextResponse.json(...)`. Em App Router, cookies definidos via `cookies()` durante o handler **devem** aparecer em `Set-Cookie` na resposta HTTP.

**Riscos remanescentes:**

| Contexto | Risco |
| --- | --- |
| Local `localhost:3001` → `localhost:3000` | Cross-origin mas frequentemente same-site; pode funcionar com `SameSite=Lax` por defeito |
| Vercel (domínios diferentes) | Pode exigir `cookies: { sessionToken: { sameSite: "none", secure: true } }` em `auth.config.ts` |
| Bloqueio de third-party cookies | Browsers podem restringir `Set-Cookie` em respostas `fetch` cross-origin — validar Caminho A |

### Comando HTTP para o Pilot (quando Hub estiver up)

```bash
curl -sS -D - -o /tmp/landing-login-body.json \
  -X POST "http://localhost:3000/api/auth/landing-login" \
  -H "Origin: http://localhost:3001" \
  -H "Content-Type: application/json" \
  --data '{"email":"admin@hub-preop.local","password":"<SEED_ADMIN_PASSWORD>","next":"/ops"}'
```

Procurar linhas `set-cookie:` no cabeçalho. Corpo esperado: `{"ok":true,"hubContinuePath":"/recognition?next=%2Fops"}`.

---

## Critérios de aceite P0.1 (estado)

| Critério | Estado |
| --- | --- |
| Este ficheiro preenchido | Sim (com gaps marcados) |
| Caminho B pass em lab | Pendente Pilot |
| Caminho A pass em lab + cookie | Pendente Pilot |
| 401 credenciais inválidas | Parcial (teste automatizado) |
| lint / test:no-db / build Hub | Sim |
| Causa raiz documentada | Sim (ver inventário + handoff) |
