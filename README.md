# AgriHub — Hackathon SESI Experience 2026

MVP para detectar precocemente sinais coletivos de desgaste físico e emocional em
frigoríficos, sempre de forma agregada por setor e turno e nunca por pessoa.

## Documentação

- [`SPEC.md`](./SPEC.md): especificação refinada e plano incremental do MVP.
- [`SPEC-ADICIONAL.md`](./SPEC-ADICIONAL.md): evolução analítica (índice de atenção,
  alertas, motor de análise) e migração para PostgreSQL.
- [`AGENT.md`](./AGENT.md): requisitos originais do desafio.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): organização MVC do backend e módulos React.
- [`docs/superpowers/specs/`](./docs/superpowers/specs/): design docs aprovados.
- [`docs/superpowers/plans/`](./docs/superpowers/plans/): planos de implementação.

## MVP funcional

O repositório contém um MVP demonstrável com:

- totem anônimo com três perguntas, turno automático e idempotência técnica;
- dashboard do supervisor com filtros, histórico, índice de atenção e alertas ativos;
- setores e turnos padronizados e pré-cadastrados;
- telas de indicadores por setor (ordenadas por nível de atenção) e análise mensal
  integrada com plano de ação editável;
- portal exclusivo do RH para faltas e afastamentos agregados;
- motor determinístico de análise semanal/mensal com evidências e correlações;
- backend Node.js assíncrono com persistência PostgreSQL.

## Executar

Requisito: Node.js 22 ou superior e Docker (para o PostgreSQL local).

```bash
npm run docker:db   # sobe o PostgreSQL local (docker-compose.yml)
npm install
npm run build
npm start
```

Abra `http://localhost:3001` e use uma das credenciais:

- Supervisor: `SUPERVISOR`
- RH: `RH2026`
- Totem: `TOTEM-01`

A saúde do backend pode ser verificada em `http://localhost:3001/api/health`.

## Banco de dados

O MVP usa PostgreSQL, com chaves estrangeiras, restrições de domínio e migrations
versionadas em `server/database/migrations/`. Na primeira execução, o banco recebe
**apenas cadastro mínimo**: 1 unidade, 10 setores, 3 turnos, 1 totem, supervisor e RH
demonstrativos, configuração do índice e headcount esperado (5 por setor/turno).
Nenhuma resposta de totem, indicador de RH, índice, alerta ou plano de ação é
pré-carregado — essas tabelas só recebem linhas a partir de uso real do sistema (ver
[design](./docs/superpowers/specs/2026-09-19-banco-minimo-fluxo-real-design.md)).

```bash
npm run db:migrate  # aplica as migrations pendentes
npm run db:status    # exibe a conexão utilizada e a quantidade de registros
npm run db:rebuild   # PROCEDIMENTO DE RESET: trunca tudo e recria só o cadastro mínimo
```

**`npm run db:rebuild` é o procedimento padrão de reset.** Sempre que for necessário
"limpar o banco" — voltar ao estado inicial, sem resposta nenhuma acumulada — é esse o
comando, sem precisar de nada além dele. É destrutivo: apaga toda resposta, alerta,
análise e plano de ação existentes antes de repopular o cadastro mínimo.

A conexão é definida por `DATABASE_URL`/`DATABASE_SSL`, conforme o `.env.example`
(padrão: Postgres local do `docker-compose.yml`, porta 5433 — deslocada de 5432 para
não colidir com uma instância local já existente).

Migração de uma base SQLite anterior (`data/agrihub.db`) para o Postgres:

```bash
node server/database/migrate-from-sqlite.js ./data/agrihub.db
```

Durante o desenvolvimento do frontend:

```bash
npm run dev
```

## Qualidade

```bash
npm test
npm run check
```

`npm test` roda `pretest` automaticamente (migra e popula o banco de desenvolvimento)
antes da suíte. Os testes cobrem cálculos de índice/comparação/alertas/análise (puros,
sem banco), migrations, concorrência e idempotência do totem, e autorização por
unidade/setor.
