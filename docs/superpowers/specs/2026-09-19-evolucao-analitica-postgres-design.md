# AgriHub — Evolução analítica e migração para PostgreSQL

**Versão:** 1.0
**Status:** aprovado para virar plano de implementação
**Baseado em:** [`SPEC-ADICIONAL.md`](../../../SPEC-ADICIONAL.md), sobre o MVP descrito em [`SPEC.md`](../../../SPEC.md) e [`AGENT.md`](../../../AGENT.md)

## 1. Objetivo

Evoluir o MVP atual (SQLite, síncrono, `node:sqlite`) para:

1. Rodar exclusivamente sobre PostgreSQL.
2. Calcular um índice de atenção por setor/turno/período, com comparação temporal,
   qualidade de amostra e alertas automáticos.
3. Gerar, por regras determinísticas versionadas, um resumo semanal/mensal com plano
   de ação — sem diagnóstico individual e sem IA generativa externa.
4. Tornar o totem robusto a reenvios técnicos e escrita concorrente, sem introduzir
   qualquer identificador de pessoa.

Escopo cobre as oito fases da seção 9 de `SPEC-ADICIONAL.md`. Cada fase vira um passo
do plano de implementação e, na prática, um checkpoint revisável — mas o design abaixo
descreve o sistema final como uma unidade coerente.

## 2. Estado atual (o que já existe)

- Backend Node.js 22, sem framework HTTP, sem ORM. `server/app.js` roteia
  `/api/*` via `Map` em `server/routes/api-routes.js`.
- Persistência: `node:sqlite` (`DatabaseSync`), **síncrono**. Todo o pipeline
  `Controller → Service → Model` é síncrono ponta a ponta.
- Schema atual (`server/database/schema.js`): `units, users, sectors, shifts, totens,
  responses, hr_indicators`. `responses` já é o modelo certo (linha por
  `unidade+setor+turno+data+metric+score`, incrementada via
  `ON CONFLICT ... DO UPDATE SET quantity = quantity + 1`) — não é o modelo de
  entrada/saída do `AGENT.md`, e sim o modelo de 3 perguntas do `SPEC.md`.
- `src/domain/idt.js` e `src/domain/alertas.js` são **código morto**: calculam um IDT
  de entrada/saída que não corresponde ao totem real, e só são usados pelos próprios
  testes (`test/idt.test.js`, `test/alertas.test.js`). Serão substituídos.
- `server/services/dashboard-service.js` expõe uma `simulatedAnalysis` fixa (texto
  hardcoded) — será substituída pelo motor determinístico real.
- Frontend React (Vite) em `web/src/features/{totem,dashboard,hr,auth}`.

## 3. Mudança estrutural: síncrono → assíncrono

`pg` (driver Postgres padrão) é baseado em Promises; `node:sqlite` é síncrono. Não há
como atender "PostgreSQL será o único banco suportado" mantendo o pipeline síncrono.

Toda função em `server/models/*`, `server/services/*` e os controllers que hoje
chamam essas funções passam a ser `async`/`await`. Isso é mecânico (não muda
assinaturas de resposta HTTP nem contratos de API), mas toca praticamente todo
arquivo do backend. É tratado como fase própria (equivalente às fases 1–2 da seção 9
do spec), concluída e testada **antes** de qualquer feature nova ser construída em
cima, para não misturar rewrite estrutural com lógica nova.

`server/utils/http.js` (`asyncController`) já é `async`-safe — nenhuma mudança
necessária ali.

## 4. Camada de dados

- Driver: `pg`, com `Pool` (pool de conexões, requisito do spec 4.2).
- Config: `DATABASE_URL` e `DATABASE_SSL` (`.env.example` já reserva o padrão),
  lidos em `server/config/app-config.js`.
- Dev local: `docker-compose.yml` na raiz subindo `postgres:16-alpine`, usado tanto
  para desenvolvimento quanto para os testes de integração.
- Migrations: runner próprio (sem framework externo), consistente com o estilo atual
  do projeto — arquivos SQL numerados em `server/database/migrations/`, registrados em
  `schema_migrations(version, name, applied_at)` (tabela já existe, mesmo formato).
  Reversível quando fizer sentido (`.down.sql` opcional por migration).
- Seed: mantém o padrão idempotente atual (`INSERT ... ON CONFLICT DO NOTHING` /
  checagem de existência antes de inserir), agora em Postgres.

### 4.1 Tabelas existentes (portadas 1:1, com FKs e CHECKs reais)

`units, users, sectors, shifts, totens, responses, hr_indicators` — mesmo shape,
tipos adaptados (`TEXT`→`TEXT`/`UUID` mantendo `TEXT` para não forçar troca de PKs,
`INTEGER` booleans → `BOOLEAN`, timestamps em `TIMESTAMPTZ` UTC).

### 4.2 Tabelas novas (nomes exatamente como no spec)

