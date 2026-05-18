## Handoff — Passo 3 (Fase 3)

- **Branch:** `feat/hub-preop-schema-v2-phase1`
- **Commits:** `b8d279d` (scripts + domínio) · `6962cb5` (parser + handoff pós-carga lab)
- **Foundation:** `idr:c:foundation` — 9 secções (s0+s2 pilot, s1/s3–s8 `deferred`); **54 cláusulas**; registry documento + cláusulas
- **Preop-regime:** `idr:c:preop-regime` — s0–s2; `terminationDate` 2026-12-31; `s2` `nonNormative=true`; **57 cláusulas**; `parentInstrumentId` → foundation
- **Aliases HUB-INSTR:** **0** na carga lab (sem monólitos v1 com título igual ao `FILE_ORDER` do ingest)

| Ficheiro legado | Secção v2 (note) |
|-----------------|------------------|
| `PREAMBLE.md` | `s0` |
| `INTRODUCTION.md` | `s1` |
| `ARTICLE I …` | `s2` |
| `ARTICLE II` … `VII` | `s3` … `s8` |

- **Normalização minúsculas:** sim (`idr-ref-grammar.ts`, `normalizeSegmentCode`, `§5-a`)
- **PREAMBLE PT §6:** **validado** — removido `` ``` `` no corpus; gate 3.7 OK
- **Correções parser (pós-carga):**
  - Blocos `---` múltiplos (cabeçalho + EN/PT no Preamble)
  - Alíneas PT `i)` / `ii)` sem parênteses
  - Cláusulas numeradas por ordem no parágrafo (evita colisão `idrRef` em §4.1 PRC)
  - `defaultArticleCode: "pt"` no corpo PT da Norma (secção s1)
  - Sem texto introdutório extra em parágrafos com alíneas `(i)…`
- **Idempotência:** aborta se `idr:c:foundation` ou `idr:c:preop-regime` já existir
- **dry-run / carga real (lab):**
  - `load-v2-constitutional-foundation.ts --dry-run` — OK
  - `load-v2-preop-regime.ts --dry-run` — OK (~57 cláusulas após fix parser)
  - Carga real: **Foundation + Preop executados** na BD lab
- **npm test:** 135 pass + 22 skip (`SKIP_DB=1`)
- **Próximo passo:** Fase 4 (agregado + leitura); aliases quando existirem monólitos v1 na BD
- **Riscos:** §4.1 PRC — contagem de `cl:N` por ordem editorial pode diferir do mapa PO (6 vs N alíneas); re-run exige apagar instrumentos v2
