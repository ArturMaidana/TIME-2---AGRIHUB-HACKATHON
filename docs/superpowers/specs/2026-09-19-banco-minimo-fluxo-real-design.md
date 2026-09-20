# AgriHub — Banco mínimo e fluxo real do totem

**Versão:** 1.0
**Status:** aprovado para virar plano de implementação
**Escopo:** reduzir o seed a dados cadastrais mínimos, formalizar o procedimento de
reset do banco, e confirmar que uma resposta real do totem aparece de verdade no
painel do supervisor — sem IA (o motor determinístico de análise já existente segue
como está; nada de IA generativa entra nesta rodada).

## 1. Objetivo

Até agora o banco sempre subia com ~35 dias de dados sintéticos e um alerta forçado
para demonstração. Isso serviu para validar telas rapidamente, mas atrapalha o
próximo passo: testar o sistema com dado real, entrando pelo totem, e ver o reflexo
verdadeiro no painel — sem histórico fake competindo com o que a pessoa acabou de
responder.

Esta spec cobre:

1. Reduzir `seedDatabase()` ao mínimo cadastral (sem respostas, sem histórico de RH,
   sem alerta artificial).
2. Ajustar `efetivo_esperado` para um valor realista de teste manual (5, não 15).
3. Formalizar `npm run db:rebuild` como *o* procedimento de reset — documentado o
   suficiente para ser reexecutado sob pedido, em qualquer sessão futura, sem
   depender de memória de conversa.
4. Verificar ponta a ponta que uma resposta real do totem aparece no painel do
   supervisor assim que a amostra mínima configurada for atingida.

## 2. O que fica no banco após o reset (dados cadastrais mínimos)

| Tabela | Conteúdo após o reset |
| --- | --- |
| `units` | 1 unidade demonstrativa (`Frigorífico Vale Verde`) |
| `users` | 1 supervisor (`SUPERVISOR`) + 1 usuário de RH (`RH2026`) |
| `sectors` | os 10 setores padronizados (Área Quente/Fria) |
| `shifts` | os 3 turnos padronizados (Manhã/Tarde/Noite) |
| `user_sectors` | supervisor vinculado aos 10 setores |
| `totens` | 1 totem (`TOTEM-01`) |
| `configuracoes_indicadores` | 1 linha com os pesos/limiares padrão já validados |
| `efetivos_setor_turno` | 30 linhas (10 setores × 3 turnos) com `efetivo_esperado = 5` |

**Tudo o mais fica vazio**: `responses`, `hr_indicators`, `indices_setor`, `alertas`,
`analises_periodicas`, `planos_acao`, `acoes_plano`, `log_auditoria`,
`requisicoes_totem`. Essas tabelas só recebem linhas a partir de uso real do sistema
(totem, RH lançando indicadores, cálculo do índice sob demanda).

`efetivo_esperado = 5` casa com `amostra_minima = 5` já configurado: a primeira
resposta já conta, e a partir da 3ª resposta a confiabilidade já vira `ALTA`
(`amostra_ideal = efetivo × cobertura_alvo = 5 × 0.6 = 3`), o que torna visível na
prática o efeito de responder pelo totem sem precisar de dezenas de cliques.

## 3. O que sai do código

- `seedResponses()` (gerador dos 35 dias de respostas sintéticas) — removida.
- `seedExampleAlertToday()` (o alerta vermelho forçado para "Expedição com osso") —
  removida. Se um alerta aparecer depois do reset, é porque uma regra real disparou
  em cima de dado real.
- O bloco de `hr_indicators` de 5 semanas sintéticas no seed — removido. RH lança
  indicadores reais pela tela própria (`POST /api/hr`), que já existe e já funciona.

`STANDARD_SECTORS` e `SHIFTS` continuam — são cadastro, não dado de demonstração.

## 4. Procedimento de reset (o que rodar sempre que for pedido)

**Comando:** `npm run db:rebuild`

Já existe e já faz exatamente o que é necessário — não é preciso criar nada novo:

1. Trunca todas as tabelas em cascata a partir de `units` (o Postgres propaga a
   cascata por FK para todas as tabelas dependentes, incluindo as de análise que não
   estão explicitamente listadas no script — `server/database/rebuild.js` será
   atualizado só para deixar a lista explícita e legível, sem mudar o comportamento).
2. Reaplica as migrations (idempotente).
3. Roda `seedDatabase()` — agora populando apenas o cadastro mínimo da seção 2.

**Regra de uso nesta e em sessões futuras:** sempre que o usuário pedir para "limpar",
"resetar" ou "zerar" o banco, o procedimento é rodar `npm run db:rebuild` e confirmar
com `npm run db:status`. Isso fica documentado no `README.md` para não depender de
memória de conversa.

Este comando **é destrutivo** — apaga toda resposta, alerta, análise e plano de ação
acumulados. Antes de rodar sobre um banco com dado que pareça não-demonstrativo
(ex.: respostas reais de um piloto em andamento), confirmar com o usuário antes de
executar, mesmo já havendo pedido explícito de reset — a menos que o próprio pedido
já deixe isso implícito (como nesta conversa).

## 5. Verificação do fluxo real (critério de aceite)

Depois do reset, validar manualmente, nesta ordem:

1. Totem carrega, mostra os 10 setores e o turno vigente calculado corretamente.
2. Responder as 3 perguntas para um setor/turno → `POST /api/totem/responses` retorna
   `{ok:true}` e grava em `responses` (idempotência e atomicidade já cobertas pelos
   testes existentes, não precisam de nova verificação).
3. Painel do supervisor, ao carregar `GET /api/v1/supervisor/indices` para aquele
   setor/turno, calcula o índice sob demanda a partir da resposta recém-gravada — sem
   precisar de job/cron, o cálculo é on-demand por request, já é assim hoje.
4. Com 1-2 respostas: índice aparece como `INCONCLUSIVO` (abaixo da amostra mínima de
   5) — comportamento correto, não é bug.
5. Com 5+ respostas no mesmo setor/turno/dia: índice passa a ter `score`/`status`
   visíveis, com confiabilidade `ALTA` a partir de 3 (ver seção 2).
6. Repetir para um segundo setor/turno confirmando isolamento (a resposta de um setor
   não deveria mudar o índice de outro).

Nenhuma tela nova é necessária — o objetivo aqui é validar que o pipeline
totem → `responses` → `indices_setor` (cache computado) → painel funciona com dado
real, não sintético.

## 6. Fora do escopo desta rodada

- Qualquer IA (simulada ou real) além do motor determinístico já existente.
- Novas telas ou campos.
- Mudança nos pesos do índice, regras de alerta ou motor de análise — só o volume e a
  origem do dado mudam.
- Dados de RH: continuam entrando manualmente pela tela existente; este reset não
  cria nem RH histórico.

## 7. Decisões desta rodada

| Pendência | Decisão |
| --- | --- |
| Quanto de histórico sobrevive ao reset | Zero — só cadastro |
| Alerta de exemplo forçado | Removido |
| `efetivo_esperado` | 5 (era 15), casa com `amostra_minima = 5` |
| Procedimento de reset | `npm run db:rebuild`, documentado no README como comando padrão sob pedido |
