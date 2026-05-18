# Mapa humano de migração — Fase 1 (par constitucional)

**Status:** **Fechado pelo product owner** — referência para migração; **sem alteração** ao Hub, schema ou código até carga aprovada.  
**Base:** [ADR 0014](../../Docs/adr/0014-dochub-phase1-constitutional-structural-model.md) (aceite, actualizado 2026-05-18) + corpus em `AlblumZ deeds/IDR/02_Documentos/`.  
**idrRef documento 2:** `idr:c:preop-regime` (alinhado ADR 0014).  
**Convenção:** ficheiro editorial → **Secção**; blocos EN/PT → `art.en` / `art.pt`; parágrafos `§`; cláusulas `cl:N` = alíneas `(i)…` ou corpo único.

---

## Escopo do piloto (decisão PO)

| Documento | No piloto Fase 1 | Fora do piloto (`phase: deferred`) |
|-----------|------------------|-------------------------------------|
| **I. Constitutional Foundation** | **Preamble** `idr:c:foundation:s0` + **Article I** `idr:c:foundation:s2` (desdobramento completo de cláusulas) | Introduction `s1`; Articles II–VII `s3`–`s8` |
| **Foundational Norm** | Documento completo em v2 (corpo normativo EN `s0` + PT `s1` + Change Log `s2`) | — |

Migração **atómica do par** no gate de aceite: Foundation (s0+s2) + Norma pré-operacional completa.

---

## Cabeçalho — `idr:c:preop-regime` (metadados v2, sem implementar)

```json
{
  "terminationDate": "2026-12-31",
  "terminationRequiresExplicitAct": true,
  "authorizedBy": "secretary_general",
  "conditions": [
    "committees_constituted",
    "committee_members_active",
    "formal_act_by_secretary_general"
  ],
  "sourceTextRefs": {
    "terminationDateHistorical": "idr:c:preop-regime:s0:art.en:§5:cl:3",
    "terminationDateHistoricalPt": "idr:c:preop-regime:s1:art.pt:§5:cl:3"
  },
  "notes": {
    "terminationDate": "Referência histórica e auditável (§5(ii)); não é gatilho automático.",
    "enforcement": "Encerramento exige ato formal do Secretário-Geral registado no DocHUB, com condições institucionais satisfeitas."
  }
}
```

**§5(ii) no texto:** mantém redacção com **2026-12-31 (UTC-3)** como data de referência; **sem** encerramento automático ao calendário.

---

## Achados transversais

### Hub actual — I. Constitutional Foundation

| Situação | Detalhe |
|----------|---------|
| **Modelo v1** | 9 instrumentos monólito (`ingest-constitutional-foundation.ts`), `layer: 1`, sem pai. |
| **Fora de ordem** | Ordem correcta no script `FILE_ORDER`; listagens por título/ID invertem V–VII vs Preamble/I. |
| **Alvo v2** | Um documento `idr:c:foundation`; piloto carrega **s0 + s2**; restantes secções registadas como `deferred` no mapa. |
| **Lacunas** | `PREAMBLE.md` PT — validar §6; `INTRODUCTION.md` sem `§` (deferred). |

### Foundational Norm — arquivo externo

| Situação | Detalhe |
|----------|---------|
| **Hub** | Criação nova v2. |
| **Vínculo** | `parentInstrumentId` → `idr:c:foundation`; `§3:cl:1` cita CONSTITUTIONAL FOUNDATION. |
| **§2 PT** | `§2.0` → mesmo nó lógico que `§2` EN (path `§2` recomendado). |
| **Change Log** | Secção **`idr:c:preop-regime:s2`**, `non_normative: true` — citável para auditoria, **não** como fundamento de decisão institucional. |

---

## Tabela 1 — I. Constitutional Foundation

**Documento:** `idr:c:foundation` · layer **0** · `documentType` constitutional

