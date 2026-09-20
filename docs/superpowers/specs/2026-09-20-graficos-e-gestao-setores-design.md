# AgriHub — Suavização do gráfico + Gestão de Setores (CRUD)

**Versão:** 1.0
**Status:** aprovado para virar plano de implementação
**Escopo:** dois itens independentes, aprovados juntos na mesma rodada: (1) ajuste
visual no componente de gráfico do dashboard, e (2) uma tela nova de cadastro/edição
de setores (CRUD), com efetivo esperado por turno editável.

## 1. Ajuste visual do gráfico (`LineChart.jsx`)

### Diagnóstico

O componente [`LineChart.jsx`](../../../web/src/components/LineChart.jsx) já desenha
uma curva suave (spline Catmull-Rom, função `getCurvedPath`) ligando os pontos reais
de cada métrica — não é um gráfico de dispersão. O que hoje parece "pontinhos
espalhados" é o marcador (`<circle>`, raio 3px) desenhado em cima de cada ponto real:
com pouco histórico (1-2 respostas no período, que é o estado normal de um banco
recém-zerado), os marcadores dominam visualmente porque a linha entre eles é curta
ou inexistente. **Isso não é um bug de cálculo — é só peso visual demais no
marcador.** Nenhuma mudança de dado ou de algoritmo de curva é necessária.

### Mudança

Em `LineChart.jsx`, no bloco que desenha `chart-dot` (dentro de `chartType ===
'curve'`):

- Marcador em estado normal (não hover): raio reduzido de `3` para `2`, com
  `fillOpacity` por volta de `0.55` (linha e área preenchida continuam 100% opacas —
  só o círculo fica discreto).
- Marcador em hover (`isHovered`): mantém como está hoje (`r=5.5`, `fill="#fff"`,
  contorno colorido) — é o único momento em que o ponto precisa se destacar, para dar
  o valor exato no tooltip.
- Nenhuma mudança em `getCurvedPath`, `getAreaPath`, na grade, nos eixos ou no modo
  "Barras" — escopo é só o marcador do modo "Linhas".

### Fora de escopo

- Não inventar/interpolar pontos que não existem nos dados reais (violaria a regra
  do projeto de nunca fabricar números).
- Não mexer no modo "Barras" nem no tooltip.

## 2. Gestão de Setores (CRUD)

### Objetivo

Hoje os setores só existem via seed (`STANDARD_SECTORS` em `seed.js`) — não há
nenhuma tela para o Supervisor criar, renomear, trocar categoria, desativar/reativar
um setor, ou ajustar quantas pessoas são esperadas por turno naquele setor
(`efetivo_esperado`, hoje só editável no banco). Esta tela fecha essa lacuna.

### Por que não precisa de migration nova

O schema já tem tudo que este CRUD precisa:

- `sectors.active` (`INTEGER 0/1`, `migrations/001_baseline.up.sql`) — já é o
  mecanismo de soft-delete usado em todo o app. `SectorModel.listActiveByUnit` e
  `findActiveInUnit` já filtram por `active = 1`; o totem, o dashboard e os demais
  fluxos de uso já ignoram setor inativo automaticamente, sem nenhuma mudança nesses
  lugares.
- `efetivos_setor_turno` (`migrations/002_analytics.up.sql`) — já relaciona
  `(unidade_id, setor_id, turno_id) → efetivo_esperado`, com `UNIQUE` nessa tripla.

Ou seja: **"excluir" um setor = `UPDATE sectors SET active = 0`**. O histórico
(respostas, alertas, índices, análises, planos de ação, reclamações daquele setor)
nunca é apagado — fica intacto no banco, só some das telas de uso corrente (totem,
dashboard) porque elas já filtram por `active = 1`. Reativar é o mesmo UPDATE com
`active = 1`. Exclusão definitiva (`DELETE`) não faz parte deste CRUD.

### Modelo de dados (sem migration — reaproveita o que já existe)

```sql
-- já existe, sem mudança:
sectors(id, unit_id, name, category CHECK IN ('QUENTE','FRIA'), active CHECK IN (0,1))
  UNIQUE(unit_id, name)

efetivos_setor_turno(id, unidade_id, setor_id, turno_id, efetivo_esperado)
  UNIQUE(unidade_id, setor_id, turno_id)
```

### Backend

**`server/models/sector-model.js`** — adicionar:

- `listByUnit` passa a incluir `active` no `SELECT` (hoje só retorna `id, name,
  category`) — necessário pra tela mostrar setor inativo com o badge certo.
- `create({ unitId, name, category })` → `INSERT INTO sectors(id, unit_id, name,
  category, active) VALUES($1,$2,$3,$4,1)`, retorna a linha criada. Conflito de
  nome duplicado (`UNIQUE(unit_id, name)`) deve virar erro de validação amigável, não
  um 500 — o service trata o `error.code === '23505'` do `pg`.