```
configuracoes_indicadores   -- pesos, limiares, amostra mínima/ideal, versão da config
efetivos_setor_turno        -- headcount esperado por unidade+setor+turno
indices_setor                -- cache/histórico do índice calculado por escopo+período
alertas                      -- ABERTO | EM_ANALISE | TRATADO | DESCARTADO
analises_periodicas          -- saída do motor determinístico (semanal/mensal)
planos_acao / acoes_plano    -- plano + até 3 ações, status editável pelo supervisor
log_auditoria                -- append-only, hash encadeado (segue padrão do AGENT.md)
requisicoes_totem            -- idempotência técnica do totem, sem dado de pessoa
```

Índices compostos em `(unidade_id, setor_id, turno_id, período)` em todas as tabelas
de série temporal, conforme requisito técnico do spec.

## 5. Migração de dados SQLite → Postgres

Script único (`server/database/migrate-from-sqlite.js`):

1. Backup do `.db` atual (`data/agrihub.db.backup`, já é o padrão existente).
2. Cria schema e roda migrations no Postgres alvo.
3. Importa `units → users → sectors/shifts/totens → responses/hr_indicators`, nessa
   ordem de dependência, dentro de uma transação.
4. Valida: contagem de linhas por tabela e soma agregada de `responses.quantity` por
   setor batem entre origem e destino. Falha = aborta e reporta divergência (spec 4.3
   e critério de aceite "todos os dados existentes são migrados sem divergência").
5. Seed demonstrativo roda apenas se a base estiver vazia (idempotente).

## 6. Índice de atenção do setor

`src/domain/indice-atencao.js` — função pura, testável sem banco (mesmo padrão que já
existia em `idt.js`, mas alinhada ao totem real de 3 perguntas):

```
energia_norm      = média(energia) / 5
fisico_norm       = (6 - média(dor_cansaco)) / 5
emocional_norm    = (6 - média(ansiedade)) / 5
taxa_faltas       = min(1, faltas / efetivo_esperado)
taxa_afastamento  = min(1, afastamentos / efetivo_esperado)

indice = 100 * ( 0.30 * energia_norm
                + 0.20 * fisico_norm
                + 0.20 * emocional_norm
                + 0.15 * (1 - taxa_faltas)
                + 0.15 * (1 - taxa_afastamento) )

status:
  indice >= 70            → VERDE
  50 <= indice < 70        → AMARELO
  indice < 50               → VERMELHO
```

Pesos e limiares vivem em `configuracoes_indicadores` (ajustáveis sem deploy).
`efetivo_esperado` vem de `efetivos_setor_turno`; populado no seed com um valor
demonstrativo (ex.: 15) por setor/turno, editável depois — não bloqueia a
implementação (pendência 10.3 do spec fica resolvida operacionalmente, não
tecnicamente).

Confiabilidade da amostra é **metadado separado** do score (não desconta o índice):

```
amostra_ideal = efetivo_esperado * cobertura_alvo   (cobertura_alvo default 0.6)

total_respostas < amostra_minima (5)         → INCONCLUSIVO (índice oculto no painel)
amostra_minima <= total_respostas < ideal     → BAIXA (exibido, com aviso)
total_respostas >= amostra_ideal              → ALTA
```

`amostra_minima` e `cobertura_alvo` também ficam em `configuracoes_indicadores`.

`src/domain/idt.js` e `src/domain/alertas.js` (modelo entrada/saída, código morto) são
removidos e substituídos por `indice-atencao.js`, `alertas.js` (reescrito),
`comparacao-temporal.js` e `analise-planos.js`.

## 7. `indices_setor` como cache/histórico, não só cálculo on-the-fly

Calculado e gravado via upsert em `(unidade, setor, turno, tipo_periodo,
data_periodo)` sempre que uma consulta de dashboard precisa de um escopo
ausente/desatualizado. Isso dá ao motor de alertas acesso barato ao histórico
(regra "amarelo por 2 períodos consecutivos" precisa de leitura sequencial) e às
telas de comparação uma tabela real para consultar/tendenciar, em vez de recalcular
agregados brutos a cada request.

## 8. Comparação temporal e participação

Comparação lê linhas consecutivas de `indices_setor` (dia vs dia, semana vs semana,
mês vs mês) e retorna: variação percentual por indicador, seta de
melhora/estabilidade/piora, e uma flag explícita de "amostra insuficiente para
comparação" em vez de calcular um número enganoso quando um dos dois lados está
abaixo da amostra mínima. Painel mostra total de respostas e, quando houver
`efetivo_esperado` cadastrado, taxa estimada de participação — deixando claro que
total de respostas ≠ total de pessoas únicas (spec 2.3).

## 9. Alertas automáticos

Mesma passada de cálculo que gera `indices_setor` avalia as 6 condições de gatilho do
spec 2.4 contra o índice recém-calculado e a comparação temporal. Insere uma linha em
`alertas` **apenas** se não existir alerta ativo (`ABERTO`/`EM_ANALISE`) para a mesma
`(unidade, setor, turno, regra)` — checagem feita dentro da mesma transação do insert,
reforçada por índice único parcial no banco (defesa em profundidade contra corrida).
Estados: `ABERTO → EM_ANALISE → TRATADO | DESCARTADO`, editável via
`PATCH /api/v1/supervisor/alertas/:id` pelo supervisor do setor.

