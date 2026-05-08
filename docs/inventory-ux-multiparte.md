# Inventário — UX multiparte (UX-MP-0)

**Escopo:** refinar a experiência de edição multiparte em `app/instruments/[id]/edit/page.tsx`, mantendo contratos REST, regras de ledger, modelo Prisma e agregação no servidor.

**Referências lidas:**
- `CLAUDE.md`
- `docs/methodology/pilot-machine-methodology.md`
- `Docs/adr/0008-hub-preop-multipart-editorial-mvp.md`
- `parallel-project-kit/STATUS.md`
- `hub-preop/app/instruments/[id]/edit/page.tsx`
- `hub-preop/lib/part-composition.ts`

---

## Ficheiros que serão tocados

- `hub-preop/app/instruments/[id]/edit/page.tsx`
  - Trocar strings visíveis para pt-BR.
  - Melhorar orientação do editor multiparte.
  - Adicionar navegação por segmentos quando houver duas ou mais partes.
  - Adicionar pré-visualização agregada em tempo real.
  - Reforçar acessibilidade básica dos segmentos e da região principal.
- `parallel-project-kit/docs/handoffs.md`
  - Acrescentar o handoff obrigatório da fase UX-MP após a implementação e validação.
- Possível, somente se reduzir complexidade sem inflar o diff: `hub-preop/app/instruments/[id]/edit/_components/*.tsx`
  - Extração local de componentes visuais da página de edição.

Não está previsto tocar em APIs, Prisma, `instrument-service` ou regras de domínio. A regra de junção do agregado pode ser duplicada no cliente com comentário explícito de paridade com ADR 0008 e `assembleInstrumentMarkdown`; se o Pilot preferir, a alternativa reversível é extrair uma função pura de join para um módulo sem dependência de Prisma e delegar a partir de `part-composition.ts`.

---

## Comportamento a preservar

- Detecção de editor multiparte via `isMultipartEditorActive(detail)`.
- Perfil multiparte continua enviando `POST /api/instruments/[id]/versions/multipart`.
- Payload multiparte preserva `bodiesByPartId` alinhado aos `partId` dos segmentos e `revisionNote` opcional.
- Perfil monólito continua usando textarea único e `POST /api/instruments/[id]/content`.
- RBAC permanece baseado em `canAppendContent(session?.user?.roles)`.
- Todos os fetches continuam com `credentials: "include"`.
- Nenhuma alteração em rotas, payloads, respostas, ledger, schema Prisma, hash ou agregação do servidor.
- Ordem de composição multiparte permanece a ordem entregue por `multipartSegments`, que já expressa `CompositionEntry.position`.

---

## Novo comportamento a introduzir

- UI inteira da página em pt-BR para textos visíveis, mantendo códigos técnicos quando úteis (`idrRef`, `partKind`, rotas).
- Pré-visualização agregada multiparte mostrando a concatenação dos segmentos na ordem de composição.
- Regra da pré-visualização agregada: exatamente `"\n\n"` entre segmentos, em paridade com ADR 0008 e `assembleInstrumentMarkdown`.
- Navegação por segmentos em instrumentos com duas ou mais partes, usando âncoras ou botões que levam ao segmento correspondente.
- Cada segmento multiparte com nome acessível único (`aria-labelledby` ou `aria-label`).
- Região principal identificável e estados explícitos de erro, sucesso, carregamento e submissão.
- Botão de submissão com `disabled` coerente e texto pt-BR que comunique o estado sem depender de cor.

---

## Riscos

- Divergência futura entre a junção duplicada no cliente e `assembleInstrumentMarkdown` se a regra de agregação mudar no servidor.
- A página atual importa `canAppendContent` de `@/lib/rbac`; qualquer extração indevida de `assembleInstrumentMarkdown` direto de `part-composition.ts` poderia puxar dependências de Prisma para o bundle do cliente.
- Tradução de mensagens técnicas pode esconder detalhes úteis para registrar/admin; manter rotas e códigos em contexto quando ajudarem a suporte.
- Navegação por âncora precisa gerar ids estáveis por segmento sem depender de dados mutáveis do markdown.
- Aviso opcional de alterações não salvas pode interferir em navegação do Next se implementado com excesso de alcance; se incluído, deve ficar simples e reversível.

---

## Critérios de aceite de produto

- Um registrar/admin entende rapidamente se está editando instrumento monólito ou multiparte.
- Em instrumentos multiparte, cada segmento aparece identificado por tipo e posição, com navegação clara entre segmentos.
- O utilizador consegue ver, antes de enviar, o texto agregado que será formado pela ordem dos segmentos.
- A página comunica carregamento, falta de autenticação, falta de permissão, erro, sucesso e envio em pt-BR.
- O envio continua usando os fluxos existentes, sem alterar contratos de API nem regras do ledger.
- Leitores por tecnologia assistiva têm rótulos únicos para os campos multiparte e uma região principal identificável.

---

## Gate UX-MP-1

- [x] Inventário UX-MP-0 aprovado pelo Pilot antes de alterações de código.
- [x] Decisão registrada sobre a regra de join no cliente:
  - duplicar localmente com comentário de paridade (aprovado pelo Pilot em 2026-05-07); ou
  - extrair função pura sem dependência de Prisma e delegar em `part-composition.ts`.