- `update({ id, unitId, name, category })` → `UPDATE sectors SET name=$1,
  category=$2 WHERE id=$3 AND unit_id=$4`, só nos campos informados (partial
  update — se `name` não vier, mantém o atual, idem `category`).
- `setActive({ id, unitId, active })` → `UPDATE sectors SET active=$1 WHERE id=$2
  AND unit_id=$3`.
- `findInUnit(id, unitId)` → busca por id dentro da unidade **sem** filtrar por
  `active` (diferente de `findActiveInUnit`) — usado pelas validações de
  update/setActive/efetivo, já que a tela precisa editar setor inativo também.

**`server/models/efetivo-model.js`** (novo):

- `listBySector({ unidadeId, setorId })` → `JOIN shifts`, retorna um array por
  turno: `[{ turnoId, turnoNome, startTime, endTime, efetivoEsperado }]`, ordenado
  por `start_time` (mesma ordem que `ShiftModel.listByUnit` já usa).
- `upsert({ unidadeId, setorId, turnoId, efetivoEsperado })` →
  `INSERT ... ON CONFLICT (unidade_id, setor_id, turno_id) DO UPDATE SET
  efetivo_esperado = $4`.
- `createDefaultsForSector({ unidadeId, setorId, turnos, efetivoPadrao })` → um
  `INSERT` por turno recebido (lista de `ShiftModel.listByUnit`), usado só na
  criação de setor novo. `efetivoPadrao = 5`, a mesma constante já usada em
  `seed.js` (`EFETIVO_ESPERADO_PADRAO`).

**`server/services/setor-gestao-service.js`** (novo):

- `listarComTurnos({ unidadeId })` → busca todos os setores (`SectorModel.listByUnit`,
  ativos e inativos) e, pra cada um, os turnos via `EfetivoModel.listBySector` —
  retorna já no formato que o card do frontend consome:
  `{ id, name, category, active, turnos: [...] }`.
- `criar({ unidadeId, name, category })` → valida (`name` não vazio, até 80
  caracteres, trim; `category` em `['QUENTE','FRIA']`), busca os turnos da unidade
  (`ShiftModel.listByUnit`), e roda **em transação** (via `withTransaction`, já
  existente em `server/config/database.js`): insere o setor, depois
  `EfetivoModel.createDefaultsForSector` pros 3 turnos. Se o nome já existir
  (`UNIQUE(unit_id,name)`), retorna `{ ok:false, error:'Já existe um setor com esse
  nome' }` em vez de deixar estourar.
- `atualizar({ id, unidadeId, name, category })` → mesma validação de `criar`
  (campos que vierem), chama `SectorModel.findInUnit` pra confirmar que o setor é da
  unidade antes de tentar o `UPDATE`.
- `atualizarStatus({ id, unidadeId, active })` → confirma existência na unidade,
  chama `SectorModel.setActive`.
- `atualizarEfetivo({ unidadeId, setorId, turnoId, efetivoEsperado })` → valida
  inteiro positivo (`Number.isInteger(n) && n > 0`), confirma que o setor e o turno
  são da unidade, chama `EfetivoModel.upsert`.

**`server/controllers/setor-gestao-controller.js`** (novo) — segue exatamente o
padrão de `supervisor-controller.js` (`json`, `parseBody`, `session.unitId`):

- `listSetores(_request, response, { session })`
- `criarSetor(request, response, { session })`
- `atualizarSetor(request, response, { session, url })` — `id =
  url.pathname.split('/').pop()`
- `atualizarStatusSetor` — pode ser a mesma função de `atualizarSetor` se o corpo
  aceitar `{ name?, category?, active? }` junto (evita duplicar rota/controller);
  a spec assume isso: **um único PATCH em `/setores/:id` aceita os três campos,
  todos opcionais**, igual a um patch parcial de formulário.
- `atualizarEfetivoSetor(request, response, { session, url })` — extrai dois ids do
  path: `const parts = url.pathname.split('/'); const setorId = parts[5]; const
  turnoId = parts[7];` (path é
  `/api/v1/supervisor/setores/:setorId/efetivos/:turnoId`, então os índices 5 e 7
  batem com o `split('/')` que já é usado pros outros PATCH do projeto).

**`server/routes/api-routes.js`** — adicionar:

```js
['GET /api/v1/supervisor/setores', authorize(['SUPERVISOR'], listSetores)],
['POST /api/v1/supervisor/setores', authorize(['SUPERVISOR'], criarSetor)],
```

e, no bloco de `handleApi` que já trata PATCH com id na URL (mesmo formato de
`alertas/:id`, `planos-acao/:id`, `notificacoes/:id`):

