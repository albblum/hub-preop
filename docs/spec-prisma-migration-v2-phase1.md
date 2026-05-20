# Especificação de migração Prisma — schema v2 (Fase 1 constitucional)

| Campo | Valor |
|-------|--------|
| **Status** | Schema merged; migração SQL gerada — **deploy pendente** (ver `handoff-passo-01.md`) |
| **Data** | 2026-05-18 |
| **ADRs** | [ADR 0014](../../Docs/adr/0014-dochub-phase1-constitutional-structural-model.md) (Accepted), [ADR 0015](../../Docs/adr/0015-dochub-schema-v2-normative-tree.md) (Accepted) |
| **Mapa de migração** | [migration-map-phase1-constitutional-pair.md](./migration-map-phase1-constitutional-pair.md) |
| **Schema Prisma completo** | [`prisma/schema.v2-proposed.prisma`](../prisma/schema.v2-proposed.prisma) |
| **Schema em produção** | [`prisma/schema.prisma`](../prisma/schema.prisma) — **inalterado** até autorização |

**Proibições nesta fase:** não executar `prisma migrate`; não alterar código da aplicação Hub; não substituir `schema.prisma` sem aprovação explícita do Pilot.

---

## Resumo executivo

A migração adiciona a **árvore normativa relacional** (Section → Article → Paragraph → Clause → ClauseVersion), o **registo global de idrRef**, **aliases legados** e **revisões agregadas do documento**, estendendo `Instrument` com perfil estrutural v1/v2 e metadados de encerramento da Norma pré-operacional. Tabelas v1 (`Part`, `PartVersion`, `CompositionEntry`) permanecem para instrumentos legados.

---

## a) Novas tabelas

### `NormativeSection`

| Campo | Tipo Prisma | Obrigatório | Notas |
|-------|-------------|-------------|--------|
| `id` | `String` @id @default(cuid()) | sim | PK |
| `instrumentId` | `String` FK → `Instrument` | sim | Documento dono |
| `position` | `Int` | sim | Ordem editorial; **nunca** inferir por `createdAt` |
| `code` | `String` | sim | Ex. `s0`, `s1`, `s2` |
| `title` | `String?` | não | Rótulo humano |
| `nonNormative` | `Boolean` @default(false) | sim | `true` = auditável, não citável (Change Log) |
| `migrationPhase` | `NormativeMigrationPhase?` | não | `pilot` \| `deferred` \| `complete` |
| `publishedAt` | `DateTime?` | não | Imutabilidade estrutural da secção |
| `supersededBySectionId` | `String?` FK self | não | Sucessor estrutural |

**Relações:** `Instrument` 1:N `NormativeSection` 1:N `NormativeArticle`.

**Índices / constraints:**

- `@@unique([instrumentId, position])`
- `@@unique([instrumentId, code])`
- `@@index([instrumentId])`

---

### `NormativeArticle`

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|--------|
| `id` | cuid PK | sim | |
| `sectionId` | FK → `NormativeSection` | sim | |
| `position` | `Int` | sim | Ordem na secção |
| `articleCode` | `String` | sim | Ex. `en`, `pt` → segmento `art.en` |
| `title` | `String?` | não | |

**Constraints:** `@@unique([sectionId, position])`, `@@unique([sectionId, articleCode])`.

---

### `NormativeParagraph`

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|--------|
| `id` | cuid PK | sim | |
| `articleId` | FK → `NormativeArticle` | sim | |
| `position` | `Int` | sim | |
| `paragraphCode` | `String` | sim | Ex. `1`, `5-A`, `3.1` |

**Constraints:** `@@unique([articleId, position])`, `@@unique([articleId, paragraphCode])`.

---

### `NormativeClause`

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|--------|
| `id` | cuid PK | sim | |
| `paragraphId` | FK → `NormativeParagraph` | sim | |
| `position` | `Int` | sim | Ordem (i, ii, …) |
| `clauseCode` | `String` | sim | Segmento `cl` no path |
| **`idrRef`** | `String` @unique | sim | Endereço canónico completo |
| `publishedAt` | `DateTime?` | não | Congela identidade estrutural |
| `supersededByClauseId` | FK self | não | Substituição sem renumeração |
| `currentVersionId` | FK → `ClauseVersion` @unique | não | Versão vigente |

**Constraints:** `@@unique([paragraphId, position])`, `@@unique([paragraphId, clauseCode])`, `idrRef` globalmente único.

---

### `ClauseVersion`

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|--------|
| `id` | cuid PK | sim | |
| `clauseId` | FK → `NormativeClause` | sim | |
| `version` | `Int` | sim | 1, 2, 3… por cláusula |
| `body` | `String` @db.Text | sim | **Texto canónico** |
| `contentHash` | `String` | sim | SHA-256 hex (mesma filosofia que `InstrumentVersion`) |
| `previousContentHash` | `String?` | não | Encadeamento |
| `revisionNote` | `String?` | não | |
| `isCurrent` | `Boolean` @default(false) | sim | Versão vigente para leitura/agregado |
| `createdAt` | `DateTime` | sim | |
| `createdBy` | `String?` | não | Actor label / user id |

