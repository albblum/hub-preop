# Handoff — Passo 1 (Fases 0–1)

| Campo | Valor |
|-------|--------|
| **Data** | 2026-05-18 |
| **Pilot** | Autorização migrate: **sim** (confirmado pelo Pilot) |
| **Branch** | `feat/hub-preop-schema-v2-phase1` |

---

## Resultado

| Item | Estado |
|------|--------|
| Migrate autorizado | **sim** |
| Branch criada | **sim** — `feat/hub-preop-schema-v2-phase1` |
| Backup BD | **OK** — `backups/hub_preop_20260518_111613.dump` |
| `schema.prisma` | **actualizado** — merge de `schema.v2-proposed.prisma` |
| Migração SQL | **aplicada** — `20260518120000_schema_v2_normative_tree` |
| CHECK annex→pai | **sim** — `Instrument_annex_requires_parent_check` |
| `prisma generate` | **OK** |
| `prisma migrate deploy` | **OK** (2026-05-18) |
| `prisma validate` | **OK** |
| `npm test` | **132/132 passed** |

---

## Migração

- **Nome:** `20260518120000_schema_v2_normative_tree`
- **Path:** `hub-preop/prisma/migrations/20260518120000_schema_v2_normative_tree/migration.sql`
- **Nota:** `PublicSubscriber` **excluído** desta migração (já existe `20260509120000_public_subscriber/`).

### Deploy (concluído 2026-05-18)

Backup: `backups/hub_preop_20260518_111613.dump`  
Migrate: `20260518120000_schema_v2_normative_tree` aplicada com sucesso.

---

## Documentação criada

| Ficheiro | Conteúdo |
|----------|----------|
| `docs/rollback-schema-v2-phase1.md` | Procedimento de rollback |
| `docs/corpus-paths-phase1-v2.md` | Paths do corpus Fase 3 |
| `docs/handoff-passo-01.md` | Este handoff |

---

## Corpus paths (Step 0.4)

- `AlblumZ deeds/IDR/02_Documentos/I. CONSTITUTIONAL FOUNDATION/` — 9 ficheiros OK
- `AlblumZ deeds/IDR/02_Documentos/Foudational Norm - Pre-Operational Stage.md` — OK

---

## Verificação pós-migrate

- Instrumentos existentes: `structuralProfile = v1` (default preservado).
- Tabelas v2 criadas (`NormativeSection`, `NormativeClause`, `IdrRefRegistry`, etc.).
- Constraint `Instrument_annex_requires_parent_check` presente.

---

## Próximo passo

**Fase 2** — domínio v2 (`lib/normative/*`) — aguardar OK Pilot após migrate deploy + backup confirmados.

---

## Riscos / pendências

1. **Backup obrigatório** antes do primeiro `migrate deploy` em ambiente com dados.
2. Ordem de migrações: garantir `20260509120000_public_subscriber` aplicada se a feature landing já estiver em uso (ficheiro untracked no working tree).
3. `schema.v1-snapshot.prisma` — snapshot local para diff; pode apagar ou não commitar.
