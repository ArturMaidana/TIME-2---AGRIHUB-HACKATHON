# Arquitetura MVC

## Backend Node.js

O backend segue o fluxo, agora inteiramente assíncrono:

```text
HTTP → Routes → Middleware → Controllers → Services → Models → PostgreSQL
                             ↓                           ↓
                           Views                  src/domain (cálculo puro)
```

- `server/routes`: associa método e URL ao controlador (inclui duas rotas
  parametrizadas — `PATCH .../alertas/:id` e `.../planos-acao/:id` — resolvidas fora
  do `Map` em `handleApi`, já que o router não suporta path params).
- `server/middleware`: autenticação e autorização por papel.
- `server/controllers`: traduz HTTP em chamadas de negócio e respostas.
- `server/services`: orquestram modelos e, quando aplicável, funções puras de
  `src/domain`. `SupervisorAnalyticsService` concentra índice, comparação,
  participação, alertas, análises e planos de ação.
- `server/models`: consultas e comandos de persistência via `pg` (sem ORM).
- `server/views`: entrega do frontend compilado.
- `server/config`: pool de conexão Postgres (`database.js`), sessões e configuração
  de infraestrutura (`app-config.js`, lê `DATABASE_URL`/`DATABASE_SSL`).
- `server/database`: migrations SQL versionadas (`migrations/*.up.sql`/`*.down.sql`),
  runner (`migrate.js`), seed idempotente (`seed.js`), script de migração de dados a
  partir do SQLite legado (`migrate-from-sqlite.js`) e utilitários de operação
  (`status.js`, `rebuild.js`, `prepare.js`).
- `server/utils`: funções transversais sem regra de negócio.
- `src/domain`: cálculos puros e testáveis sem I/O — `indice-atencao.js`,
  `comparacao-temporal.js`, `alertas.js`, `analise-planos.js`. Cada serviço do
  backend chama essas funções e cuida apenas da persistência/orquestração ao redor.

O arquivo `server/index.js` aplica migrations e roda o seed antes de escutar o
`appConfig.port`. `server/app.js` escolhe entre as rotas da API e a view estática.

## Frontend React

O frontend é organizado por funcionalidades:

```text
web/src/
  api/          cliente HTTP
  app/          composição raiz
  components/   componentes compartilhados
  features/     autenticação, totem, dashboard e RH
  layout/       navegação e estrutura autenticada
  main.jsx      ponto de entrada
```

Componentes não acessam o banco. Toda comunicação passa pelo cliente HTTP e pelos
controladores do backend.

## Endpoints do MVP

| Método | Rota | Camada responsável |
| --- | --- | --- |
| `GET` | `/api/health` | HealthController |
| `POST` | `/api/auth` | AuthController → AuthService |
| `GET` | `/api/totem` | TotemController → TotemService |
| `POST` | `/api/totem/responses` | TotemController → TotemService |
| `GET` | `/api/meta` | MetaController → Models |
| `GET` | `/api/dashboard` | DashboardController → DashboardService |
| `POST` | `/api/hr` | HrController → HrService |
| `GET` | `/api/v1/supervisor/indices` | SupervisorController → SupervisorAnalyticsService |
| `GET` | `/api/v1/supervisor/comparativo` | SupervisorController → SupervisorAnalyticsService |
| `GET` | `/api/v1/supervisor/participacao` | SupervisorController → SupervisorAnalyticsService |
| `GET` | `/api/v1/supervisor/alertas` | SupervisorController → SupervisorAnalyticsService |
| `PATCH` | `/api/v1/supervisor/alertas/:id` | SupervisorController → SupervisorAnalyticsService |
| `GET` | `/api/v1/supervisor/analises` | SupervisorController → SupervisorAnalyticsService |
| `GET` | `/api/v1/supervisor/planos-acao` | SupervisorController → SupervisorAnalyticsService |
| `PATCH` | `/api/v1/supervisor/planos-acao/:id` | SupervisorController → SupervisorAnalyticsService |

As rotas protegidas passam pelo middleware `authorize`, que resolve a sessão no
servidor e impede que o perfil Totem acesse o dashboard ou os dados do RH. As rotas
`/api/v1/supervisor/*` são restritas ao papel `SUPERVISOR` e escopadas por unidade
(e por setor, quando o parâmetro `setor` é informado).

## Configuração

As variáveis aceitas estão documentadas em `.env.example` (`DATABASE_URL`,
`DATABASE_SSL`, `PORT`, `APP_TIMEZONE`). Valores ausentes usam padrões seguros para a
demonstração local (Postgres do `docker-compose.yml`). O banco é inicializado em três
etapas, executadas no boot do servidor (`server/index.js`) e antes da suíte de testes
(`pretest` → `server/database/prepare.js`):

- aplicação das migrations pendentes (`server/database/migrations/*.up.sql`),
  registrando a versão em `schema_migrations`;
- carga idempotente de dados demonstrativos (`seed.js`) para todos os setores,
  turnos, configuração do índice e headcount esperado;
- (fora do boot, sob demanda) importação de uma base SQLite legada via
  `server/database/migrate-from-sqlite.js`, com backup automático e validação de
  contagens/totais antes de considerar a migração concluída.

Os comandos `npm run db:status` e `npm run db:rebuild` permitem inspecionar ou
recriar a base local; `db:rebuild` trunca as tabelas em ordem de dependência,
reaplica as migrations e repopula o seed.