**Constraints:** `@@unique([clauseId, version])`.

**Regra de negócio (aplicação + SQL opcional):** `UPDATE` em `body` proibido quando versão referenciada em publicação ou ledger; correcção = nova linha.

---

### `IdrRefRegistry`

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|--------|
| `idrRef` | `String` @id | sim | PK = endereço completo |
| `ownerKind` | `IdrRefOwnerKind` | sim | `instrument` \| `section` \| `article` \| `paragraph` \| `clause` |
| `ownerId` | `String` | sim | ID interno do nó |
| `grammarVersion` | `String` @default("1") | sim | Evolução futura da gramática |
| `registeredAt` | `DateTime` | sim | |

**Índice:** `@@index([ownerKind, ownerId])`.

**Escrita:** inserir registo na **mesma transacção** que cria o nó; rejeitar colisão de `idrRef`.

---

### `IdrRefAlias`

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|--------|
| `legacyRef` | `String` @id | sim | Ex. `idr:HUB-INSTR-00009001` |
| `canonicalRef` | `String` | sim | Ref semântico |
| `ownerKind` | `IdrRefOwnerKind?` | não | Quando alias 1:N |
| `ownerId` | `String?` | não | |
| `note` | `String?` | não | |
| `createdAt` | `DateTime` | sim | |

**Índice:** `@@index([canonicalRef])`.

---

### `InstrumentRevision` + junção

**`InstrumentRevision`**

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| `id` | cuid PK | sim |
| `instrumentId` | FK → `Instrument` | sim |
| `revisionNumber` | `Int` | sim |
| `aggregateContentHash` | `String` | sim |
| `createdAt` | `DateTime` | sim |

**Constraint:** `@@unique([instrumentId, revisionNumber])`.

**`InstrumentRevisionClauseVersion`** (junção N:M)

| Campo | Tipo |
|-------|------|
| `instrumentRevisionId` | FK |
| `clauseVersionId` | FK |

**PK composta:** `@@id([instrumentRevisionId, clauseVersionId])`.

---

## b) Extensão das tabelas existentes

### `Instrument` — campos novos

| Campo | Tipo | Default | Função |
|-------|------|---------|--------|
| `structuralProfile` | `StructuralProfile` | `v1` | `v1` = monólito; `v2` = árvore |
| `isAnnex` | `Boolean` | `false` | Anexo citável filho |
| `semanticDocumentCode` | `String?` | — | `foundation`, `preop-regime`, … |
| `terminationDate` | `DateTime?` @db.Date | — | Referência histórica (ex. 2026-12-31) |
| `terminationRequiresExplicitAct` | `Boolean` | `false` | |
| `terminationAuthorizedBy` | `TerminationAuthorizedBy?` | — | `secretary_general` |
| `terminationConditions` | `String[]` | `[]` | Lista de condições PO |

**Relação nova:** `normativeSections`, `instrumentRevisions`.

**O que não muda:** `idrRef` (campo existente — v2 passa a valor semântico), `layer`, `status`, `documentType`, `committeeId`, derivação `parentInstrumentId`, ledger, transições, comités.

### `InstrumentVersion` — extensão mínima

| Campo novo | Tipo | Default |
|------------|------|---------|
| `contentSourceKind` | `InstrumentVersionContentSource` | `legacy_primary` |

| Perfil | `content` | `contentSourceKind` |
|--------|-----------|---------------------|
| v1 | Fonte primária (edição directa) | `legacy_primary` |
| v2 | Agregado derivado (job) | `derived` |

**O que não muda:** `version`, `contentHash`, `previousContentHash`, `supersedesVersion`, `revisionNote`, relação com `LedgerEntry` e `PartVersion`.

### `Part`, `PartVersion`, `CompositionEntry`

**Sem alteração de schema.** Uso restrito a `structuralProfile = v1`. Instrumentos v2 não criam novas linhas nestas tabelas.

---

## c) Enums e constantes

### `StructuralProfile`

```prisma
enum StructuralProfile {
  v1  // monólito / Part store (comportamento actual)
  v2  // árvore normativa + ClauseVersion
}
```

| Valor | Regra |
|-------|--------|
| `v1` | Default em migração; todos os registos existentes |
| `v2` | Após carga validada do piloto; proibido misturar v1 e v2 no mesmo `Instrument` |

### `NormativeMigrationPhase`

```prisma
enum NormativeMigrationPhase {
  pilot     // conteúdo no piloto Fase 1 (ex. Foundation s0+s2)
  deferred  // mapeado mas não carregado (ex. Foundation s1, s3–s8)
  complete  // secção totalmente migrada
}
```

Alinhado ao [mapa de migração](./migration-map-phase1-constitutional-pair.md).

### `nonNormative` (campo booleano, não enum)

| Valor | Regra |
|-------|--------|
| `false` | Secção citável como fundamento normativo |
| `true` | Auditável; **não** citável (ex. `idr:c:preop-regime:s2` Change Log) |

### `publishedAt` — regras

