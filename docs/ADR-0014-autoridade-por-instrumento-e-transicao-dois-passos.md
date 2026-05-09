# ADR 0014 — Autoridade por instrumento e transição de estado em dois passos

- **Status:** Proposto
- **Data:** 2026-05-09
- **Decisores:** Pilot + AI Dev Machine
- **Relaciona-se com:** ADR 0012, ADR 0013, Regime Fundacional de Transição (§4.1.iii e §4.1.iv)

## Contexto

O MVP operacional usa controlo de acesso por papel (`HubRole` + `can*`), com permissões codificadas no sistema.
Esse modelo resolve o curto prazo, mas não corresponde ao modelo normativo-alvo do Regime Fundacional:

1. A autoridade deve emanar de instrumentos registados e rastreáveis.
2. Transições relevantes exigem acto composto de dois actores (PRC + aprovação formal SG), e não uma única acção booleana por utilizador.
3. A composição do PRC deve derivar de acto de nomeação registado no Hub, com origem e validade.

Se o MVP fechar agora interfaces rígidas centradas em papel fixo, a evolução para autoridade institucional baseada em instrumentos ficará cara e propensa a regressões.

## Decisão

Adoptar uma arquitectura de transição em duas camadas, mantendo operação MVP sem bloquear a evolução normativa:

1. **Camada de capacidade técnica (curto prazo):** `HubRole`/`can*` permanece como gate operacional.
2. **Camada de autoridade normativa (extensível):** introduzir resolução de autoridade por contrato, com implementação inicial delegando no modelo actual e evolução posterior para fonte institucional por instrumento.
3. **Fluxo de transição preparado para dois passos:** separar explicitamente:
   - acto PRC (proposta/registo de deliberação de transição);
   - acto SG (aprovação formal positiva da transição).
4. **Ledger/auditoria:** cada passo é evento próprio, com autoria, timestamp, fundamento e referência causal ao passo anterior.

## Decisões de desenho

### 1) Contrato de resolução de autoridade

Criar ponto único de decisão para mutações normativas (transições, aprovação formal, actos de processo), por exemplo:

- `resolveAuthorityForAction(context): AuthorityDecision`

Onde `context` inclui, no mínimo:

- actor da sessão;
- instrumento alvo;
- tipo de acto normativo;
- data/hora de avaliação.

E `AuthorityDecision` inclui:

- `allowed: boolean`;
- `reasonCode` estável;
- `authoritySource` (`role_based`, `instrument_based`, `hybrid`);
- referências normativas usadas na decisão (quando houver).

### 2) Estado e actos de dois passos

Para transições com requisito institucional composto:

- primeiro passo: registo PRC (deliberação/proposta de transição);
- segundo passo: aprovação SG (acto confirmatório).

No MVP, pode continuar a existir fluxo simplificado para estados não sujeitos ao requisito composto, mas a arquitectura não deve assumir “um actor, um POST, transição concluída” como regra universal.

### 3) Fonte de composição PRC

Manter o caminho para que a composição do PRC seja lida de instrumentos válidos de nomeação (com validade temporal), ainda que o fallback administrativo exista durante o MVP.

## Consequências

### Positivas

- Evita lock-in em RBAC puro.
- Permite migração incremental para autoridade institucional sem reescrever todas as rotas.
- Melhora auditabilidade material: cada acto composto fica explicitamente registado.

### Custos / trade-offs

- Mais complexidade de domínio (camada adicional de decisão).
- Necessidade de modelar referências normativas no fluxo de autorização.
- Incremento de trabalho de testes (matriz por fonte de autoridade e por passo de transição).

## Plano de adopção incremental

1. Introduzir o contrato `resolveAuthorityForAction` com adapter inicial para `can*`.
2. Migrar gradualmente endpoints de transição/actos do comité para usar o contrato (sem quebrar comportamento actual).
3. Introduzir modelo de acto PRC/SG em dois passos nos fluxos obrigatórios do Regime.
4. Evoluir resolução de autoridade para ler nomeações e validade a partir de instrumentos registados.

## Critérios de aceite (arquitecturais)

- O código deixa de depender exclusivamente de checks directos `can*` para decisões normativas críticas.
- Existe um ponto único de decisão de autoridade, com resultado explicável.
- O fluxo de transição relevante aceita evolução para dois passos sem refactor estrutural das APIs.
- Ledger consegue representar os dois actos com encadeamento causal e autoria distinta.

## Fora de escopo deste ADR

- Implementar imediatamente a resolução completa por instrumentos.
- Remover `HubRole` no MVP.
- Definir regras finais de quórum permanente (além do MVP actual).

