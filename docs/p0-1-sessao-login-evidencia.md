# P0.1 — Sessão e login (evidência)

**Data:** 2026-05-20  
**Referência:** `docs/prompt-implementador-p0-1-sessao-login.md`  
**Status final:** **PASS** (fluxos A, B e C + verificações técnicas HTTP; browser manual recomendado como smoke adicional)

---

## Ambiente de teste

| Item | Valor |
| --- | --- |
| Hub | `http://localhost:3000` — `npm run dev` em `hub-preop/` |
| Landing | `http://localhost:3001` — `npm run dev:alt` em `v0-idr-landing-page/` |
| PostgreSQL | `docker compose up -d` (serviço `db` apenas; Hub e landing **não** estão no Compose) |
| Hub `.env` | `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS=http://localhost:3001`, `NEXT_PUBLIC_LANDING_ORIGIN=http://localhost:3001`, `AUTH_SECRET` definido |
| Landing `.env.local` | `NEXT_PUBLIC_HUB_ORIGIN=http://localhost:3000` |

**Nota env:** a demanda menciona `NEXT_PUBLIC_HUB_URL`; no código da landing a variável correcta é **`NEXT_PUBLIC_HUB_ORIGIN`** (confirmado activo).

**Senhas (defaults do seed, `.env` sem overrides):**

| Utilizador | Email | Password |
| --- | --- | --- |
| IDR-M-0001 | `idr-m-0001@hub-preop.local` | `ChangeMeProvisionalMember!` |
| IDR-SG-0001 | `idr-sg-0001@hub-preop.local` | `ChangeMeSecretaryGeneral!` |
| Admin | `admin@hub-preop.local` | `ChangeMeAdmin!` |

Pré-requisito: `npm run seed:movement2` (Movement 2) + founding seed prévio.

---

## SETUP — Serviços activos

| Verificação | Resultado |
| --- | --- |
| Docker Postgres | **pass** — container `hub-preop-db-1` running |
| Hub `/api/health` | **pass** — `{"ok":true,"db":true}` |
| Landing `/` HTTP 200 | **pass** |
| Secção `#member-login` na landing | **pass** — `id="member-login"` presente no HTML |
| Hub porta 3000 / landing 3001 | **pass** (após libertar portas ocupadas por instâncias anteriores) |

---

## FLUXO A — Membro provisório (IDR-M-0001)

| Passo | Resultado | Evidência |
| --- | --- | --- |
| POST `/api/auth/landing-login` | **pass** — HTTP **200** | `{"ok":true,"hubContinuePath":"/recognition?next=%2Fops"}` |
| Set-Cookie na resposta | **pass** | `authjs.session-token` + `authjs.callback-url` |
| CORS | **pass** | `Access-Control-Allow-Origin: http://localhost:3001`, `Access-Control-Allow-Credentials: true` |
| Sessão (`/api/auth/session`) | **pass** | `roles: ["provisional_member"]`, membership `IDR-PROVISIONAL` |
| GET `/recognition?next=/ops` | **pass** — HTTP **200** | |
| GET `/ops` | **pass** — HTTP **200** | Painel renderizado (~30k HTML); sem redirect para `/login` |

---

## FLUXO B — Secretary-General (IDR-SG-0001)

| Passo | Resultado | Evidência |
| --- | --- | --- |
| POST `/api/auth/landing-login` | **pass** — HTTP **200** | |
| Set-Cookie | **pass** | `authjs.session-token`; `SameSite=lax`, `HttpOnly`, sem `Secure` (HTTP local) |
| Sessão | **pass** | `roles: ["secretary_general"]` |
| GET `/recognition` | **pass** — HTTP **200** | |
| GET `/ops` | **pass** — HTTP **200** | Links operacionais visíveis (ex. «Fila de normalização») |

**Nota UX (não bloqueia P0.1):** `app/ops/page.tsx` só acrescenta o rótulo «Secretário Geral» para `admin`/`registrar`, não para `secretary_general`. A sessão reflecte correctamente `secretary_general`; o painel carrega e filas operacionais estão acessíveis via RBAC.

---

## FLUXO C — Admin (sem regressão)

| Passo | Resultado | Evidência |
| --- | --- | --- |
| POST `/api/auth/landing-login` | **pass** — HTTP **200** | |
| Sessão | **pass** | `roles: ["admin","registrar"]` |
| GET `/ops` | **pass** — HTTP **200** | Filas admin/registrar disponíveis («Fila de normalização», «Leitura de revisão», etc.) |

---

## Caminho alternativo — Hub `/login` (sanity)

| Passo | Resultado |
| --- | --- |
| POST `/api/auth/callback/credentials` (CSRF + admin) | **pass** — HTTP **302**, `Set-Cookie` session |
| GET `/ops` com cookie | **pass** — HTTP **200** |

---

## Verificações técnicas

| Item | Resultado |
| --- | --- |
| OPTIONS preflight `landing-login` | **pass** — HTTP **204**, CORS credentialed |
| Credenciais inválidas | **pass** — HTTP **401**, `{ "error": "Invalid email or password." }` |
| Cookie `SameSite` | `Lax` (local HTTP — correcto) |
| Cookie `Secure` | ausente em local HTTP — esperado |
| Erros CORS cross-origin | **nenhum** nos testes HTTP com `Origin: http://localhost:3001` |

---

## Comandos automáticos (2026-05-20)

| Comando | Exit |
| --- | --- |
| `npm run lint` | 0 (sessão anterior em `main`) |
| `npm run test:no-db` | 0 |
| `npm test` (com Docker) | 0 — **181/181** |
| Script curl P0.1 (landing-login × 3 users) | 0 — todos **PASS** |

---

## Limitações / deferido

- Teste **browser DevTools** (consola JS, redirect `window.location` após submit do formulário React) não registado nesta sessão; fluxo HTTP reproduz o contrato da landing (`fetch` + redirect para `hubContinuePath`).
- **Produção Vercel** (dois domínios, `Secure` cookies): smoke test separado (P2).
- Rótulo «Secretário Geral» no painel para role `secretary_general`: melhoria UX P1.

---

## Conclusão

**P0.1 fechado:** landing → `POST /api/auth/landing-login` → cookie de sessão → `/recognition` → `/ops` funciona para membro provisório, Secretary-General e admin, com CORS credentialed e rejeição 401 para password errada.