## 10. Motor de análise e planos de ação

`src/domain/analise-planos.js`: regras determinísticas versionadas
(`versao_motor: "v1"`), rodando semanal/mensalmente por setor/turno. Lê
`indices_setor` recentes, `alertas` abertos e agregados de RH; produz os 7 elementos
exigidos pelo spec 2.5 (resumo executivo, evidências, correlações sem causalidade,
nível de atenção, até 3 ações sugeridas, indicadores a acompanhar, aviso de que é
apoio à decisão). Persistido em `analises_periodicas`. Cada ação sugerida vira uma
linha em `acoes_plano`, agrupada sob um `planos_acao`; supervisor atualiza status via
`PATCH /api/v1/supervisor/planos-acao/:id`. Contrato de saída fica estável para que a
API possa trocar este motor por uma IA real no futuro sem alterar o frontend (requisito
explícito do spec).

## 11. Totem: idempotência e atomicidade

`requisicoes_totem(unidade_id, idempotency_key UNIQUE, status, criado_em)`. O cliente
gera uma chave aleatória por *tentativa de envio* (não por trabalhador — nada liga a
chave a uma pessoa). Servidor faz `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`
na mesma transação do incremento de contador: uma repetição técnica da mesma
tentativa não duplica; uma nova tentativa após falha de rede usa nova chave e é
aceita normalmente. Incremento de contador mantém o padrão já existente
(`ON CONFLICT ... DO UPDATE SET quantity = quantity + 1`), sintaxe compatível com
Postgres. Sem bloqueio por tempo, IP, setor, turno ou dispositivo — exatamente como
hoje.

## 12. API

Endpoints novos exatamente como listados no spec, seção 6:

```
GET   /api/v1/supervisor/indices
GET   /api/v1/supervisor/comparativo
GET   /api/v1/supervisor/participacao
GET   /api/v1/supervisor/alertas
PATCH /api/v1/supervisor/alertas/:id
GET   /api/v1/supervisor/analises?periodicidade=semanal|mensal
GET   /api/v1/supervisor/planos-acao
PATCH /api/v1/supervisor/planos-acao/:id
```

Adicionados em `server/routes/api-routes.js`, protegidos por `authorize(['SUPERVISOR'],
...)`, escopados por `unidade + setores vinculados ao usuário` (mesmo padrão de
`server/middleware/authorize.js` e das queries atuais). RH continua sem acesso a estas
rotas e fora da navegação do supervisor.

## 13. Frontend

- `web/src/features/dashboard/Dashboard.jsx`: cartão do índice geral + classificação,
  tendência vs período anterior, qualidade da amostra, alertas ativos.
- `web/src/features/dashboard/SectorIndicators.jsx`: tabela comparativa por
  setor/turno, ordenável por nível de atenção, filtros diário/semanal/mensal,
  detalhamento das evidências do índice.
- `web/src/features/dashboard/MonthlyAnalysis.jsx`: cruzamento bem-estar × faltas ×
  afastamentos, comparação com mês anterior, análise da IA simulada, plano de ação com
  edição de status.
- Totem (`web/src/features/totem/Totem.jsx`): sem mudança visual — apenas gera e envia
  a `idempotency_key` por tentativa de submit.

## 14. Testes

- Cálculo (índice, comparação, alertas, motor de análise): funções puras,
  `node:test` síncrono, sem banco — mesmo padrão já usado no projeto.
- Integração: contra Postgres via Docker Compose —
  concorrência (envios simultâneos não perdem incremento),
  idempotência (mesma chave não duplica),
  autorização (supervisor só vê setores vinculados),
  migrations (aplicam e revertem quando reversíveis).
- Migração SQLite→Postgres: teste de contagem/totais batendo entre origem e destino.

## 15. Fora do escopo (reafirmando o spec)

Identificação/autenticação de trabalhador, bloqueio de resposta repetida por pessoa,
diagnóstico médico/psicológico, IA generativa externa, notificações
WhatsApp/e-mail/SMS, integração com folha/ponto, execução automática de planos.

## 16. Decisões já tomadas nesta rodada de design

| Pendência do spec (seção 10) | Decisão |
| --- | --- |
| Hospedagem do Postgres no piloto | Docker local para dev/demo; `DATABASE_URL` genérico permite trocar para gerenciado depois sem mudar código |
| Amostra mínima | 5 respostas, configurável em `configuracoes_indicadores` |
| Efetivo esperado por setor/turno | Seed com valor demonstrativo, editável depois |
| Pesos do índice | Energia 30%, físico 20%, emocional 20%, faltas 15%, afastamentos 15%, configurável |
| Variações percentuais para alerta | Resolvido pelas 6 regras de gatilho do spec 2.4, lidas de `configuracoes_indicadores` |
| Supervisor edita status de plano/alerta | Sim — `PATCH` habilitado em ambos |