| Nível | Efeito após preenchimento |
|-------|---------------------------|
| `NormativeSection.publishedAt` | Bloqueia reordenação de secções; mudanças estruturais → novo nó + `supersededBySectionId` |
| `NormativeClause.publishedAt` | Congela `idrRef`, `position`, `clauseCode` e códigos ancestrais na path |

**Imutabilidade de texto:** após `publishedAt` ou referência no ledger, `ClauseVersion.body` não pode ser alterado (apenas INSERT de nova versão).

### Outros enums v2

| Enum | Valores |
|------|---------|
| `IdrRefOwnerKind` | `instrument`, `section`, `article`, `paragraph`, `clause` |
| `InstrumentVersionContentSource` | `legacy_primary`, `derived` |
| `TerminationAuthorizedBy` | `secretary_general` |

### Constantes de encerramento (Norma `idr:c:preop-regime`)

Valores esperados na carga piloto (colunas `Instrument`):

| Campo | Valor PO |
|-------|----------|
| `terminationDate` | `2026-12-31` |
| `terminationRequiresExplicitAct` | `true` |
| `terminationAuthorizedBy` | `secretary_general` |
| `terminationConditions` | `committees_constituted`, `committee_members_active`, `formal_act_by_secretary_general` |

**Sem** `first_svs_approved`. A data no texto não dispara encerramento automático.

---

## d) Regras de integridade no schema

### 1. Unicidade de `idrRef`

| Mecanismo | Onde |
|-----------|------|
| `@unique` em `Instrument.idrRef` | Documento (existente) |
| `@unique` em `NormativeClause.idrRef` | Cláusula (endereço citável completo) |
| `IdrRefRegistry.idrRef` @id | Registo global — toda atribuição semântica activa |

**Fluxo de escrita:** validar gramática (ADR 0014) → verificar ausência em `IdrRefRegistry` → INSERT nó + registo na mesma transacção.

### 2. Imutabilidade após `publishedAt`

| Camada | Mecanismo |
|--------|-----------|
| **Prisma / DB** | Unicidade de códigos e `idrRef`; sem triggers no MVP |
| **Aplicação** | Rejeitar `UPDATE` em `body`, `position`, códigos e `idrRef` quando `publishedAt` preenchido ou versão no ledger |
| **Migração SQL (recomendado pós-aprovação)** | Triggers ou políticas RLS opcionais documentadas no passo `prisma migrate` |

### 3. Relação Annex → pai obrigatória

| Regra | Implementação |
|-------|----------------|
| `isAnnex = true` ⇒ `parentInstrumentId` NOT NULL | **CHECK constraint** na migração SQL: `(NOT "isAnnex") OR ("parentInstrumentId" IS NOT NULL)` |
| Anexo não é `DocumentType` autónomo | `isAnnex` + derivação existente |
| Um instrumento, um perfil | `structuralProfile` único por linha; validação na criação |

### 4. Outras regras

| Regra | Constraint / nota |
|-------|-------------------|
| Uma versão corrente por cláusula | `NormativeClause.currentVersionId` @unique; serviço garante um `ClauseVersion.isCurrent = true` |
| Cadeia de versão por cláusula | `@@unique([clauseId, version])` |
| v2 não usa `IdrSequence` para novos docs | Regra de aplicação; `IdrSequence` mantido para histórico v1 |
| Novos v2: proibido `idr:HUB-INSTR-*` | Regra de aplicação; aliases em `IdrRefAlias` |

---

## Plano de migração SQL (quando autorizado)

Ordem sugerida para `prisma migrate dev` (nome ilustrativo: `20260518_schema_v2_normative_tree`):

1. Criar enums v2.
2. `ALTER TABLE "Instrument"` — colunas novas com defaults (`structuralProfile` = `v1`).
3. `ALTER TABLE "InstrumentVersion"` — `contentSourceKind` default `legacy_primary`.
4. Criar tabelas normativas + `IdrRefRegistry` + `IdrRefAlias` + `InstrumentRevision` + junção.
5. Adicionar FKs e índices.
6. `CHECK` annex → pai.
7. (Opcional) triggers de imutabilidade — fase 2 se PO preferir só regras de aplicação no piloto.

**Dados existentes:** nenhuma linha alterada para v2 até script de carga piloto aprovado.

---

## Critérios de aceite (revisão PO)

- [ ] Schema em [`schema.v2-proposed.prisma`](../prisma/schema.v2-proposed.prisma) reflecte ADR 0014 + 0015 + mapa Fase 1.
- [ ] Piloto Foundation: secções `s0`+`s2` `pilot`; restantes `deferred`.
- [ ] Piloto Norma: documento completo; `s2` com `nonNormative = true`.
- [ ] Metadados de encerramento da Norma conforme tabela §c.
- [ ] PO autoriza explicitamente substituição de `schema.prisma` + `prisma migrate`.

---

## Próximo passo (após autorização)

1. Copiar conteúdo aprovado de `schema.v2-proposed.prisma` → `schema.prisma`.
2. `npx prisma migrate dev --name schema_v2_normative_tree` (em `hub-preop/`).
3. Scripts de carga conforme mapa; validação de hashes e `IdrRefRegistry`.
4. Atualizar serviços Hub (fora do âmbito desta entrega).