| Nível | Título | idrRef proposto | Observação |
|-------|--------|-----------------|------------|
| Documento | I. Constitutional Foundation | `idr:c:foundation` | Aliases `idr:HUB-INSTR-*` na carga. |
| Secção | Preamble | `idr:c:foundation:s0` | **phase: pilot** · position 0 · `PREAMBLE.md` |
| Artigo | Preamble (English) | `idr:c:foundation:s0:art.en` | |
| Parágrafo | §1 | `idr:c:foundation:s0:art.en:§1` | |
| Cláusula | Corpo | `idr:c:foundation:s0:art.en:§1:cl:1` | |
| Parágrafo | §2 | `idr:c:foundation:s0:art.en:§2` | |
| Cláusula | Corpo | `idr:c:foundation:s0:art.en:§2:cl:1` | |
| Parágrafo | §3 | `idr:c:foundation:s0:art.en:§3` | |
| Cláusula | Corpo | `idr:c:foundation:s0:art.en:§3:cl:1` | |
| Parágrafo | §4 | `idr:c:foundation:s0:art.en:§4` | |
| Cláusula | Corpo | `idr:c:foundation:s0:art.en:§4:cl:1` | |
| Parágrafo | §5 (princípios) | `idr:c:foundation:s0:art.en:§5` | |
| Cláusula | (i) individual primacy | `idr:c:foundation:s0:art.en:§5:cl:1` | |
| Cláusula | (ii) structural equity | `idr:c:foundation:s0:art.en:§5:cl:2` | |
| Cláusula | (iii) subsidiarity | `idr:c:foundation:s0:art.en:§5:cl:3` | |
| Cláusula | (iv) non-conditionality | `idr:c:foundation:s0:art.en:§5:cl:4` | |
| Cláusula | (v) transparency | `idr:c:foundation:s0:art.en:§5:cl:5` | |
| Parágrafo | §6 (funções) | `idr:c:foundation:s0:art.en:§6` | |
| Cláusula | (i)–(v) | `idr:c:foundation:s0:art.en:§6:cl:1` … `cl:5` | |
| Parágrafo | §7 | `idr:c:foundation:s0:art.en:§7` | |
| Cláusula | Corpo | `idr:c:foundation:s0:art.en:§7:cl:1` | |
| Artigo | Preamble (Português) | `idr:c:foundation:s0:art.pt` | |
| Parágrafo | §1–§7 (PT) | `idr:c:foundation:s0:art.pt:§1` … `§7` | Espelho EN; validar §6 PT no fonte |
| Cláusula | (PT) | `…:art.pt:…:cl:N` | Mesma regra de alíneas |
| Secção | Introduction | `idr:c:foundation:s1` | **phase: deferred** · position 1 |
| Artigo | Introduction (EN/PT) | `idr:c:foundation:s1:art.en` / `art.pt` | Workshop posterior; `§1:cl:1` proposto |
| Secção | Article I — Rights in Produced Data | `idr:c:foundation:s2` | **phase: pilot** · position 2 |
| Artigo | Article I (English) | `idr:c:foundation:s2:art.en` | |
| Parágrafo | §1 | `idr:c:foundation:s2:art.en:§1` | |
| Cláusula | Corpo | `idr:c:foundation:s2:art.en:§1:cl:1` | |
| Parágrafo | §2 | `idr:c:foundation:s2:art.en:§2` | |
| Cláusula | (i) accrue | `idr:c:foundation:s2:art.en:§2:cl:1` | |
| Cláusula | (ii) custody | `idr:c:foundation:s2:art.en:§2:cl:2` | |
| Cláusula | (iii) compensation | `idr:c:foundation:s2:art.en:§2:cl:3` | |
| Parágrafo | §3 | `idr:c:foundation:s2:art.en:§3` | |
| Cláusula | (i) deliberate action | `idr:c:foundation:s2:art.en:§3:cl:1` | |
| Cláusula | (ii) passive capture | `idr:c:foundation:s2:art.en:§3:cl:2` | |
| Cláusula | (iii) derived data | `idr:c:foundation:s2:art.en:§3:cl:3` | |
| Parágrafo | §4 | `idr:c:foundation:s2:art.en:§4` | |
| Cláusula | Corpo | `idr:c:foundation:s2:art.en:§4:cl:1` | |
| Parágrafo | §5 | `idr:c:foundation:s2:art.en:§5` | |
| Cláusula | Corpo | `idr:c:foundation:s2:art.en:§5:cl:1` | |
| Parágrafo | §5-A | `idr:c:foundation:s2:art.en:§5-A` | |
| Cláusula | Corpo | `idr:c:foundation:s2:art.en:§5-A:cl:1` | |
| Parágrafo | §6 | `idr:c:foundation:s2:art.en:§6` | |
| Cláusula | Corpo | `idr:c:foundation:s2:art.en:§6:cl:1` | Ref. “Ato Fundador 0” → `idr:c:preop-regime` |
| Parágrafo | §7 | `idr:c:foundation:s2:art.en:§7` | |
| Cláusula | Corpo | `idr:c:foundation:s2:art.en:§7:cl:1` | |
| Artigo | Artigo I (Português) | `idr:c:foundation:s2:art.pt` | §1–§7 + §5-A espelhados (mesma árvore `cl:N`) |
| Secção | Article II — Data Sovereignty | `idr:c:foundation:s3` | **phase: deferred** · position 3 |
| Artigo | Article II (EN/PT) | `idr:c:foundation:s3:art.en` / `art.pt` | Workshop posterior |
| Secção | Article III — Asymmetry | `idr:c:foundation:s4` | **phase: deferred** · position 4 |
| Secção | Article IV — Constitutional Basis | `idr:c:foundation:s5` | **phase: deferred** · position 5 |
| Secção | Article V — Scope | `idr:c:foundation:s6` | **phase: deferred** · position 6 |
| Secção | Article VI — National/Supranational | `idr:c:foundation:s7` | **phase: deferred** · position 7 |
| Secção | Article VII — Non-discrimination | `idr:c:foundation:s8` | **phase: deferred** · position 8 |

