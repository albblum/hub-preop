# Prompt — Implementador — Fase UX multiparte (hub-preop)

Você é o Implementador, seguindo a metodologia Pilot + AI Dev Machine.

## Objetivo

**Refinar a experiência de edição multiparte** na interface do Hub pré-operacional, **sem** alterar contratos das APIs REST, regras de ledger, modelo Prisma ou lógica de agregação no servidor. O utilizador final (registrar/admin) deve conseguir **editar vários segmentos com mais clareza, orientação e segurança percebida**, mantendo o envio existente para `POST /api/instruments/[id]/versions/multipart`.

Esta fase corresponde ao **item 1** de `parallel-project-kit/STATUS.md` («UX multiparte») e formaliza o que o ADR 0008 listou como **«UI por Part (entrega separada)»**, sabendo que uma primeira versão já existe em `app/instruments/[id]/edit/page.tsx` (ver desvio documentado em `hub-preop/docs/inventory-multipart-mvp.md`).

---

## Leitura obrigatória (ordem)

1. `CLAUDE.md` (workspace)
2. `Docs/Methodology/pilot-machine-methodology.md` (ou `docs/methodology/pilot-machine-methodology.md`)
3. `Docs/adr/0008-hub-preop-multipart-editorial-mvp.md` (agregado com `\n\n`; perfis monólito vs multiparte)
4. `parallel-project-kit/STATUS.md` (item «UX multiparte»)
5. `hub-preop/app/instruments/[id]/edit/page.tsx` (implementação actual)
6. `hub-preop/lib/part-composition.ts` — apenas para **paridade** do join `assembleInstrumentMarkdown` (dois `\n\n` entre segmentos); **não** importar este módulo no cliente se isso puxar Prisma para o bundle — ver restrições abaixo.

Conflito de governança ou pedido de alteração de API/domínio: **parar** e pedir decisão ao Pilot.

---

## Restrições

- **Não** mudar rotas, payloads ou respostas das APIs sob `/api/instruments/...`.
- **Não** alterar `schema.prisma`, `instrument-service`, `part-composition` **salvo** um refactor **mínimo** e reversível: extrair apenas uma função **pura** de junção de markdown para um ficheiro sem dependência de Prisma (ex. `lib/assemble-markdown-aggregate.ts`), com `part-composition.ts` a reexportar ou delegar **uma linha**, para evitar duplicar a regra `\n\n` na UI. Se o Pilot preferir zero refactor de `lib/`, duplicar o join na UI com **comentário explícito** de paridade com ADR 0008 e com `assembleInstrumentMarkdown`.
- **Não** adicionar dependências npm novas sem aprovação explícita do Pilot (sem Playwright, sem React Testing Library nesta fase, salvo autorização).
- **Copy da UI em português (Brasil)** para todas as strings visíveis nesta página (títulos, ajuda, botões, mensagens de erro/sucesso, estados de carregamento). Manter códigos técnicos (`idrRef`, `partKind`, nomes de rotas) onde forem úteis, com rótulos legíveis em pt-BR.

---

## Fase UX-MP-0 — Inventário (read-only, breve)

Criar **`hub-preop/docs/inventory-ux-multiparte.md`** com:

- Ficheiros que serão tocados (esperado: sobretudo `edit/page.tsx`; possivelmente componentes extraídos para `app/instruments/[id]/edit/_components/*.tsx` se reduzir complexidade).
- Comportamento a preservar: detecção `isMultipartEditorActive`, POST multipart vs monólito, RBAC, `credentials: "include"`.
- Riscos (ex.: divergência de join agregado se duplicado no cliente).
- Critérios de aceite em linguagem de produto (lista curta).

**Gate:** aprovação Pilot do inventário antes de código (metodologia «inventário antes de implementar»). Se o Pilot autorizar sessão única inventário+implementação, registar essa autorização no handoff.

---

## Fase UX-MP-1 — Implementação

### Entregáveis mínimos (todos obrigatórios)

1. **Idioma pt-BR** em toda a superfície desta página (incl. mensagens já em inglês como «Loading…», «Sign in», textos de ajuda).
2. **Pré-visualização agregada** no perfil multiparte: bloco legível (ex.: secção colapsável ou painel inferior) que mostra o **texto resultante** da concatenação dos segmentos **na ordem de composição**, usando **exactamente** a mesma regra que o servidor (ADR 0008: `\n\n` entre segmentos). Actualizar em tempo real à medida que os `textarea` mudam.
3. **Navegação entre segmentos** em instrumentos com **≥2** partes: índice ou lista de âncoras (por `partKind` + posição) que faz **scroll** até ao segmento correspondente (comportamento nativo `id` + link ou botão).
4. **Acessibilidade básica:** cada segmento multiparte com `aria-labelledby` ou `aria-label` único; região principal identificável; botão de submissão com estado `disabled` coerente e texto que não dependa só da cor para erro (manter mensagens explícitas).

### Entregáveis opcionais (só se couber no mesmo passo sem inflar o diff)

- Aviso **antes de sair** da página com alterações não guardadas (`beforeunload` e/ou interceptação de navegação Next — sem bibliotecas novas).
- Contagem de caracteres por segmento ou indicação clara de segmento vazio **antes** de submeter.

### Fora de escopo

- Rich-text / WYSIWYG, drag-and-drop de ordem de partes, criação de novas partes pela UI (continua a ser API/fluxo futuro).
- Alteração da fachada DocHUB ou de publicação.

---

## Validação

- `npm run lint`
- `npm run test:no-db`
- `npm run build`
- `npm run verify:reliability` (garantir que a fase UX não regrediu o gate de confiabilidade)

Smoke manual **não** é critério obrigatório desta fase; o Pilot pode validar visualmente quando quiser.

---

## Checkpoint de commit (sugerido)

`feat(hub-preop): Phase UX-MP — multipart edit page (pt-BR, aggregate preview, a11y)`

(um commit por step se a metodologia estrita for exigida: primeiro inventário em `docs`, depois UI.)

---

## Handoff (obrigatório)

Acrescentar entrada em **`parallel-project-kit/docs/handoffs.md`** com:

- Data e âmbito UX-MP.
- Lista de ficheiros alterados.
- Se foi usada extração da função pura de join ou apenas comentário de paridade na UI.
- Limitações (sem E2E browser automatizado nesta fase, salvo decisão contrária).
- **Próximo foco:** item 2 ou 3 do `STATUS.md` (transição monólito → multiparte; fachada DocHUB escrita multiparte) — sem pedir decisão ao Pilot no corpo do handoff.

---

## Referência rápida — comportamento actual (não regredir)

- Multiparte activo: `isMultipartEditorActive(detail)`; corpo `bodiesByPartId` alinhado a **todos** os `partId` dos segmentos.
- Monólito: textarea único + `POST .../content`.
