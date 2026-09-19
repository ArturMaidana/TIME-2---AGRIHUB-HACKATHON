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
