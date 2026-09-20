# AgriHub — Chat Anônimo (reclamações e sugestões do funcionário)

**Versão:** 1.0
**Status:** aprovado para virar plano de implementação
**Escopo:** novo canal para o funcionário registrar reclamações/sugestões de forma
anônima, com uma entrada de login própria (hoje um portão simples, mais tarde um
login separado de verdade), e uma área nova de notificações para o supervisor.

## 1. Objetivo

Hoje o único canal do trabalhador com o sistema é o totem (escala 1-5, sem texto).
Este módulo adiciona um segundo canal — texto livre, categorizado como reclamação ou
sugestão — sem abrir mão da regra inegociável do projeto: nenhuma tabela liga um
registro a uma pessoa. O supervisor passa a ver essas mensagens numa área de
notificações própria, separada dos alertas de índice já existentes, podendo marcar o
andamento de cada uma.

Não é uma conversa de duas vias nesta rodada — o funcionário envia, o supervisor lê e
trata; não há resposta visível de volta para quem enviou.

## 2. Modelo de dados

Tabela nova, seguindo o padrão de nomenclatura em português já usado nas tabelas de
análise (`alertas`, `planos_acao`):

```sql
CREATE TABLE reclamacoes_sugestoes(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('RECLAMACAO','SUGESTAO')),
  mensagem TEXT NOT NULL CHECK(char_length(mensagem) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ANALISE','TRATADO','DESCARTADO')),
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_reclamacoes_scope ON reclamacoes_sugestoes(unidade_id, setor_id, status);
```

Nenhuma coluna de identificação de pessoa — mesma granularidade mínima do totem
(`unidade + setor + turno + data`), só que aqui a "resposta" é uma linha com texto,
não um contador agregado (mensagem livre não dá pra agregar como nota 1-5; o
anonimato continua garantido pela ausência de qualquer identificador, não pela
agregação).

`turno_id` é detectado automaticamente pelo horário, do mesmo jeito que o totem já
faz (reaproveita `findCurrentShift`) — grava contexto útil pro supervisor, mas o
roteamento da notificação é só por setor (ver seção 4).

## 3. Login do funcionário (papel novo, sem identificar ninguém)

- Novo papel de sessão: `FUNCIONARIO`.
- Aba nova no login existente (`Login.jsx`), ao lado de Supervisor/RH/Totem — mesma
  UI, mesmo padrão de "código de acesso" pré-preenchido, só que aqui o código não
  valida credencial nenhuma de verdade: `POST /api/auth` com `{ type: 'FUNCIONARIO' }`
  sempre cria uma sessão válida (não existe tabela de funcionário, não existe senha).
  Isso é proposital — é a "porta" que a spec do desafio já previa ficar mais robusta
  depois, com login separado de verdade; por ora ela só declara a intenção na UI e
  destrava a tela.
- Unidade da sessão: como não há credencial para resolver a unidade (diferente do
  totem, que resolve por `credential`, ou do supervisor/RH, que resolve por usuário),
  a sessão usa a única unidade cadastrada (`SELECT id FROM units LIMIT 1`). Registrado
  aqui como simplificação deliberada de piloto single-tenant — se um dia existir mais
  de uma unidade, este ponto precisa de uma tela de seleção de unidade antes do login.
- `authorize(['FUNCIONARIO'], ...)` protege as rotas novas do funcionário; nenhuma
  rota de supervisor, RH ou totem aceita esse papel, e vice-versa (mesmo modelo dos
  outros três papéis).

## 4. Fluxo de envio (portal do funcionário)

Tela nova, sem sidebar (como o totem — tela dedicada, não faz parte do `Shell`):

1. Funcionário entra pela aba nova do login (sem identificação).
2. Escolhe o setor (mesma grade de botões grandes do totem, sem escolha de turno —
   automático).
3. Escolhe o tipo: Reclamação ou Sugestão.
4. Escreve a mensagem em texto livre (limite de 2000 caracteres, refletido no
   textarea).
5. Envia; tela de confirmação ("Obrigado, sua mensagem foi enviada de forma anônima
   ao supervisor do setor"); volta ao início automaticamente, mesmo padrão do totem.

Sem botão de pular, sem confirmação de identidade, sem histórico de envios anteriores
visível (não existe onde guardar isso sem identificar a pessoa).

## 5. Notificações do supervisor

Área nova, separada do painel "Alertas Ativos" já existente (que é gerado por regra
sobre índice, não por texto de pessoa):

- Novo item de navegação na `Shell` (visível só para `SUPERVISOR`): "Notificações",
  com contador de itens `ABERTO`.
- Lista as reclamações/sugestões dos setores vinculados ao supervisor (mesmo escopo
  já aplicado em alertas/planos de ação), mais recentes primeiro, com filtro por
  status.
- Cada item mostra: tipo (badge Reclamação/Sugestão), setor, turno, mensagem, data, e
  um seletor de status (`ABERTO → EM_ANALISE → TRATADO/DESCARTADO`), no mesmo padrão
  de interação já usado nos planos de ação.

## 6. Contratos de API

```text
POST  /api/auth                              { type: 'FUNCIONARIO' } → sessão sem código
GET   /api/chat/contexto                     setores ativos + turno atual (papel FUNCIONARIO)
POST  /api/chat/mensagens                    { setorId, tipo, mensagem } (papel FUNCIONARIO)

GET   /api/v1/supervisor/notificacoes        ?status= (papel SUPERVISOR, escopado por setor)
PATCH /api/v1/supervisor/notificacoes/:id    { status } (papel SUPERVISOR)
```

`GET /api/chat/contexto` espelha `GET /api/totem` (setores ativos da unidade + turno
atual calculado no servidor) — sem reaproveitar a rota do totem porque os papéis são
diferentes e as rotas são gateadas por papel.

## 7. Telas afetadas

- `Login.jsx`: nova aba "Funcionário".
- `App.jsx`: nova rota — `auth.role === 'FUNCIONARIO'` renderiza a tela de chat, fora
  do `Shell` (como o totem).
- Tela nova `web/src/features/chat/ChatAnonimo.jsx`.
- `Shell.jsx`: novo item de navegação "Notificações" (só para supervisor).
- Tela nova `web/src/features/dashboard/Notifications.jsx`.

## 8. Fora do escopo desta rodada

- Chat de verdade (resposta visível para quem enviou) — precisaria de uma forma de o
  funcionário reencontrar a própria conversa sem se identificar, o que não existe
  ainda.
- Login de funcionário de verdade (cadastro, senha, matrícula) — fica para quando o
  login for de fato separado, como o pedido já antecipa.
- Moderação de conteúdo, limite de envios por período, ou qualquer forma de
  rate-limiting.
- Notificação por e-mail/push para o supervisor — fica só na área de notificações
  dentro do próprio painel.
- Seleção de unidade (múltiplos frigoríficos) — assume piloto single-tenant, como o
  resto do sistema hoje.

## 9. Decisões desta rodada

| Pendência | Decisão |
| --- | --- |
| Formato do chat | Uma via — funcionário envia, supervisor trata o status |
| Anonimato do login do funcionário | Login não identifica nada; nenhuma tabela liga o registro a uma pessoa |
| Escopo por setor | Setor obrigatório, roteia a notificação para o supervisor certo |
| Onde aparece a notificação | Área própria ("Notificações"), separada do painel de Alertas |