---

## Tabela 2 — Foundational Norm — Pre-Operational Stage

**Documento:** `idr:c:preop-regime` · layer **1** · pai `idr:c:foundation` · status `foundational-provisional` · metadados de cabeçalho (secção acima)

| Nível | Título | idrRef proposto | Observação |
|-------|--------|-----------------|------------|
| Documento | Foundational Norm — Pre-Operational Stage | `idr:c:preop-regime` | Metadados `terminationDate`, `conditions`, etc. |
| Secção | Corpo normativo (English) | `idr:c:preop-regime:s0` | **phase: pilot** · position 0 |
| Artigo | English | `idr:c:preop-regime:s0:art.en` | |
| Parágrafo | §1 | `idr:c:preop-regime:s0:art.en:§1` | |
| Cláusula | Corpo | `idr:c:preop-regime:s0:art.en:§1:cl:1` | |
| Parágrafo | §2 — Designations | `idr:c:preop-regime:s0:art.en:§2` | |
| Cláusula | Layer 1 | `idr:c:preop-regime:s0:art.en:§2:cl:1` | |
| Cláusula | Layer 2 | `idr:c:preop-regime:s0:art.en:§2:cl:2` | |
| Cláusula | Layer 3 | `idr:c:preop-regime:s0:art.en:§2:cl:3` | |
| Cláusula | DocHUB | `idr:c:preop-regime:s0:art.en:§2:cl:4` | |
| Parágrafo | §3 | `idr:c:preop-regime:s0:art.en:§3` | |
| Cláusula | (i) CONSTITUTIONAL FOUNDATION | `idr:c:preop-regime:s0:art.en:§3:cl:1` | `dependsOnInstrumentRef`: `idr:c:foundation` |
| Cláusula | (ii) Doc Hub Specs | `idr:c:preop-regime:s0:art.en:§3:cl:2` | |
| Cláusula | (iii) Layer 1 | `idr:c:preop-regime:s0:art.en:§3:cl:3` | |
| Cláusula | (iv) Layer 2 and 3 | `idr:c:preop-regime:s0:art.en:§3:cl:4` | |
| Parágrafo | §3.1 | `idr:c:preop-regime:s0:art.en:§3.1` | cl:1 |
| Parágrafo | §4 | `idr:c:preop-regime:s0:art.en:§4` | cl:1–cl:5 |
| Parágrafo | §4.1 — PRC | `idr:c:preop-regime:s0:art.en:§4.1` | cl:1–cl:6 (workshop subitens) |
| Parágrafo | §5 | `idr:c:preop-regime:s0:art.en:§5` | |
| Cláusula | Introdução | `idr:c:preop-regime:s0:art.en:§5:cl:1` | |
| Cláusula | (i) primeira AG fundacional | `idr:c:preop-regime:s0:art.en:§5:cl:2` | Evento alternativo no texto; não condição Hub |
| Cláusula | (ii) 2026-12-31 | `idr:c:preop-regime:s0:art.en:§5:cl:3` | **Ver desvio documentado §5(ii) abaixo** — idrRef efectivo na carga: `…:cl:2` |
| Parágrafo | §5.1 | `idr:c:preop-regime:s0:art.en:§5.1` | cl:1 |
| Parágrafo | §6 | `idr:c:preop-regime:s0:art.en:§6` | cl:1–cl:3 |
| Parágrafo | §6.1 | `idr:c:preop-regime:s0:art.en:§6.1` | cl:1 |
| Parágrafo | §7 | `idr:c:preop-regime:s0:art.en:§7` | cl:1 |
| Secção | Corpo normativo (Português) | `idr:c:preop-regime:s1` | **phase: pilot** · position 1 |
| Artigo | Português | `idr:c:preop-regime:s1:art.pt` | Espelho EN; `§2` (= §2.0 no fonte) |
| Parágrafo | §1–§7 (+ subparágrafos) | `idr:c:preop-regime:s1:art.pt:§1` … | Mesma árvore que EN |
| Secção | Change Log e ratificação | `idr:c:preop-regime:s2` | **phase: pilot** · position 2 · **`non_normative: true`** |
| Artigo | Change log (EN) | `idr:c:preop-regime:s2:art.en` | DocID, Phase Fase 0, registo publicação |
| Parágrafo | Entrada de change log | `idr:c:preop-regime:s2:art.en:§1` | |
| Cláusula | Corpo | `idr:c:preop-regime:s2:art.en:§1:cl:1` | Não citável como fundamento decisório |
| Artigo | Ratificação / assinatura (EN) | `idr:c:preop-regime:s2:art.en` (bloco SG) | Metadado de acto; sub-§ opcional na carga |
| Artigo | Change log (PT) | `idr:c:preop-regime:s2:art.pt` | Espelho PT do ficheiro |
| Parágrafo | Entrada + ratificação PT | `idr:c:preop-regime:s2:art.pt:§1` … | Idem `non_normative` |

