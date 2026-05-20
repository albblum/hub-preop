# Rollback — schema v2 Fase 1 (laboratório)

**Migração alvo:** `schema_v2_normative_tree` (pasta em `prisma/migrations/`).

## Pré-requisitos

- Parar `npm run dev` e outros clientes da BD.
- Ter o dump criado antes do Passo 1 (`backups/hub_preop_YYYYMMDD_HHMMSS.dump`).

## Opção A — Restaurar backup (recomendado)

```bash
cd hub-preop
docker compose up -d
# Ver OPERATIONS.md §3 — restore interactivo ou:
npm run db:restore -- backups/hub_preop_<timestamp>.dump
```

## Opção B — Reverter migração Prisma (só se BD lab e sem dados v2)

```bash
cd hub-preop
npx prisma migrate resolve --rolled-back <nome_pasta_migracao>
# ou, em lab descartável:
npx prisma migrate reset --force
```

Depois de reset: `npm run seed:founding` se precisar de utilizadores de teste.

## Opção C — Reverter branch Git

```bash
cd hub-preop
git checkout main
git branch -D feat/hub-preop-schema-v2-phase1
```

Isto **não** reverte a BD; combinar com Opção A ou B.

## Verificação pós-rollback

```bash
npx prisma validate
curl -sS http://localhost:3000/api/health
```
