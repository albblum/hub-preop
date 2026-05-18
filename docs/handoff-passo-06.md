## Handoff — Passo 6 (Fase 6) — ENCERRAMENTO PILOTO LAB

| Campo | Valor |
|-------|--------|
| **Data** | 2026-05-18 |
| **Branch** | `feat/hub-preop-schema-v2-phase1` |
| **HEAD** | `d465cd56492dc27e8d4309576958ecb7c6f8b47e` |
| **Node** | v22.19.0 |

---

### Commits (range `main..HEAD`)

```
d465cd5 feat(hub-preop): Phase 01 step 05 — v2 clause write path and v1/v2 guards
1dfef1a feat(hub-preop): Phase 01 step 04 — v2 derived aggregate and DocHUB read path
d0ee612 docs(hub-preop): handoff passo 03 — commit hash after parser fix
6962cb5 fix(hub-preop): Phase 01 step 03 — parser fixes for pilot load
b8d279d feat(hub-preop): Phase 01 step 03 — load v2 constitutional pilot pair
```

(+ commits Fase 0–2 na mesma branch — ver `git log main..HEAD`)

---

### Verificação automatizada

| Item | Resultado |
|------|-----------|
| `prisma validate` | OK |
| `prisma migrate deploy` | OK — sem pendentes |
| `npm test` (BD) | **179/179** pass |
| `SKIP_DB=1 npm test` | **147** pass, **32** skip |
| `npm run lint` | OK (1 warning não bloqueante) |

Detalhe: [`pilot-evidence-phase1-v2.md`](./pilot-evidence-phase1-v2.md)

---

### Checklist mapa PO

| Bloco | Itens | Estado |
|-------|-------|--------|
| A Foundation | A1–A5 | ✅ |
| B Preop-regime | B1–B5 | ✅ (B5: `cl:2` no idrRef real, não `cl:3` do mapa) |
| C v1/v2 | C1 ⚠️ C2–C3 ✅ | C1: baseline 27 vs 83 v1 — ver evidências |
| D IdrRefRegistry | 113 entradas | ✅ |

---

### PR

**Pendente** — push/PR não executados nesta sessão (aguardar autorização Pilot).

Corpo do PR preparado (Passo 6.4 do plano):

- **Title:** `feat(hub-preop): constitutional schema v2 phase 1 pilot`
- **Rollback:** `docs/rollback-schema-v2-phase1.md`
- **Out of scope:** Foundation s1/s3–s8, UI comité, ADR 0011/0012

---

### Decisão `publishedAt` (Pilot)

| Opção | Estado |
|-------|--------|
| **A** | Manter piloto sem `publishedAt` (rascunho / `in-force` só no instrumento) |
| **B** | Publicar nós piloto — **não aplicado** |
| **C** | Adiar decisão — bloquear merge até PO |

**Registo implementador:** **C — adiar** até Pilot assinalar A ou B no PR.

---

### System registry (raiz workspace)

Actualizado em `System registry.MD` (raiz `Cursor_project1`):

| ID | Actualização |
|----|----------------|
| AR-017 | migrate applied + piloto lab carregado |
| AR-019 | Implemented — Fases 0–5 lab |
| AR-020 | Completed — plano Fase 0–6 executado |
| AR-021 | **novo** — este handoff + evidências |

**Nota Git:** repo da app = `hub-preop/` apenas; commit do registry na raiz fica à escolha do Pilot (ficheiro fora do remote hub-preop).

---

### Itens abertos pós-piloto

- Carga Foundation **s1, s3–s8** (`deferred` → pilot)
- Aliases `idr:HUB-INSTR-*` quando monólitos v1 existirem na BD alvo
- UI comité para edição por cláusula
- ADR 0011 (grafo) / 0012 (autoridade) / 0013 (gates MVP)
- Confirmar baseline **v1 count** no ambiente de merge (C1)
- Decisão **`publishedAt`** (A/B)
- Corrigir warning ESLint em `instrument-service.v2-guards.test.ts` (opcional)

---

### Recomendação

**Merge após:** Pilot/PO assinarem checklist do mapa, decisão `publishedAt`, e PR review com `npm test` + migrate deploy no CI/lab.

**Não mergear se:** PO rejeitar desvio `cl:2` vs `cl:3` em §5(ii) sem actualizar mapa ADR 0018.