---

## Vínculo Foundation ↔ Preop-regime

| Mecanismo | Valor |
|-----------|--------|
| `parentInstrumentId` | `idr:c:preop-regime` → `idr:c:foundation` |
| Texto | `idr:c:preop-regime:s0:art.en:§3:cl:1` (e PT) |

---

## Desvios documentados (pós-verificação piloto — PO 2026-05-18)

### §5(ii) — numeração de cláusula EN (`idr:c:preop-regime:s0:art.en:§5`)

| Aspecto | Mapa editorial (tabela acima) | Implementação (parser + carga lab) |
|---------|------------------------------|-------------------------------------|
| Alínea (ii) data 2026-12-31 | `…:§5:cl:3` | `idr:c:preop-regime:s0:art.en:§5:cl:2` |
| Texto no corpus | Correcto (data e redacção §5(ii)) | Correcto |
| Causa | Numeração editorial `cl:3` assumida no workshop | Parser numera alíneas `(i)`, `(ii)` **por ordem** no parágrafo: (i)→`cl:1`, (ii)→`cl:2` |

**Decisão PO:** desvio **aceite e documentado** — **não requer correcção** antes do merge do PR. O **idrRef efectivo na base** (`cl:2`) é a referência citável; actualizar referências cruzadas no mapa quando conveniente.

**Espelho PT:** verificar `idr:c:preop-regime:s1:art.pt:§5:cl:*` com a mesma regra de ordenação.

---

## Critérios de aceite do mapa (piloto)

1. **Foundation:** árvore completa **s0 + s2** (cláusulas desdobradas); s1, s3–s8 marcados `deferred` sem carga de texto na Fase 1.  
2. **Preop-regime:** documento completo s0–s2; metadados de cabeçalho conforme JSON acima; `s2` com `non_normative: true`.  
3. Ordem de secções Foundation: s0 → s2 no piloto (s1 e s3–s8 reservados em position).  
4. §5(ii) preservado no texto; enforcement = data referência + acto SG + condições; idrRef efectivo `cl:2` conforme desvio documentado.  
5. Mapa assinado → entrada em ADR 0015 / schema v2.

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-05-18 | Versão inicial e adendo par constitucional. |
| 2026-05-18 | **Fechamento PO:** `idr:c:preop-regime`; sunset revisada; Change Log `s2` não-normativo; piloto Foundation = s0+s2 apenas. |
| 2026-05-18 | **Desvio §5(ii) documentado** — mapa mantém `cl:3` editorial; carga usa `cl:2`; PO aceita sem bloquear merge. |
