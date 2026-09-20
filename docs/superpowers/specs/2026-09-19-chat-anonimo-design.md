# AgriHub — Chat Anônimo (reclamações e sugestões do funcionário)

**Versão:** 2.0 (revisa a v1.0 — troca login sem identidade + envio único por login
com pseudônimo persistente + reclamação/sugestão com retorno do supervisor)
**Status:** aprovado para virar plano de implementação
**Escopo:** canal para o funcionário registrar reclamações/sugestões com um pseudônimo
próprio (sem senha, auto-gerado), permitindo que o supervisor responda e o funcionário
volte depois — usando o mesmo pseudônimo — para ver a resposta.

## 1. Objetivo

Hoje o único canal do trabalhador é o totem (escala 1-5, sem texto, sem volta). Este
módulo adiciona um segundo canal — texto livre, categorizado como reclamação ou
sugestão — com uma forma de o funcionário voltar e ver se o supervisor respondeu, sem
nunca coletar nome, matrícula, CPF ou qualquer dado que identifique a pessoa de
verdade.

**Distinção importante, para não confundir com a regra de anonimato do restante do
sistema:** este módulo introduz um *pseudônimo de sessão* (`anonimo_1`, `anonimo_2`,
...) — um identificador que só serve para reencontrar a própria conversa depois, sem
senha e sem qualquer dado real por trás. Isso é diferente de identificar uma pessoa:
qualquer um pode gerar um pseudônimo novo a qualquer momento, ele não carrega nome,
função, CPF, matrícula ou biometria, e nada no sistema tenta ligá-lo a uma pessoa
real. As tabelas de bem-estar do totem continuam exatamente como estão — sem qualquer
identificador. Este é o único ponto do sistema com um identificador persistente
(pseudônimo, não pessoa), e essa decisão foi pedida explicitamente nesta rodada.

## 2. Login do funcionário — pseudônimo auto-gerado, sem senha

Reaproveita o mesmo mecanismo de login já usado por Supervisor/RH (usuário com
`código de acesso`, tabela `users`), só que:

- Papel novo: `FUNCIONARIO`, adicionado ao `CHECK` de `users.role` (migration).
- **Criar acesso novo**: no formulário de login, aba "Funcionário", campo de código
  vazio por padrão (diferente das outras abas, que já vêm preenchidas). Ao enviar em
  branco, o backend cria um usuário novo com `role = 'FUNCIONARIO'`,
  `code = 'anonimo_N'`, `name = 'Anônimo N'`, onde `N` é o próximo número disponível
  na unidade (incremental, calculado a partir da contagem atual de funcionários —
  com nova tentativa em caso raro de colisão, já que `code` é `UNIQUE`). A resposta
  do login mostra esse código com destaque e uma instrução clara: **"Anote seu código
  — você vai precisar dele para ver a resposta do supervisor depois."**
- **Retomar acesso existente**: mesma aba, digitando um código já existente
  (`anonimo_7`, por exemplo) — mesma consulta que já existe hoje para
  Supervisor/RH (`AuthModel.findUserByCode`), sem mudança nenhuma nesse caminho.
- Sem senha em nenhum dos dois casos, igual ao restante da plataforma hoje (login
  simples, pensado para acesso fácil e teste).

## 3. Modelo de dados

```sql
-- migration: adiciona FUNCIONARIO ao papel de usuário já existente
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK(role IN ('SUPERVISOR','RH','FUNCIONARIO'));

CREATE TABLE reclamacoes_sugestoes(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  usuario_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK(tipo IN ('RECLAMACAO','SUGESTAO')),
  mensagem TEXT NOT NULL CHECK(char_length(mensagem) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ANALISE','TRATADO','DESCARTADO')),
  resposta_supervisor TEXT CHECK(resposta_supervisor IS NULL OR char_length(resposta_supervisor) BETWEEN 1 AND 2000),
  respondido_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_reclamacoes_scope ON reclamacoes_sugestoes(unidade_id, setor_id, status);
CREATE INDEX idx_reclamacoes_usuario ON reclamacoes_sugestoes(usuario_id);
```

`usuario_id` aponta para o pseudônimo (`anonimo_N`), nunca para uma identidade real —
ver seção 1. `turno_id` continua detectado automaticamente pelo horário, como no
totem; o roteamento da notificação ao supervisor é por setor (seção 5).

