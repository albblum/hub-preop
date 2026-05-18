# Evidências — piloto schema v2 Fase 1 (lab)

**Data:** 2026-05-18  
**Branch:** `feat/hub-preop-schema-v2-phase1`  
**Commit HEAD:** `d465cd56492dc27e8d4309576958ecb7c6f8b47e`  
**Node:** v22.19.0  
**Ambiente:** Docker Postgres local (`hub-preop/docker compose up -d`)

---

## Step 6.1 — Suite automatizada

| Comando | Resultado |
|---------|-----------|
| `npx prisma validate` | OK |
| `npx prisma migrate deploy` | OK — 13 migrations, **no pending** |
| `npm test` (com BD) | **179 passed** (43 files, ~940ms) |
| `SKIP_DB=1 npm test` | **147 passed**, **32 skipped** (9 files skipped) |
| `npm run lint` | Exit 0 — **1 warning** (`instrument-service.v2-guards.test.ts`: unused `describe`) |

**Regressão v1 (automática):** suites `createInstrument`, `appendInstrumentVersion`, transition monolith/multipart e guards v2 cobertos em `npm test` — todos verdes.

---

## Step 6.2 — Checklist mapa PO

### A) Foundation (`idr:c:foundation`)

| # | Critério | Resultado | Notas |
|---|----------|-----------|-------|
| A1 | s0 + s2 com cláusulas e texto | ✅ | s0: **30** cláusulas; s2: **24**; total **54** (handoff-03) |
| A2 | s1, s3–s8 `deferred` sem `ClauseVersion.body` | ✅ | 7 secções deferred, **0** `clause_versions` cada |
| A3 | Ordem secções position 0,1,2,… | ✅ | s0→s8 positions 0–8; pilot em s0,s2 |
| A4 | Agregado derived legível | ✅ | GET facade + GET `/render` (public) — content ~12 473 chars; hash alinhado handoff-04 |
| A5 | Resolução `idrRef` semântico | ✅ | GET `idr%3Ac%3Afoundation` 200; árvore persistida + registry |

**SQL — secções:**

```
 code | position | migrationPhase | nonNormative 
------+----------+----------------+--------------
 s0   |        0 | pilot          | f
 s1   |        1 | deferred       | f
 s2   |        2 | pilot          | f
 s3–s8|    3–8   | deferred       | f
```

**SQL — cláusulas por secção:** apenas `s0` (30) e `s2` (24).

### B) Preop-regime (`idr:c:preop-regime`)

| # | Critério | Resultado | Notas |
|---|----------|-----------|-------|
| B1 | s0–s2 completos | ✅ | **57** cláusulas (handoff-03) |
| B2 | Metadados sunset | ✅ | `terminationDate` 2026-12-31; `terminationRequiresExplicitAct` true; `terminationAuthorizedBy` secretary_general; `terminationConditions` array preenchido |
| B3 | `s2` `nonNormative=true` | ✅ | SQL + `sectionsSummary[].nonNormative` true em s2 |
| B4 | `parentInstrumentId` → foundation | ✅ | join: child `idr:c:preop-regime` → parent `idr:c:foundation` |
| B5 | §5(ii) no texto (data referência) | ✅ | Texto em `…:art.en:§5:cl:2` e `…:art.pt:§5:cl:2` (“2026-12-31 (UTC-3)” / “31/12/2026”); mapa PO cita `cl:3` — **indexação parser** usa `cl:2` para alínea (ii) |

**curl preop facade (resumo):**

```json
{
  "structuralProfile": "v2",
  "terminationDate": "2026-12-31",
  "sectionsSummary": [
    { "code": "s0", "nonNormative": false },
    { "code": "s1", "nonNormative": false },
    { "code": "s2", "nonNormative": true }
  ]
}
```

### C) Convivência v1/v2 (Fase 5)

| # | Critério | Resultado | Notas |
|---|----------|-----------|-------|
| C1 | v1 count inalterado | ⚠️ | **83** v1 agora; prompt passo-02 referia **27** em snapshot antigo — lab ganhou instrumentos (ingest/seed), **não** por conversão v1→v2; perfis: v1=83, v2=2, total=85 |
| C2 | POST `/content` em v2 → 400 | ✅ | `content/route.auth.test.ts` — `V2_WRITE_PATH_BLOCKED` |
| C3 | POST cláusula v2 → versão + agregado | ✅ | `append-clause-and-reaggregate.db.test.ts` + handoff-05 |

### D) Registry `IdrRef`

| # | Critério | Resultado |
|---|----------|-----------|
| D1 | `IdrRefRegistry` cobre piloto | ✅ | **113** entradas (documentos + cláusulas piloto) |

---

## Instrumentos v2 piloto (SQL)

```
       idrRef       | structuralProfile | currentVersion 
--------------------+-------------------+----------------
 idr:c:foundation   | v2                |              1
 idr:c:preop-regime | v2                |              1
```

---

## Comandos reproduzíveis

```bash
cd hub-preop
docker compose up -d
npx prisma validate && npx prisma migrate deploy
npm test
SKIP_DB=1 npm test

curl -sS "http://localhost:3000/api/doc-hub/v0/instruments/idr%3Ac%3Afoundation/render" | jq '{idrRef, contentLen: (.content | length)}'
curl -sS "http://localhost:3000/api/doc-hub/v0/instruments/idr%3Ac%3Apreop-regime" | jq '{structuralProfile, terminationDate, sectionsSummary}'
```
