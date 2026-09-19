# AgriHub — Hackathon SESI Experience 2026

MVP para detectar precocemente sinais coletivos de desgaste físico e emocional em
frigoríficos, sempre de forma agregada por setor e turno e nunca por pessoa.

## Documentação

- [`SPEC.md`](./SPEC.md): especificação refinada e plano incremental.
- [`AGENT.md`](./AGENT.md): requisitos originais do desafio.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md): organização MVC do backend e módulos React.

## MVP funcional

O repositório contém um MVP demonstrável com:

- totem anônimo com três perguntas e turno automático;
- dashboard do supervisor com filtros e histórico;
- setores e turnos padronizados e pré-cadastrados;
- telas de indicadores por setor e análise mensal integrada;
- portal do RH para horas extras, faltas e afastamentos agregados;
- análise semanal e mensal simulada por IA;
- backend Node.js com persistência SQLite.

## Executar

Requisito: Node.js 22 ou superior.

```bash
npm install
npm run build
npm start
```

Abra `http://localhost:3001` e use uma das credenciais:

- Supervisor: `SUPERVISOR`
- RH: `RH2026`
- Totem: `TOTEM-01`

A saúde do backend pode ser verificada em `http://localhost:3001/api/health`.

Durante o desenvolvimento do frontend:

```bash
npm run dev
```

## Qualidade

```bash
npm test
npm run check
```

Os testes existentes cobrem apenas a exploração inicial das regras de IDT e alertas;
eles serão revisados quando as decisões do novo recorte forem fechadas.