**Retorno = uma resposta por ticket, não um chat infinito.** O supervisor responde
uma vez (`resposta_supervisor` + `respondido_em`, editável se precisar corrigir); se o
funcionário quiser continuar a conversa, ele manda uma nova reclamação/sugestão — que
aparece junto na lista pessoal dele, formando um histórico. Fica registrado aqui como
simplificação desta rodada: não há um único "fio" com múltiplas mensagens indo e
voltando dentro do mesmo ticket.

## 4. Portal do funcionário (tela nova, sem sidebar — como o totem)

Ao logar (novo ou retomando), a tela mostra:

1. **Minhas mensagens**: lista das reclamações/sugestões enviadas por aquele
   pseudônimo, mais recente primeiro, cada uma com setor, tipo, status e a resposta
   do supervisor quando houver.
2. **Nova mensagem**: botão que abre o mesmo fluxo da v1 desta spec — escolher setor
   (grade de botões, como o totem), escolher tipo (Reclamação/Sugestão), escrever a
   mensagem (até 2000 caracteres), enviar.
3. O código do pseudônimo fica sempre visível no cabeçalho da tela (para o caso de a
   pessoa esquecer de anotar) e há um botão "Sair" que apenas encerra a sessão local —
   não apaga nada, o código continua válido para logar de novo depois.

## 5. Notificações do supervisor

Sem mudança em relação à v1 desta spec:

- Item novo na navegação da `Shell` (só para `SUPERVISOR`): "Notificações", com
  contador de itens `ABERTO`.
- Lista escopada pelos setores vinculados ao supervisor, mais recentes primeiro,
  filtro por status.
- Cada item mostra tipo, setor, turno, mensagem, data, campo de resposta (texto livre,
  vira `resposta_supervisor`) e seletor de status — mesmo padrão de interação já usado
  em planos de ação.

## 6. Contratos de API

```text
POST  /api/auth                              { type: 'FUNCIONARIO', code?: '' }
                                              código vazio/ausente → cria anonimo_N novo
                                              código existente → retoma sessão

GET   /api/chat/contexto                     setores ativos + turno atual (papel FUNCIONARIO)
GET   /api/chat/mensagens                    minhas mensagens (papel FUNCIONARIO, usuario_id da sessão)
POST  /api/chat/mensagens                    { setorId, tipo, mensagem } (papel FUNCIONARIO)

GET   /api/v1/supervisor/notificacoes        ?status= (papel SUPERVISOR, escopado por setor)
PATCH /api/v1/supervisor/notificacoes/:id    { status, resposta? } (papel SUPERVISOR)
```

## 7. Telas afetadas

- `Login.jsx`: nova aba "Funcionário" — código vazio por padrão, texto explicando
  criar novo vs. retomar.
- `App.jsx`: `auth.role === 'FUNCIONARIO'` renderiza o portal do funcionário, fora do
  `Shell` (como o totem).
- Tela nova `web/src/features/chat/ChatAnonimo.jsx` (lista + formulário de nova
  mensagem).
- `Shell.jsx`: novo item "Notificações" (só supervisor).
- Tela nova `web/src/features/dashboard/Notifications.jsx`.

## 8. Fora do escopo desta rodada

- Múltiplas respostas dentro do mesmo ticket (fio de chat completo) — cada ticket tem
  no máximo uma resposta do supervisor.
- Recuperação de código esquecido (se a pessoa perder o `anonimo_N` e não tiver
  anotado, a única saída é criar um pseudônimo novo — sem e-mail/telefone para
  recuperação, pois isso reintroduziria identificação).
- Moderação de conteúdo, limite de envios por período, rate-limiting.
- Notificação por e-mail/push — fica só na área de notificações dentro do painel.
- Seleção de unidade (múltiplos frigoríficos) — assume piloto single-tenant.
- Qualquer ligação entre o pseudônimo e uma identidade real, hoje ou no futuro.

## 9. Decisões desta rodada

| Pendência | Decisão |
| --- | --- |
| Senha no login do funcionário | Não — mesmo padrão simples de código já usado hoje |
| Como o funcionário volta a achar a própria mensagem | Pseudônimo auto-gerado e incremental (`anonimo_N`), sem dado real por trás |
| Retorno do supervisor | Sim — uma resposta por ticket, visível ao retomar o pseudônimo |
| Escopo por setor | Mantido — setor obrigatório, roteia a notificação |
| Onde aparece a notificação | Área própria ("Notificações"), separada do painel de Alertas |
