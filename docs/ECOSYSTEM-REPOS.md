# Repositórios do ecossistema IDR (pre-op)

Este ficheiro liga o **Hub pré-operacional** a outros repositórios do mesmo produto, para sessões de trabalho e onboarding sem perder contexto.

| Repositório | Papel |
|-------------|--------|
| **`hub-preop/`** (este repo) | Aplicação Next.js + PostgreSQL + Prisma: registo de instrumentos, comité, ledger, APIs internas e DocHUB. **Fonte única de verdade para código da app.** |
| **[v0-idr-landing-page](https://github.com/albblum/v0-idr-landing-page)** | Landing pública (v0): marketing, entrada no produto, ligações para demo ou futuro domínio. **Não** substitui o Hub; não partilha base de dados com este repo. Código espelhado no workspace: `Cursor_project1/v0-idr-landing-page/` (ver README nessa pasta). |

## Integração landing ↔ Hub

- **Login de membro (principal):** formulário na landing → `POST {HUB}/api/auth/landing-login` com `{ "email", "password", "next"?: "/ops" }` e `fetch(..., { credentials: "include" })`; em sucesso o browser recebe cookies de sessão do Hub e segue para `{HUB}/recognition?...`. A mesma lista `PUBLIC_SUBSCRIBER_ALLOWED_ORIGINS` controla o CORS deste POST e do formulário de subscritores.
- **Login no Hub (alternativo):** `{HUB}/login?callbackUrl=%2Fops&from=public-site` — útil para marcadores ou diagnóstico.
- **Biblioteca (UI):** `{HUB}/public`
- **Subscritores (POST):** `{HUB}/api/public/subscribers` — corpo `{ "name", "email" }`.
- **Site público “Home” no Hub:** com `NEXT_PUBLIC_LANDING_ORIGIN`, os links de início no Hub voltam à landing; em `/login`, `from=public-site` mostra **«Voltar ao site público do IDR»** quando essa variável está definida. Caminhos internos em `callbackUrl` / `next` são validados no servidor.

## Continuidade de trabalho (Machine)

1. Implementação normativa e UI operacional: **`hub-preop/`** (ver `docs/prompt-implementador-fase-autoridade-instrument-based.md` e handoff IBA em `parallel-project-kit/docs/handoffs.md` quando existir no workspace).
2. Próximo passo técnico sugerido pós-IBA: validação do **instrumento de nomeação** referenciado por `authorityInstrumentId` (estado mínimo) e/ou leitura fresca de `CommitteeMembership` em runtime — conforme decisão do Pilot.
3. Landing: alterações apenas no repo **v0-idr-landing-page**; aqui mantém-se só este índice e o link.

## Nota

A raiz `Cursor_project1` pode conter vários artefactos (metodologia, kit, deeds). O **Git da aplicação** continua a ser só dentro de `hub-preop/`, conforme `CLAUDE.md` na raiz do workspace.
