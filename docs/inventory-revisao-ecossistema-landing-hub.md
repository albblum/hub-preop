# Inventario R-0 — Revisao ecossistema landing + Hub

**Data:** 2026-05-15 (actualizacao de evidencia R-1; inventario inicial 2026-05-13)  
**Escopo:** Hub pre-operacional (`hub-preop/`), landing publica v0 (`v0-idr-landing-page/`) e contratos entre ambos.  
**Estado:** R-0 aprovado; R-2.1 CORS entregue; R-1 automatico verde em 2026-05-15; checklist manual e `Set-Cookie` em browser **pendentes** (Docker indisponivel nesta sessao).

## Leitura obrigatoria realizada

- `CLAUDE.md`
- `docs/methodology/pilot-machine-methodology.md`
- `hub-preop/docs/ECOSYSTEM-REPOS.md`
- `hub-preop/docs/OPERATIONS.md`
- `hub-preop/README.md`
- `v0-idr-landing-page/README.md`
- `v0-idr-landing-page/INSTRUCOES-DEPLOY.pt.md`
- `parallel-project-kit/STATUS.md`
- `parallel-project-kit/docs/handoffs.md`
- Prompt da fase: `hub-preop/docs/prompt-implementador-revisao-completa-ecossistema.md`

## R-0.1 Superficie Hub

### Rotas App Router relevantes

| Rota | Ficheiro | Protecao / comportamento atual | Observacoes |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Publica; usa `useSession` para mostrar links internos e fetches com credenciais para operacoes | Link "Site publico IDR" usa `NEXT_PUBLIC_LANDING_ORIGIN` via `PublicMarketingHomeLink`. |
| `/login` | `app/login/page.tsx` | Publica; fluxo alternativo com `next-auth/react` `signIn("credentials")` | Sanitiza `callbackUrl` com `safeInternalPath`; mostra "Voltar ao site publico" apenas com `from=public-site` + `NEXT_PUBLIC_LANDING_ORIGIN`. |
| `/recognition` | `app/recognition/page.tsx` | Cliente; exige sessao via `useSession`, mas nao esta no `middleware` | Sanitiza `next`; botao "Encerrar sessao" volta para landing se `NEXT_PUBLIC_LANDING_ORIGIN` estiver definido. |
| `/ops` | `app/ops/page.tsx` | Protegida por `middleware.ts` e por `auth()` no server component | Redirect sem sessao para `/login?callbackUrl=/ops`; home label usa landing quando configurada. |
| `/public` | `app/public/page.tsx` | Publica; `dynamic = "force-dynamic"` | Catalogo publico, link de home usa landing quando configurada. |
| `/public/[idrRef]` | `app/public/[idrRef]/page.tsx` | Publica; `dynamic = "force-dynamic"` | Decodifica `idrRef`, aceita `?version=n`, link de home usa landing quando configurada. |
| `/review` | `app/review/page.tsx` | Protegida por `middleware.ts` e por `auth()` | Sem sessao redireciona para `/login?callbackUrl=/review`; sem permissao redireciona para landing se configurada, senao `/`. |
| `/review/[idrRef]` | `app/review/[idrRef]/page.tsx` | Protegida por `middleware.ts` e por `auth()` | Sem sessao redireciona para `/login?callbackUrl=/review`; sem permissao redireciona para landing se configurada, senao `/`. |
| `/normalization` | `app/normalization/page.tsx` | Protegida por `middleware.ts` e por `auth()` | Sem permissao redireciona para `/`, nao para landing; possivel inconsistencia UX com `/review`. |
| `/instruments/[id]/edit` | `app/instruments/[id]/edit/page.tsx` | Protegida por `middleware.ts`; fetches de API com `credentials: "include"` | UI diferencia monolito vs multipart; usa `NEXT_PUBLIC_LANDING_ORIGIN` apenas para label/estado de home. |
| `/comite` e filhos | `app/comite/layout.tsx`, `app/comite/page.tsx`, `app/comite/instrumento/[id]/page.tsx`, `app/comite/referencias/page.tsx` | Protegida no layout via `auth()` + `mayAccessComiteWorkspace`; nao esta no matcher do middleware | Sem sessao redireciona para `/login?callbackUrl=/comite`; sem permissao redireciona para `/ops`. |

