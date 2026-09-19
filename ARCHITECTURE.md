# Arquitetura MVC

## Backend Node.js

O backend segue o fluxo:

```text
HTTP → Routes → Middleware → Controllers → Services → Models → SQLite
                             ↓
                           Views
```

- `server/routes`: associa método e URL ao controlador.
- `server/middleware`: autenticação e autorização por papel.
- `server/controllers`: traduz HTTP em chamadas de negócio e respostas.
- `server/services`: regras e orquestração dos casos de uso.
- `server/models`: consultas e comandos de persistência.
- `server/views`: entrega do frontend compilado.
- `server/config`: banco, sessões e configurações de infraestrutura.
- `server/database`: schema, migrações e dados demonstrativos.
- `server/utils`: funções transversais sem regra de negócio.

O arquivo `server/index.js` apenas inicia o servidor. `server/app.js` escolhe entre
as rotas da API e a view estática.

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

As rotas protegidas passam pelo middleware `authorize`, que resolve a sessão no
servidor e impede que o perfil Totem acesse o dashboard ou os dados do RH.

## Configuração

As variáveis aceitas estão documentadas em `.env.example`. Valores ausentes usam
padrões seguros para a demonstração local. O banco é inicializado em três etapas:

- criação do schema relacional, com chaves estrangeiras e restrições de domínio;
- registro da versão em `schema_migrations`;
- carga idempotente de dados demonstrativos para todos os setores e turnos.

Os comandos `npm run db:status` e `npm run db:rebuild` permitem inspecionar ou
recriar a base local; antes da recriação, o arquivo anterior é preservado como
`data/agrihub.db.backup`.
schema, migrações idempotentes e dados demonstrativos.
