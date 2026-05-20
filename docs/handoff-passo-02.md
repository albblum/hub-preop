## Handoff — Passo 2 (Fase 2)

- **Branch:** continuar em `feat/hub-preop-schema-v2-phase1` ou abrir `feat/hub-preop-domain-v2` (Pilot).
- **Módulos criados:** `lib/normative/idr-ref-grammar.ts`, `idr-ref-registry.ts`, `resolve-idr-ref.ts`, `clause-version.ts`, `immutability.ts`, `types.ts`, `test-helpers.ts`, `index.ts`, e `*.test.ts` em paralelo.
- **Cobertura testes (descrita):**
  - **Gramática:** exemplos ADR (documento, hierarquia completa, anexo, `art.I` / alínea `cl:a`), salto `…:cl:1` rejeitado, anexo + hierarquia em `composeIdrRef` rejeitado, caracteres inválidos no código do documento.
  - **Registry (BD):** colisão na mesma TX com rollback; `assertIdrRefAvailable`; registo ligado a `clauseId` de fixture mínima v2.
  - **Resolução (BD):** `resolveIdrRef` semântico directo; legado `idr:HUB-INSTR-*` via `IdrRefAlias` → registo; desconhecido → `null`.
  - **ClauseVersion (BD):** três `appendClauseVersion` com `previousContentHash` encadeado e uma única `isCurrent`; `currentVersionId` actualizado.
  - **Imutabilidade (BD):** `assertClauseNotPublished` após `publishedAt` sem bloquear `appendClauseVersion`; `assertClauseVersionNotReferenced` / `assertClauseVersionDirectBodyUpdateForbidden` com `InstrumentRevisionClauseVersion`; secção publicada bloqueia `assertSectionStructureMutable`.
- **npm test:** 149/149 verdes (com `DATABASE_URL` válido); com `SKIP_DB=1` os suites `describeIfDb` ficam skipped (127 pass + 22 skip conforme ambiente).
- **prisma validate:** OK.
- **TODOs assumidos (com referência ADR):**
  - `assertClauseVersionNotReferenced`: falta verificação de **`LedgerEntry.payloadHash`** dependente da versão — **Fase 4** (ADR 0015 §2.2; texto em `immutability.ts`).
  - `resolveIdrRef` opção `includeAllAliasTargets`: reservada — schema actual impõe **uma** linha `IdrRefAlias` por `legacyRef` (PK); 1:N real exigiria evolução de schema ou tabela auxiliar.
  - Rótulos de hierarquia: códigos de **documento** e **anexo** restringidos a `[a-z0-9.-]`; secção / artigo / parágrafo / cláusula usam `[a-zA-Z0-9.-]` para cumprir romanos em `art.I` (ADR 0014 §1.3), alinhado ao prompt de exemplos canónicos.
- **Próximo passo recomendado:** Fase 3 (scripts de carga piloto) — aguardar OK Pilot.
- **Riscos / dúvidas ao Pilot:** se quiserem gramática **estritamente** minúscula em todos os segmentos (prompt § alfabeto), os exemplos ADR com `art.I` deixam de ser válidos — confirmar qual documento prevalece.

### Contrato público (`lib/normative/index.ts`)

| Módulo | Funções / tipos principais |
|--------|----------------------------|
| `idr-ref-grammar` | `IdrRefSegments`, `composeIdrRef`, `parseIdrRef`, `validateIdrRef`, `IdrRefGrammarError` |
| `idr-ref-registry` | `registerIdrRef`, `assertIdrRefAvailable`, `lookupOwner`, `IdrRefCollisionError`, `RegisterIdrRefInput` |
| `resolve-idr-ref` | `resolveIdrRef`, `registerAlias`, `listAliasesByCanonical`, `isLegacyHubInstrRef`, `ResolvedRef` |
| `clause-version` | `appendClauseVersion`, `getCurrentClauseVersion`, `AppendClauseVersionInput` |
| `immutability` | `assertClauseNotPublished`, `assertClauseVersionNotReferenced`, `assertSectionStructureMutable`, `assertClauseVersionDirectBodyUpdateForbidden`, `ClauseImmutableError` |
| `types` | `NormativeTx` (`Prisma.TransactionClient`) |
| `test-helpers` | `describeIfDb`, `createMinimalV2ClauseFixture`, `deleteInstrumentCascade` / `withCleanV2Tables` |