### APIs publicas / cross-origin

| API | Ficheiro | Metodo(s) | Contrato atual | Risco / observacao |
| --- | --- | --- | --- | --- |
| `/api/public/subscribers` | `app/api/public/subscribers/route.ts` | `OPTIONS`, `POST` | Preflight 204 se origem permitida; POST valida `{ name, email }`; upsert em `PublicSubscriber`; idempotente por email | Usa `subscriberCorsHeaders`; para este fluxo a landing nao envia `credentials: "include"`. |
| `/api/auth/landing-login` | `app/api/auth/landing-login/route.ts` | `OPTIONS`, `POST` | Preflight 204 se origem permitida; POST valida `{ email, password, next? }`; chama `signIn("credentials", { redirect: false, redirectTo })`; responde `{ ok, hubContinuePath }` | CORS credentialed corrigido em R-2.1 (`Access-Control-Allow-Credentials: true`). Testes sem DB em `app/api/auth/landing-login/route.test.ts`. **Pendente:** evidencia de `Set-Cookie` na resposta HTTP real e sessao em `/recognition` apos Caminho A (ver `docs/p0-1-sessao-login-evidencia.md`). |

### Middleware e sessao

`middleware.ts` usa `NextAuth(authConfig)` e protege apenas:

- `/ops/:path*`
- `/normalization/:path*`
- `/review`
- `/review/:path*`
- `/instruments/:id/edit`

Rotas `/public/**`, `/login`, `/recognition` e APIs publicas/cross-origin nao passam por esse matcher. `/comite/**` nao passa pelo middleware, mas e protegido no `app/comite/layout.tsx`.

### Auth

| Ficheiro | Papel | Observacoes |
| --- | --- | --- |
| `auth.ts` | Define provider Credentials e exporta `handlers`, `auth`, `signIn`, `signOut` | Fonte de verdade para credenciais: Prisma `user.findUnique({ email })` + `bcrypt.compare(password, user.passwordHash)`. Inclui memberships ativas na claim de sessao. |
| `auth.config.ts` | Config comum Auth.js | `trustHost: true`; GitHub opcional via `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`; sessao JWT, `maxAge` 8h; pagina de login `/login`. Nao ha configuracao explicita de cookies/SameSite. |
| `app/api/auth/[...nextauth]/route.ts` | Rota canonica NextAuth | Reexporta `GET` e `POST` de `handlers`. |

Hipotese tecnica a validar em R-1/R-2: `landing-login` e `/login` usam a mesma fonte de verdade (Prisma + bcrypt), mas ainda falta evidencia de browser/header de que `signIn` dentro de Route Handler devolve cookies utilizaveis no fluxo cross-origin.

### CORS

`lib/public-subscriber-cors.ts` le `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS`, separa por virgula, remove uma barra final e compara com `Origin` normalizado. Quando a origem e permitida, devolve:

- `Access-Control-Allow-Origin: <origem exata>`
- `Access-Control-Allow-Methods: POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`
- `Vary: Origin`

**R-2.1 (2026-05-13):** `Access-Control-Allow-Credentials: true` adicionado em `subscriberCorsHeaders` para origens permitidas. Testes em `lib/public-subscriber-cors.test.ts` e `app/api/auth/landing-login/route.test.ts`.

### Navegacao "site publico"