```js
if (request.method === 'PATCH' && url.pathname.startsWith('/api/v1/supervisor/setores/')
    && url.pathname.includes('/efetivos/')) {
  return asyncController(authorize(['SUPERVISOR'], atualizarEfetivoSetor))(request, response, { url });
}
if (request.method === 'PATCH' && url.pathname.startsWith('/api/v1/supervisor/setores/')) {
  return asyncController(authorize(['SUPERVISOR'], atualizarSetor))(request, response, { url });
}
```
(a checagem de `/efetivos/` tem que vir **antes** da checagem genérica de
`setores/`, senão a rota mais específica nunca é alcançada.)

### Seed — "Setor Teste"

Em `server/database/seed.js`, adicionar uma linha em `STANDARD_SECTORS`:

```js
['s12', 'Setor Teste', 'FRIA'],
```

Como o loop de seed já itera `STANDARD_SECTORS` genericamente (setor + `user_sectors`
+ os 3 `efetivos_setor_turno`), essa única linha basta — nasce junto com os outros 11
setores, ativo, com efetivo padrão 5 em cada turno, pronto pra testar editar,
desativar e reativar pela tela nova. Categoria `FRIA` é uma escolha arbitrária de
baixo risco — dá pra trocar pela própria tela depois de criada.

### Frontend

**`web/src/features/dashboard/SectorManagement.jsx`** (novo):

- Busca `GET /api/v1/supervisor/setores` num `useEffect`, guarda em `setores`.
- Grid de cards pequenos (`grid-template-columns: repeat(auto-fill, minmax(240px,
  1fr))`, no mesmo espírito visual de `.totem-sector-grid`, mas mais compacto — like
  os cards de setor do totem, sem o tamanho de toque grande que o totem precisa).
- Cada card mostra: ícone + nome + badge de categoria (reaproveita `getSectorIcon`
  de `sector-groups.js` pra manter o mesmo padrão visual usado no Totem/Chat), um
  badge "Inativo" (cinza, discreto) quando `active === false`, e as 3 linhas de
  turno com `<input type="number" min="1">` pro efetivo esperado — `onBlur` dispara o
  PATCH daquele turno específico (sem precisar de um botão "salvar" por linha).
- Botão "Editar" no card abre um modal pequeno (mesmo componente visual de
  `.filter-modal-*` já usado em Dashboard/MonthlyAnalysis) com campos nome e
  categoria (select QUENTE/FRIA), botão "Salvar" chama o PATCH principal.
- Botão "Desativar"/"Reativar" no rodapé do card (texto muda conforme `active`),
  chama o PATCH com `{ active: !active }` — sem modal de confirmação extra, já que a
  ação é reversível a qualquer momento pela mesma tela.
- Card fixo "+ Novo Setor" no início do grid, abre o mesmo modal de edição, vazio,
  que na submissão chama `POST` em vez de `PATCH`.

**`web/src/layout/Shell.jsx`** — novo item na navbar, **só para
`auth.role === 'SUPERVISOR'`** (mesmo padrão dos itens já corrigidos nesta sessão):
ícone `Grid2x2` do `lucide-react` (confirmado disponível na versão instalada),
`page === 'sector-management'`,
título "Gestão de Setores". Entra no switch de `content` junto dos outros.

### Fora de escopo (confirmado nas perguntas de esclarecimento)

- Criar/editar/apagar turnos em si — continuam fixos (Manhã/Tarde/Noite), só o
  `efetivo_esperado` de cada turno dentro de um setor é editável aqui.
- Exclusão definitiva de setor (sempre soft-delete via `active`).
- Acesso do RH a esta tela (só Supervisor).

### Testes

Novo `test/setor-gestao.test.js`, seguindo o padrão dos testes de serviço já
existentes no projeto (chama o `service` diretamente, sem subir HTTP):

- criar setor → aparece em `listarComTurnos` com os 3 turnos e efetivo 5 em cada;
- criar setor com nome duplicado → retorna erro de validação, não lança exceção;
- atualizar nome/categoria → reflete em `listarComTurnos`;
- atualizar efetivo de um turno específico → só aquele turno muda, os outros dois
  continuam com o valor anterior;
- desativar → some de `SectorModel.listActiveByUnit` (usado pelo totem), continua
  em `SectorModel.listByUnit` e em `listarComTurnos`;
- reativar → volta a aparecer em `listActiveByUnit`.

`test/mvc-services.test.js` — os dois `assert.equal(..., 11)` (contagem de setores,
setados nesta mesma sessão quando "Administrativo/Comercial" foi adicionado) sobem
para `12`, já que "Setor Teste" se torna o 12º setor padrão.
