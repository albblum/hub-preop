## Handoff — Passo 3 (Fase 3)

- **Branch:** `feat/hub-preop-schema-v2-phase1` (confirmar com `git branch --show-current` antes do push)
- **Commit:** `c136d83` — `feat(hub-preop): Phase 01 step 03 — load v2 constitutional pilot pair`
- **Foundation:** `idr:c:foundation` — script `scripts/load-v2-constitutional-foundation.ts`; s0+s2 pilot, s1/s3–s8 `deferred` (secção sem cláusulas); aliases `idr:HUB-INSTR-*` → `idr:c:foundation` com `note` da secção v2
- **Preop-regime:** `idr:c:preop-regime` — script `scripts/load-v2-preop-regime.ts`; s0–s2; `terminationDate` 2026-12-31; `s2` com `nonNormative=true`; requer Foundation carregado primeiro
- **Aliases HUB-INSTR:** até 9 linhas (uma por monólito v1 encontrado na BD, ordem `FILE_ORDER`); `canonicalRef` = `idr:c:foundation`; ver `lib/normative/load/legacy-aliases.ts`

| Ficheiro legado | Secção v2 (note) |
|-----------------|------------------|
| `PREAMBLE.md` | `s0` |
| `INTRODUCTION.md` | `s1` |
| `ARTICLE I …` | `s2` |
| `ARTICLE II` … `VII` | `s3` … `s8` |

- **Normalização minúsculas:** sim — `idr-ref-grammar.ts` usa `CODE_LOWER` em secção/artigo/parágrafo/cláusula; `normalizeSegmentCode` na carga; `§5-A` → `§5-a`
- **PREAMBLE PT §6:** **bloqueado** — fonte `PREAMBLE.md` contém `` ``` `` antes do §6 PT; gate 3.7 aborta com mensagem explícita (escalar Pilot / workshop PO)
- **Idempotência:** se `idr:c:foundation` ou `idr:c:preop-regime` já existir, o script **aborta** (sem upsert automático)
- **dry-run / carga real:**
  - `npx tsx scripts/load-v2-preop-regime.ts --dry-run` — OK (~65 cláusulas, 3 secções, amostra `idr:c:preop-regime:s0:art.en:§5:cl:3`)
  - `npx tsx scripts/load-v2-constitutional-foundation.ts --dry-run` — **falha no gate PT §6** (esperado até corrigir corpus)
  - Carga real na BD lab: **não executada** nesta sessão (bloqueio PREAMBLE)
- **npm test:** 134 pass + 22 skip com `SKIP_DB=1`; suites `describeIfDb` requerem BD para integração
- **prisma validate:** OK
- **Próximo passo:** corrigir `PREAMBLE.md` PT §6 com PO → carga real Foundation + Preop → Fase 4 (agregado + leitura)
- **Riscos:** monólitos v1 sem título exacto do ingest não recebem alias; re-run exige apagar instrumentos v2 manualmente; §4.1 PRC pode ter sub-cláusulas extra vs mapa PO (revisão amostral)