| Ficheiro | Comportamento |
| --- | --- |
| `lib/public-marketing-home.ts` | Normaliza `NEXT_PUBLIC_LANDING_ORIGIN` removendo barra final; retorna `undefined` se ausente. |
| `components/public-marketing-home-link.tsx` | Se landing estiver configurada, renderiza `<a href={landing}>`; senao usa `<Link href="/">`. |
| `lib/safe-internal-path.ts` | Aceita apenas paths internos iniciados por `/`; rejeita `//host`, `://`, `\`, `@`; tenta `decodeURIComponent`. |

Pontos de entrada observados:

- `/login`: `callbackUrl` e convertido para `/recognition?next=...` depois de `safeInternalPath`.
- `/api/auth/landing-login`: `next` e sanitizado antes de montar `hubContinuePath`.
- `/recognition`: `next` e sanitizado antes do link "Continuar para o painel".
- `review/*`: sem permissao redireciona para landing se configurada.

### Seed e scripts

| Item | Ficheiro | Comportamento |
| --- | --- | --- |
| Seed principal | `scripts/seed-founding.ts` | Cria/garante usuarios `admin@hub-preop.local`, `reviewer@hub-preop.local`, `viewer@hub-preop.local`; senhas vem de `SEED_ADMIN_PASSWORD`, `SEED_REVIEWER_PASSWORD`, `SEED_VIEWER_PASSWORD` com defaults `ChangeMe...`. |
| Atualizar usuarios existentes | `SEED_UPDATE_EXISTING_PASSWORDS` | Se `1` ou `true`, usuarios existentes tem hash, nome e roles atualizados; sem isso, usuarios existentes mantem hash antigo. |
| Seed so usuarios | `package.json` | `npm run seed:users-only` define `SEED_SKIP_INSTRUMENTS=1`. |
| Refresh de senhas | `package.json` | `npm run seed:users-refresh-passwords` define `SEED_UPDATE_EXISTING_PASSWORDS=1 SEED_SKIP_INSTRUMENTS=1`. |

Risco operacional conhecido: mudar `SEED_*_PASSWORD` no `.env` depois de usuarios ja criados nao muda hashes existentes a menos que o operador rode `npm run seed:users-refresh-passwords`.

## R-0.2 Superficie landing v0

| Ficheiro | Papel | Observacoes |
| --- | --- | --- |
| `app/page.tsx` | Le `NEXT_PUBLIC_HUB_ORIGIN`; deriva `loginPostUrl`, `libraryHref`, `subscriberApiUrl` | Se a variavel estiver ausente, faz `throw` no render/build. Remove barra final. |
| `components/idr-landing.tsx` | Layout e links principais | "Sign in" aponta para `#member-login`; "Enter the Library" abre `${hubOrigin}/public`; link alternativo abre `${hubOrigin}/login?callbackUrl=%2Fops&from=public-site`. |
| `components/member-login-form.tsx` | Formulario de login membro | POST para `/api/auth/landing-login` com `credentials: "include"` e JSON `{ email, password, next: "/ops" }`; em sucesso navega para `${hubOrigin}${hubContinuePath}`. |
| `components/follow-the-idr-form.tsx` | Formulario publico de subscritores | POST JSON `{ name, email }` para `/api/public/subscribers`; nao envia credentials. |
| `package.json` | Scripts | `dev`, `dev:alt` (`-p 3001`), `build`, `lint`. |

**2026-05-15:** `v0-idr-landing-page/.env.local` tem uma unica linha activa (`NEXT_PUBLIC_HUB_ORIGIN=http://localhost:3000`). Em deploy Vercel, usar apenas o valor do ambiente de producao (sem duplicar no ficheiro commitado).

## R-0.3 Matriz de variaveis de ambiente

### Hub (`hub-preop/`)

| Variavel | Obrigatoria? | Exemplo local | Exemplo Vercel/deploy | Quem consome |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Sim para app com DB e seed | `postgresql://hub:hub@localhost:5432/hub_preop` | URL Postgres gerida pelo provedor | Prisma, rotas server-side, seed, `verify:reliability`, `check-env`. |
| `AUTH_SECRET` | Sim para Auth.js | valor forte local | segredo forte unico por ambiente | Auth.js/NextAuth; `check-env` valida presenca e tamanho minimo em `.env`. |
| `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS` | Obrigatoria para chamadas browser da landing | `http://localhost:3001` | `https://v0-idr-landing-page.vercel.app` | `lib/public-subscriber-cors.ts`, usado por `/api/public/subscribers` e `/api/auth/landing-login`. |
| `NEXT_PUBLIC_LANDING_ORIGIN` | Opcional, mas necessaria para UX "voltar ao site publico" | `http://localhost:3001` | `https://v0-idr-landing-page.vercel.app` | `lib/public-marketing-home.ts`, `/`, `/login`, `/recognition`, `/public`, `/review`, `/ops`, `/instruments/[id]/edit`. |
| `SEED_ADMIN_PASSWORD` | Opcional em lab; recomendada | `ChangeMeAdmin!` ou segredo local | Nao recomendado para prod real sem politica propria | `scripts/seed-founding.ts`. |
| `SEED_REVIEWER_PASSWORD` | Opcional em lab; recomendada | `ChangeMeReviewer!` | Nao recomendado para prod real sem politica propria | `scripts/seed-founding.ts`. |
| `SEED_VIEWER_PASSWORD` | Opcional em lab; recomendada | `ChangeMeViewer!` | Nao recomendado para prod real sem politica propria | `scripts/seed-founding.ts`. |
| `SEED_SKIP_INSTRUMENTS` | Opcional | `1` para usuarios somente | Normalmente ausente | `scripts/seed-founding.ts`, `npm run seed:users-only`. |
| `SEED_UPDATE_EXISTING_PASSWORDS` | Opcional; necessaria apos trocar senhas de seed | `1` via `npm run seed:users-refresh-passwords` | Usar apenas com cuidado em lab/deploy controlado | `scripts/seed-founding.ts`. |
| `AUTH_URL` | Opcional/documentada | `http://localhost:3000` | URL publica do Hub | Documentada em `.env.example`/`OPERATIONS.md` para callbacks OAuth; nao ha leitura direta por codigo via `process.env` (Auth.js pode usar implicitamente). |
| `NEXTAUTH_URL` | Nao documentada como consumo direto | n/a | n/a | Nenhuma leitura direta encontrada no codigo; se usada, seria por compatibilidade/infra do Auth.js, nao por codigo local. |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | Opcional | ausente | valores OAuth se GitHub ativado | `auth.config.ts` adiciona provider GitHub quando ambos existem. |

### Landing (`v0-idr-landing-page/`)

| Variavel | Obrigatoria? | Exemplo local | Exemplo Vercel/deploy | Quem consome |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_HUB_ORIGIN` | Sim | `http://localhost:3000` | URL publica do Hub, sem barra final | `app/page.tsx`; deriva login da landing, biblioteca publica e API de subscritores. |

## R-0.4 Riscos conhecidos para validar

1. ~~**P0 — CORS credentialed incompleto.**~~ **Resolvido (R-2.1):** `Access-Control-Allow-Credentials: true` em origens permitidas.
2. **P0/P1 — cookies de sessao em login cross-origin.** Mesmo com CORS corrigido, e necessario verificar se a chamada `signIn` no Route Handler emite `Set-Cookie` na resposta e se browsers aceitam esse cookie no contexto landing -> Hub. Como nao ha configuracao explicita de SameSite/cookies em `auth.config.ts`, isto deve ser validado em HTTPS real e em local.
3. **P1 — origem exata na allowlist CORS.** A allowlist compara origem exata apos remover uma barra final. Porta, protocolo e host precisam bater exatamente: `http://localhost:3001` e diferente de `http://127.0.0.1:3001`, `http://localhost:3000` ou `https://...`.
4. **P1 — senhas de seed vs hashes existentes.** Se `SEED_*_PASSWORD` foi alterada depois de o usuario existir, login falha ate rodar `npm run seed:users-refresh-passwords`.
5. ~~**P2 — `.env.local` da landing com valor duplicado.**~~ **Resolvido localmente (2026-05-15):** uma unica linha em `.env.local`; manter disciplina por ambiente.
6. **P2 — consistencia de redirects sem permissao.** `/review` usa landing quando configurada; `/normalization` redireciona para `/`; `/comite` redireciona para `/ops`. Nao e necessariamente bug, mas precisa de validacao UX.

## R-1 planejado — reproducao e evidencia

### Ambiente local recomendado para teste

- Hub: `http://localhost:3000`
- Landing: `http://localhost:3001` via `npm run dev:alt`
- Hub `.env` minimo:
  - `DATABASE_URL="postgresql://hub:hub@localhost:5432/hub_preop"`
  - `AUTH_SECRET="<valor forte local>"`
  - `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS="http://localhost:3001"`
  - `NEXT_PUBLIC_LANDING_ORIGIN="http://localhost:3001"`
  - `SEED_ADMIN_PASSWORD`, `SEED_REVIEWER_PASSWORD`, `SEED_VIEWER_PASSWORD` conforme teste
- Landing `.env.local`:
  - `NEXT_PUBLIC_HUB_ORIGIN="http://localhost:3000"`

### Checklist manual minimo

| Fluxo | Resultado esperado | Estado R-0 |
| --- | --- | --- |
| Landing Home/About/scroll `#member-login` | Pagina carrega; links internos funcionam | **skip** — sem servidores dev nesta sessao |
| Login landing com credenciais erradas | Erro controlado, idealmente HTTP 401 JSON | **parcial** — teste automatizado 401 em `route.test.ts`; browser pendente |
| Login landing com seed valido | Cookie de sessao no Hub; navega para `/recognition?next=%2Fops` | **pendente** — requer Hub+BD+`curl -D -` ou DevTools |
| `/recognition` -> continuar | Chega a `/ops` autenticado | **pendente** |
| "Enter the Library" | Abre `${HUB}/public` | **skip** |
| "Follow the IDR" | POST subscritor com sucesso ou erro DB claro | **skip** (requer BD) |
| Hub `/login?callbackUrl=%2Fops&from=public-site` | Login alternativo e link "Voltar ao site publico" | **pendente** |
| Links "Site publico IDR" / "Inicio do Hub" | Label e destino coerentes com `NEXT_PUBLIC_LANDING_ORIGIN` | **pendente** |
| Encerrar sessao em `/recognition` | Remove sessao e volta para landing quando configurada | **pendente** |

### Comandos automaticos a executar em R-1

Hub (`hub-preop/`):

- `npm run lint`
- `npm run test:no-db`
- `npm run build`
- `npm run verify:reliability` se Docker/BD estiverem disponiveis

Landing (`v0-idr-landing-page/`):

- `npm run lint`
- `npm run build`

### Evidencia automatica R-1

| Area | Comando | Data | Exit | Resumo |
| --- | --- | --- | --- | --- |
| Hub | `npm run lint` | 2026-05-13 | 0 | ESLint OK |
| Hub | `npm run test:no-db` | 2026-05-13 | 0 | 28 files / 114 tests |
| Hub | `npm run build` | 2026-05-13 | 0 | Next 15.5.15, 29 paginas |
| Hub | `npm run verify:reliability` | 2026-05-13 | 0 | Docker+BD+build (sessao anterior) |
| Landing | `npm run lint` + `build` | 2026-05-13 | 0 | Next 15.5.18, 4 paginas |
| Hub | `npm run lint` | **2026-05-15** | 0 | ESLint OK |
| Hub | `npm run test:no-db` | **2026-05-15** | **0** | 30 passed / 2 skipped; **121** tests passed (apos mock Prisma em auth tests + `landing-login/route.test.ts`) |
| Hub | `npm run build` | **2026-05-15** | 0 | Build OK |
| Hub | `npm run verify:reliability` | **2026-05-15** | **skip** | Docker daemon indisponivel (`docker.sock` ausente) |
| Landing | `npm run lint` + `build` | **2026-05-15** | 0 | ESLint + build OK (`.env.local` com `http://localhost:3000`) |

**Regressao corrigida (2026-05-15):** `test:no-db` falhava quando Postgres estava parado porque `content/route.auth.test.ts` e `transition-to-multipart/route.auth.test.ts` chamavam Prisma sem mock. Corrigido com `vi.mock("@/lib/prisma")`.

## R-3 preliminar — fila de correcao proposta

Esta lista e preliminar; deve ser confirmada com evidencia R-1 antes de mudancas amplas.

| Prioridade | Item | Ficheiros provaveis | Mudanca proposta | Validacao |
| --- | --- | --- | --- | --- |
| ~~P0~~ | ~~CORS credentialed~~ | `lib/public-subscriber-cors.ts` | **Feito (R-2.1)** | Testes CORS + `landing-login` route |
| P0 | Confirmar cookie de sessao no `landing-login` | `app/api/auth/landing-login/route.ts`, eventual `auth.config.ts` (`cookies.sameSite`) | `signIn` usa `cookies().set()` (Auth.js); em producao cross-domain pode exigir `SameSite=None; Secure` | `curl -D -` ou DevTools; ver `docs/p0-1-sessao-login-evidencia.md` |
| ~~P1~~ | ~~Env duplicado landing~~ | `.env.local` | **Feito localmente** | Uma linha activa |
| P1 | `test:no-db` sem Prisma | auth route tests | **Feito 2026-05-15** — mock Prisma | `npm run test:no-db` exit 0 sem Docker |
| P1 | Seed/login de laboratorio | Docs e possivelmente scripts existentes | Documentar e validar `npm run seed:users-refresh-passwords` no fluxo de reproducao | Login com senha atual do `.env` passa apos refresh. |
| P2 | Consistencia de UX/redirects | `app/normalization/page.tsx`, docs | Decidir se redirects sem permissao devem voltar para landing quando configurada | Teste manual de usuario sem permissao; sem open redirect. |

## R-2 — Correcao pontual autorizada apos gate R-0

**Gate:** Inventario R-0 aprovado pelo Pilot em 2026-05-13.

### R-2.1 CORS credentialed para landing-login

| Item | Resultado |
| --- | --- |
| Causa raiz tratada | O helper compartilhado `subscriberCorsHeaders` permitia origem especifica, metodos, headers e `Vary: Origin`, mas nao declarava `Access-Control-Allow-Credentials: true`; isso e necessario para o `fetch(..., { credentials: "include" })` usado pelo login da landing. |
| Ficheiro alterado | `lib/public-subscriber-cors.ts` |
| Teste adicionado | `lib/public-subscriber-cors.test.ts` |
| Reversibilidade | Mudanca local e aditiva no contrato CORS para origens ja autorizadas; origens fora da allowlist continuam sem headers CORS. |
| Validacao isolada | `npx vitest run lib/public-subscriber-cors.test.ts` — exit 0; 1 ficheiro / 3 testes passaram. |
| Validacao Hub pos-correcao | `npm run lint` — exit 0; `npm run test:no-db` — exit 0, 29 passed / 2 skipped, 117 testes passed / 11 skipped; `npm run build` — exit 0; `npm run verify:reliability` — exit 0 fora do sandbox, 31 test files / 128 testes passed, build OK. |

### R-2.2 Correcao `test:no-db` (2026-05-15)

| Item | Resultado |
| --- | --- |
| Sintoma | `npm run test:no-db` falhava com `Can't reach database server` em testes de autorizacao de rotas de instrumentos |
| Causa | Rotas chamam `prisma.instrument.findUnique` apos `auth()`; testes mockavam apenas `auth` |
| Fix | `vi.mock("@/lib/prisma")` em `content/route.auth.test.ts` e `transition-to-multipart/route.auth.test.ts`; novos testes em `landing-login/route.test.ts` |

### Riscos ainda pendentes apos R-2.1 / R-2.2

- Validacao manual/browser: `Set-Cookie` no `POST /api/auth/landing-login` e sessao em `/recognition` (Caminho A).
- Producao (dois dominios Vercel): cookies podem precisar `sameSite: "none"` + `secure: true` em `auth.config.ts` — so apos teste HTTPS.
- `/login` (Caminho B): se `signIn` devolver `res.url` vazio, utilizador fica sem redirect — validar em browser.

## Gate para o Pilot

Pelo metodo Pilot + AI Dev Machine, este inventario deve ser revisto antes de R-2+ com mudancas amplas. Ajustes pontuais e reversiveis para P0 podem ser autorizados explicitamente pelo Pilot a partir deste documento.
