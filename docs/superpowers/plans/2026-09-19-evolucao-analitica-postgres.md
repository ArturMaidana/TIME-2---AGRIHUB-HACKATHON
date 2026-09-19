# Evolução analítica e migração para PostgreSQL — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate AgriHub's backend from synchronous `node:sqlite` to async PostgreSQL, then build the sector attention index, temporal comparison, automatic alerts, and a deterministic weekly/monthly analysis-and-action-plan engine on top of it — per `SPEC-ADICIONAL.md` and the approved design at `docs/superpowers/specs/2026-09-19-evolucao-analitica-postgres-design.md`.

**Architecture:** Thin `Controller → Service → Model` pipeline (unchanged shape, now `async`) backed by `pg` with a connection pool. Pure, unit-testable calculation logic lives in `src/domain/*.js` (no I/O); services own persistence and orchestration. New tables are computed/cached snapshots (`indices_setor`) plus rule-driven records (`alertas`, `analises_periodicas`, `planos_acao`).

**Tech Stack:** Node.js 22, `pg` (node-postgres) with `Pool`, hand-rolled SQL-file migrations (no ORM/migration framework), Docker Compose (`postgres:16-alpine`) for local/test Postgres, `node:test` (existing convention), React/Vite frontend (unchanged tooling).

## Global Constraints

- PostgreSQL is the only supported database after this work lands; SQLite remains only as a migration source (`SPEC-ADICIONAL.md` §4.1).
- No column anywhere may link a wellbeing response to a person (`AGENT.md` §1, `SPEC.md` §4).
- Timestamps stored in UTC; unit's timezone (`America/Cuiaba` by default) applied only at presentation (`SPEC-ADICIONAL.md` §4.2).
- Composite indexes on `(unidade, setor, turno, período)` for every time-series table (`SPEC-ADICIONAL.md` §4.2).
- Every DB write that increments shared counters must be atomic; a retried technical request must never duplicate a counter (`SPEC-ADICIONAL.md` §3, §7 acceptance criteria).
- Weights, thresholds, minimum sample size and reliability bands live in `configuracoes_indicadores`, not in code (`SPEC-ADICIONAL.md` §2.1, §2.3).
- The index is never presented as conclusive below the minimum sample; the reliability level is reported separately from the score (`SPEC-ADICIONAL.md` §2.3).
- The analysis engine's output contract must stay stable so a future real AI engine can replace it without a frontend change (`SPEC-ADICIONAL.md` §2.5).
- All new `/api/v1/supervisor/*` routes are scoped to the caller's unit and assigned sectors; RH keeps no access to them (`SPEC-ADICIONAL.md` §6).
- **Session-specific:** do not run `git commit` for this work until the user has seen it running in the browser and explicitly approves — hold all commit steps below until that checkpoint, regardless of the per-task "Commit" steps written for the historical record of this plan.

---

## Task 1: PostgreSQL infrastructure (Docker, driver, migration runner)

**Files:**
- Create: `docker-compose.yml`
- Create: `server/database/migrations/001_baseline.up.sql`
- Create: `server/database/migrations/001_baseline.down.sql`
- Create: `server/database/migrate.js`
- Test: `test/migrate.test.js`
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `server/config/app-config.js`

**Interfaces:**
- Produces: `runMigrations(pool?)`, `rollbackLastMigration(pool?)` from `server/database/migrate.js` — both accept an optional `pg.Pool` (default: the app's shared pool from `server/config/database.js`, added in Task 2) so tests can point them at a throwaway database.
- Produces: `appConfig.databaseUrl` (string), `appConfig.databaseSsl` (boolean) from `server/config/app-config.js`.

- [ ] **Step 1: Add `docker-compose.yml` for local Postgres**

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: agrihub
      POSTGRES_PASSWORD: agrihub
      POSTGRES_DB: agrihub
    ports:
      - "5433:5432"  # host port 5433, not 5432 — this machine already has a local
                      # Postgres bound to :5432/::5432, discovered during execution;
                      # 5433 avoids fighting it. Adjust if your machine is different.
    volumes:
      - agrihub-pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U agrihub"]
      interval: 2s
      timeout: 3s
      retries: 10

volumes:
  agrihub-pg-data:
```

- [ ] **Step 2: Start it and confirm it's healthy**

Run: `docker compose up -d db && docker compose ps`
Expected: `db` service shows `healthy` (may take a few seconds — re-run `docker compose ps` if still `starting`).

- [ ] **Step 3: Update `.env.example`**

```text
PORT=3001
APP_TIMEZONE=America/Cuiaba
DATABASE_URL=postgresql://agrihub:agrihub@localhost:5433/agrihub
DATABASE_SSL=false
```

- [ ] **Step 4: Update `server/config/app-config.js`**

```javascript
export const appConfig = Object.freeze({
  port: Number(process.env.PORT || 3001),
  timezone: process.env.APP_TIMEZONE || 'America/Cuiaba',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://agrihub:agrihub@localhost:5433/agrihub',
  databaseSsl: process.env.DATABASE_SSL === 'true',
});
```

- [ ] **Step 5: Add the `pg` dependency and npm scripts**

Edit `package.json`: add `"pg": "latest"` to `dependencies`, and update `scripts`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "node server/index.js",
    "docker:db": "docker compose up -d db",
    "db:migrate": "node server/database/migrate.js",
    "db:status": "node server/database/status.js",
    "db:rebuild": "node server/database/rebuild.js",
    "pretest": "node server/database/prepare.js",
    "test": "node --test --test-concurrency=1",
    "check": "find server src -type f -name '*.js' -exec node --check {} \\;"
  }
}
```

Run: `npm install`
Expected: `pg` added to `node_modules` and `package-lock.json`.

- [ ] **Step 6: Write the baseline migration (ports the existing 7 tables to Postgres)**

`server/database/migrations/001_baseline.up.sql`:

```sql
CREATE TABLE units(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL
);

CREATE TABLE users(
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('SUPERVISOR','RH')),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL
);

CREATE TABLE sectors(
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'FRIA' CHECK(category IN ('QUENTE','FRIA')),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(unit_id, name)
);

CREATE TABLE user_sectors(
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, sector_id)
);

CREATE TABLE shifts(
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  UNIQUE(unit_id, name)
);

CREATE TABLE totens(
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  credential TEXT UNIQUE NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
);

CREATE TABLE responses(
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  response_date TEXT NOT NULL CHECK(response_date ~ '^\d{4}-\d{2}-\d{2}$'),
  metric TEXT NOT NULL CHECK(metric IN ('ENERGY','PHYSICAL','STRESS')),
  score INTEGER NOT NULL CHECK(score BETWEEN 1 AND 5),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  UNIQUE(unit_id, sector_id, shift_id, response_date, metric, score)
);

CREATE TABLE hr_indicators(
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  sector_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  shift_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK(period ~ '^\d{4}-\d{2}-\d{2}$'),
  absences INTEGER NOT NULL CHECK(absences >= 0),
  leaves INTEGER NOT NULL CHECK(leaves >= 0),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_responses_scope ON responses(unit_id, sector_id, shift_id, response_date);
CREATE INDEX idx_hr_scope ON hr_indicators(unit_id, sector_id, shift_id, period);
```

`server/database/migrations/001_baseline.down.sql`:

```sql
DROP TABLE IF EXISTS hr_indicators;
DROP TABLE IF EXISTS responses;
DROP TABLE IF EXISTS totens;
DROP TABLE IF EXISTS shifts;
DROP TABLE IF EXISTS user_sectors;
DROP TABLE IF EXISTS sectors;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS units;
```

> Note: `response_date`/`period` stay `TEXT` (not `DATE`) on purpose — `pg` deserializes `DATE` columns into JS `Date` objects, which would silently change every date string the app already treats as `'YYYY-MM-DD'` (chart series keys, `dateKey()` comparisons). Keeping them `TEXT` with a format `CHECK` preserves today's exact string semantics while still enforcing a domain restriction.

- [ ] **Step 7: Write the migration runner**

`server/database/migrate.js`:

```javascript
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { appConfig } from '../config/app-config.js';

const { Pool } = pg;
const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations');

let defaultPool;
function sharedPool() {
  defaultPool ??= new Pool({
    connectionString: appConfig.databaseUrl,
    ssl: appConfig.databaseSsl ? { rejectUnauthorized: false } : false,
  });
  return defaultPool;
}

function migrationFiles() {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.up.sql'))
    .sort();
}

export async function runMigrations(pool = sharedPool()) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations(
      version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL
    )
  `);
  const applied = new Set(
    (await pool.query('SELECT version FROM schema_migrations')).rows.map((row) => row.version),
  );
  for (const file of migrationFiles()) {
    const version = Number(file.slice(0, 3));
    if (applied.has(version)) continue;
    const sql = readFileSync(resolve(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES($1, $2, $3)',
        [version, file, new Date().toISOString()],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export async function rollbackLastMigration(pool = sharedPool()) {
  const last = await pool.query('SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT 1');
  if (last.rows.length === 0) return null;
  const { version, name } = last.rows[0];
  const sql = readFileSync(resolve(migrationsDir, name.replace('.up.sql', '.down.sql')), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('DELETE FROM schema_migrations WHERE version = $1', [version]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return { version, name };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => { console.log('Migrations aplicadas.'); return sharedPool().end(); })
    .catch((error) => { console.error(error); process.exit(1); });
}
```

- [ ] **Step 8: Write the failing test for the runner (against a throwaway database)**

`test/migrate.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { runMigrations, rollbackLastMigration } from '../server/database/migrate.js';
import { appConfig } from '../server/config/app-config.js';

const { Pool } = pg;

async function withThrowawayDatabase(run) {
  const adminPool = new Pool({ connectionString: appConfig.databaseUrl });
  const name = `agrihub_test_migrate_${Date.now()}`;
  await adminPool.query(`CREATE DATABASE ${name}`);
  const testPool = new Pool({ connectionString: appConfig.databaseUrl.replace(/\/[^/]+$/, `/${name}`) });
  try {
    await run(testPool);
  } finally {
    await testPool.end();
    await adminPool.query(`DROP DATABASE ${name}`);
    await adminPool.end();
  }
}

test('aplica a migration base e registra a versão', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)).rows.map((row) => row.table_name);
    assert.ok(tables.includes('units'));
    assert.ok(tables.includes('responses'));
    const versions = (await pool.query('SELECT version FROM schema_migrations')).rows;
    assert.deepEqual(versions, [{ version: 1 }]);
  });
});

test('roda a migration duas vezes sem erro (idempotente)', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    await runMigrations(pool);
    const versions = (await pool.query('SELECT version FROM schema_migrations')).rows;
    assert.equal(versions.length, 1);
  });
});

test('reverte a última migration', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const result = await rollbackLastMigration(pool);
    assert.equal(result.version, 1);
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)).rows.map((row) => row.table_name);
    assert.ok(!tables.includes('units'));
  });
});
```

- [ ] **Step 9: Run it**

Run: `node --test test/migrate.test.js`
Expected: PASS (3 tests). Requires `docker compose up -d db` from Step 2 to already be running.

**Do not commit yet** — per the session instruction, commits for this whole plan are held until the app is demoed running in the browser (see the note at the end of the plan).

---

## Task 2: Full async + PostgreSQL cutover (models, services, controllers)

This is the big structural task: every DB-touching function becomes `async`. It's done as one task because the app cannot run correctly half-converted — a service calling an already-async model without `await` would silently receive a `Promise` instead of data.

**Files:**
- Create: `server/config/database.js` (rewrite; replaces the `node:sqlite`-based version)
- Delete: `server/database/schema.js` (superseded by `migrations/001_baseline.up.sql`)
- Delete: `server/database/migrations.js` (the old ad-hoc `ALTER TABLE` script — its `STANDARD_SECTORS` constant moves into `seed.js` in Task 3)
- Modify: `server/models/auth-model.js`
- Modify: `server/models/sector-model.js`
- Modify: `server/models/shift-model.js`
- Modify: `server/models/response-model.js`
- Modify: `server/models/hr-indicator-model.js`
- Modify: `server/services/auth-service.js`
- Modify: `server/services/totem-service.js`
- Modify: `server/services/dashboard-service.js`
- Modify: `server/services/hr-service.js`
- Modify: `server/controllers/auth-controller.js`
- Modify: `server/controllers/dashboard-controller.js`
- Modify: `server/controllers/hr-controller.js`
- Modify: `server/controllers/meta-controller.js`
- Modify: `server/controllers/totem-controller.js`
- Modify: `test/mvc-services.test.js`
- Modify: `test/validation.test.js`
- Modify: `test/database.test.js`

**Interfaces:**
- Consumes: nothing new from Task 1 besides `appConfig.databaseUrl`/`databaseSsl`.
- Produces: `pool`, `queryAll(text, params)`, `queryOne(text, params)`, `execute(text, params)`, `withTransaction(callback)` from `server/config/database.js` — every model in the codebase from now on is built on these.

- [ ] **Step 1: Rewrite `server/config/database.js`**

```javascript
import pg from 'pg';
import { appConfig } from './app-config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: appConfig.databaseUrl,
  ssl: appConfig.databaseSsl ? { rejectUnauthorized: false } : false,
});

export async function queryAll(text, params = []) {
  const result = await pool.query(text, params);
  return result.rows;
}

export async function queryOne(text, params = []) {
  const rows = await queryAll(text, params);
  return rows[0] ?? null;
}

export async function execute(text, params = []) {
  const result = await pool.query(text, params);
  return result.rowCount;
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

- [ ] **Step 2: Delete the two now-superseded SQLite-era files**

Run: `rm server/database/schema.js server/database/migrations.js`

- [ ] **Step 3: Rewrite the small models (`auth-model.js`, `sector-model.js`, `shift-model.js`)**

`server/models/auth-model.js`:

```javascript
import { queryOne } from '../config/database.js';

export const AuthModel = {
  findUserByCode(code) {
    return queryOne('SELECT * FROM users WHERE code = $1', [code]);
  },

  findActiveTotemByCredential(credential) {
    return queryOne('SELECT * FROM totens WHERE credential = $1 AND active = 1', [credential]);
  },
};
```

`server/models/sector-model.js`:

```javascript
import { queryAll, queryOne } from '../config/database.js';

export const SectorModel = {
  listActiveByUnit(unitId) {
    return queryAll(`
      SELECT id, name, category
      FROM sectors
      WHERE unit_id = $1 AND active = 1
      ORDER BY category DESC, name
    `, [unitId]);
  },

  listByUnit(unitId) {
    return queryAll(`
      SELECT id, name, category
      FROM sectors
      WHERE unit_id = $1
      ORDER BY category DESC, name
    `, [unitId]);
  },

  findActiveInUnit(id, unitId) {
    return queryOne(`
      SELECT id FROM sectors WHERE id = $1 AND unit_id = $2 AND active = 1
    `, [id, unitId]);
  },
};
```

`server/models/shift-model.js`:

```javascript
import { queryAll, queryOne } from '../config/database.js';

export const ShiftModel = {
  listByUnit(unitId) {
    return queryAll(`
      SELECT id, name, start_time AS "startTime", end_time AS "endTime"
      FROM shifts WHERE unit_id = $1 ORDER BY start_time
    `, [unitId]);
  },

  listRawByUnit(unitId) {
    return queryAll(`
      SELECT id, name, start_time, end_time
      FROM shifts WHERE unit_id = $1
    `, [unitId]);
  },

  findInUnit(id, unitId) {
    return queryOne('SELECT id FROM shifts WHERE id = $1 AND unit_id = $2', [id, unitId]);
  },
};
```

- [ ] **Step 4: Rewrite `response-model.js` (the atomic-increment model)**

```javascript
import { randomUUID } from 'node:crypto';
import { pool, queryAll } from '../config/database.js';

export const ResponseModel = {
  async incrementAnswers({ unitId, sectorId, shiftId, date, answers }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [metric, score] of Object.entries(answers)) {
        await client.query(`
          INSERT INTO responses VALUES($1, $2, $3, $4, $5, $6, $7, 1)
          ON CONFLICT (unit_id, sector_id, shift_id, response_date, metric, score)
          DO UPDATE SET quantity = responses.quantity + 1
        `, [randomUUID(), unitId, sectorId, shiftId, date, metric, score]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  getSeries({ unitId, sectorId, days }) {
    const scoped = sectorId && sectorId !== 'all';
    return queryAll(`
      SELECT response_date AS date, metric,
        ROUND(SUM(score * quantity)::numeric / SUM(quantity), 2) AS average,
        SUM(quantity) AS responses
      FROM responses
      WHERE unit_id = $1 AND response_date >= to_char(CURRENT_DATE - $2::int, 'YYYY-MM-DD')
        ${scoped ? 'AND sector_id = $3' : ''}
      GROUP BY response_date, metric
      ORDER BY response_date
    `, scoped ? [unitId, days - 1, sectorId] : [unitId, days - 1]);
  },

  getTodayBySector(unitId) {
    return queryAll(`
      SELECT s.id, s.name, r.metric,
        ROUND(SUM(r.score * r.quantity)::numeric / NULLIF(SUM(r.quantity), 0), 2) AS average,
        SUM(r.quantity) AS responses
      FROM sectors s
      LEFT JOIN responses r ON r.sector_id = s.id AND r.response_date = to_char(CURRENT_DATE, 'YYYY-MM-DD')
      WHERE s.unit_id = $1
      GROUP BY s.id, r.metric
      ORDER BY s.name
    `, [unitId]);
  },

  getMonthlyBySector(unitId) {
    return queryAll(`
      SELECT s.id, s.name, s.category, r.metric,
        ROUND(SUM(r.score * r.quantity)::numeric / NULLIF(SUM(r.quantity), 0), 2) AS average,
        SUM(r.quantity) AS responses
      FROM sectors s
      LEFT JOIN responses r ON r.sector_id = s.id
        AND r.response_date >= to_char(CURRENT_DATE - 29, 'YYYY-MM-DD')
      WHERE s.unit_id = $1
      GROUP BY s.id, s.name, s.category, r.metric
      ORDER BY s.category DESC, s.name
    `, [unitId]);
  },
};
```

- [ ] **Step 5: Rewrite `hr-indicator-model.js`**

```javascript
import { randomUUID } from 'node:crypto';
import { queryAll, execute } from '../config/database.js';

export const HrIndicatorModel = {
  listRecent({ unitId, sectorId, limit = 20 }) {
    const scoped = sectorId && sectorId !== 'all';
    const params = scoped ? [unitId, sectorId, limit] : [unitId, limit];
    return queryAll(`
      SELECT h.*, s.name AS sector, sh.name AS shift
      FROM hr_indicators h
      JOIN sectors s ON s.id = h.sector_id
      JOIN shifts sh ON sh.id = h.shift_id
      WHERE h.unit_id = $1 ${scoped ? 'AND h.sector_id = $2' : ''}
      ORDER BY period DESC
      LIMIT ${scoped ? '$3' : '$2'}
    `, params);
  },

  create({ unitId, sectorId, shiftId, period, absences, leaves }) {
    return execute(`
      INSERT INTO hr_indicators(id, unit_id, sector_id, shift_id, period, absences, leaves, created_at)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      randomUUID(), unitId, sectorId, shiftId, period,
      Number(absences), Number(leaves), new Date().toISOString(),
    ]);
  },
};
```

- [ ] **Step 6: Make the services `async` and `await` their model calls**

`server/services/auth-service.js`:

```javascript
import { AuthModel } from '../models/auth-model.js';
import { createSession } from '../config/session-store.js';

export const AuthService = {
  async authenticate({ type, code }) {
    if (type === 'TOTEM') {
      const totem = await AuthModel.findActiveTotemByCredential(code);
      if (!totem) return null;
      return {
        token: createSession({ role: 'TOTEM', unitId: totem.unit_id }),
        role: 'TOTEM',
        name: totem.name,
      };
    }

    const user = await AuthModel.findUserByCode(code);
    if (!user) return null;
    return {
      token: createSession({ role: user.role, unitId: user.unit_id, userId: user.id }),
      role: user.role,
      name: user.name,
    };
  },
};
```

`server/services/totem-service.js`:

```javascript
import { dateKey } from '../utils/date.js';
import { ResponseModel } from '../models/response-model.js';
import { SectorModel } from '../models/sector-model.js';
import { ShiftModel } from '../models/shift-model.js';
import { appConfig } from '../config/app-config.js';

const METRICS = ['ENERGY', 'PHYSICAL', 'STRESS'];

async function findCurrentShift(unitId, now = new Date()) {
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: appConfig.timezone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(now);
  const shifts = await ShiftModel.listRawByUnit(unitId);
  return shifts.find((shift) => shift.start_time < shift.end_time
    ? time >= shift.start_time && time < shift.end_time
    : time >= shift.start_time || time < shift.end_time) ?? shifts[0];
}

export const TotemService = {
  async getContext(unitId) {
    const [sectors, shift] = await Promise.all([
      SectorModel.listActiveByUnit(unitId),
      findCurrentShift(unitId),
    ]);
    return { sectors, shift, date: dateKey() };
  },

  async record(unitId, { sectorId, answers }) {
    const validAnswers = answers && METRICS.every((metric) =>
      Number.isInteger(answers[metric]) && answers[metric] >= 1 && answers[metric] <= 5);
    if (!sectorId || !validAnswers) return { ok: false, error: 'Responda as três perguntas' };
    if (!(await SectorModel.findActiveInUnit(sectorId, unitId))) {
      return { ok: false, error: 'Setor inválido' };
    }
    const shift = await findCurrentShift(unitId);
    await ResponseModel.incrementAnswers({
      unitId, sectorId, shiftId: shift.id, date: dateKey(), answers,
    });
    return { ok: true };
  },
};
```

`server/services/dashboard-service.js` (keep `simulatedAnalysis` for now — it's replaced by the real engine in Task 10):

```javascript
import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { ResponseModel } from '../models/response-model.js';

const simulatedAnalysis = {
  attention: 'MODERADA',
  title: 'Sinais físicos pedem atenção nesta semana',
  summary: 'A IA identificou aumento simultâneo de dor, cansaço e faltas no período. Os dados sugerem uma associação operacional que merece acompanhamento, sem indicar causalidade individual.',
  actions: [
    'Reforçar pausas e alternância das tarefas críticas',
    'Realizar escuta coletiva no início do próximo turno',
    'Acompanhar faltas e afastamentos na próxima semana',
  ],
  monthly: 'No consolidado mensal, a energia permaneceu estável, mas o indicador físico caiu 8%. O aumento de faltas no mesmo período reforça a necessidade de acompanhamento preventivo.',
};

export const DashboardService = {
  async get({ unitId, sectorId, days = 30 }) {
    const [series, latest, sectorSummary, hr] = await Promise.all([
      ResponseModel.getSeries({ unitId, sectorId, days }),
      ResponseModel.getTodayBySector(unitId),
      ResponseModel.getMonthlyBySector(unitId),
      HrIndicatorModel.listRecent({ unitId, sectorId }),
    ]);
    return { series, latest, sectorSummary, hr, analysis: simulatedAnalysis };
  },
};
```

`server/services/hr-service.js`:

```javascript
import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { SectorModel } from '../models/sector-model.js';
import { ShiftModel } from '../models/shift-model.js';
import { isIsoDate, isNonNegativeInteger } from '../utils/validation.js';

export const HrService = {
  async create(unitId, payload) {
    if (!(await SectorModel.findActiveInUnit(payload.sectorId, unitId))) {
      return { ok: false, error: 'Setor inválido' };
    }
    if (!(await ShiftModel.findInUnit(payload.shiftId, unitId))) {
      return { ok: false, error: 'Turno inválido' };
    }
    if (!isIsoDate(payload.period)) {
      return { ok: false, error: 'Período inválido' };
    }
    if (!isNonNegativeInteger(payload.absences) || !isNonNegativeInteger(payload.leaves)) {
      return { ok: false, error: 'Faltas e afastamentos devem ser inteiros não negativos' };
    }
    await HrIndicatorModel.create({ unitId, ...payload });
    return { ok: true };
  },
};
```

- [ ] **Step 7: `await` the service calls in controllers**

`server/controllers/auth-controller.js`:

```javascript
import { AuthService } from '../services/auth-service.js';
import { json, parseBody } from '../utils/http.js';

export async function login(request, response) {
  const result = await AuthService.authenticate(await parseBody(request));
  return result ? json(response, 200, result) : json(response, 401, { error: 'Código inválido' });
}
```

`server/controllers/dashboard-controller.js`:

```javascript
import { DashboardService } from '../services/dashboard-service.js';
import { json } from '../utils/http.js';

export async function getDashboard(_request, response, { session, url }) {
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 7), 90);
  json(response, 200, await DashboardService.get({
    unitId: session.unitId,
    sectorId: url.searchParams.get('sector'),
    days,
  }));
}
```

`server/controllers/hr-controller.js`:

```javascript
import { HrService } from '../services/hr-service.js';
import { json, parseBody } from '../utils/http.js';

export async function createIndicator(request, response, { session }) {
  const result = await HrService.create(session.unitId, await parseBody(request));
  json(response, result.ok ? 201 : 422, result);
}
```

`server/controllers/meta-controller.js`:

```javascript
import { SectorModel } from '../models/sector-model.js';
import { ShiftModel } from '../models/shift-model.js';
import { json } from '../utils/http.js';

export async function getMeta(_request, response, { session }) {
  const [sectors, shifts] = await Promise.all([
    SectorModel.listByUnit(session.unitId),
    ShiftModel.listByUnit(session.unitId),
  ]);
  json(response, 200, { sectors, shifts });
}
```

`server/controllers/totem-controller.js`:

```javascript
import { TotemService } from '../services/totem-service.js';
import { json, parseBody } from '../utils/http.js';

export async function getContext(_request, response, { session }) {
  json(response, 200, await TotemService.getContext(session.unitId));
}

export async function recordResponses(request, response, { session }) {
  const result = await TotemService.record(session.unitId, await parseBody(request));
  json(response, result.ok ? 201 : 422, result);
}
```

`server/routes/api-routes.js` needs no changes — `authorize()` already forwards the controller's return value and `asyncController` already `await`s it, so a controller becoming `async` is transparent to both.

- [ ] **Step 8: Update the existing tests to `await`**

`test/mvc-services.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../server/services/auth-service.js';
import { DashboardService } from '../server/services/dashboard-service.js';
import { TotemService } from '../server/services/totem-service.js';

test('serviço de autenticação separa supervisor e totem', async () => {
  assert.equal((await AuthService.authenticate({ type: 'SUPERVISOR', code: 'SUPERVISOR' })).role, 'SUPERVISOR');
  assert.equal((await AuthService.authenticate({ type: 'TOTEM', code: 'TOTEM-01' })).role, 'TOTEM');
  assert.equal(await AuthService.authenticate({ type: 'SUPERVISOR', code: 'invalido' }), null);
});

test('serviço do totem retorna setores padronizados e turno automático', async () => {
  const context = await TotemService.getContext('u1');
  assert.equal(context.sectors.length, 10);
  assert.ok(context.shift.id);
  assert.deepEqual(new Set(context.sectors.map((sector) => sector.category)), new Set(['QUENTE', 'FRIA']));
});

test('serviço do dashboard entrega as três camadas de análise', async () => {
  const dashboard = await DashboardService.get({ unitId: 'u1', days: 30 });
  assert.ok(dashboard.series.length > 0);
  assert.equal(new Set(dashboard.sectorSummary.map((row) => row.id)).size, 10);
  assert.ok(dashboard.analysis.actions.length > 0);
});
```

`test/validation.test.js` — only the last test touches a service; make it `async`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { isIsoDate, isNonNegativeInteger } from '../server/utils/validation.js';
import { HrService } from '../server/services/hr-service.js';

test('valida datas ISO usadas nos períodos do RH', () => {
  assert.equal(isIsoDate('2026-09-19'), true);
  assert.equal(isIsoDate('19/09/2026'), false);
  assert.equal(isIsoDate(''), false);
});

test('aceita somente contagens inteiras não negativas', () => {
  assert.equal(isNonNegativeInteger(0), true);
  assert.equal(isNonNegativeInteger('12'), true);
  assert.equal(isNonNegativeInteger(-1), false);
  assert.equal(isNonNegativeInteger(1.5), false);
});

test('rejeita indicador do RH fora do escopo da unidade', async () => {
  assert.deepEqual(await HrService.create('u1', {
    sectorId: 'setor-inexistente', shiftId: 't1', period: '2026-09-19',
    absences: 1, leaves: 0,
  }), { ok: false, error: 'Setor inválido' });
});
```

`test/database.test.js` — rewritten against Postgres, using a `BEGIN`/`ROLLBACK` transaction so constraint checks never pollute the shared dev database:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../server/config/database.js';

async function withRollback(run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await run(client);
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}

test('banco rejeita setor sem unidade relacionada', async () => {
  await withRollback(async (client) => {
    await assert.rejects(() => client.query(
      'INSERT INTO sectors(id, unit_id, name, category) VALUES($1, $2, $3, $4)',
      ['s-teste-fk', 'unidade-inexistente', 'Setor teste', 'FRIA'],
    ));
  });
});

test('banco valida categoria do setor', async () => {
  await withRollback(async (client) => {
    await assert.rejects(() => client.query(
      'INSERT INTO sectors(id, unit_id, name, category) VALUES($1, $2, $3, $4)',
      ['s-teste-categoria', 'u1', 'Setor teste', 'INVALIDA'],
    ));
  });
});
```

- [ ] **Step 9: Run migrations against the dev database, then run the whole suite**

Run: `npm run db:migrate && npm test`
Expected: all tests PASS. (`npm test`'s `pretest` hook isn't wired up until Task 3 — for this step, running `db:migrate` by hand first is enough since `test/mvc-services.test.js` needs seeded `u1` data, which won't exist yet. If those 3 tests fail with "not found" errors here, that's expected and gets fixed by Task 3's seed script — proceed to Task 3 immediately after confirming `migrate.test.js` and `database.test.js` pass.)

---

## Task 3: Seed, `db:status`, `db:rebuild`, and app boot wired to Postgres

**Files:**
- Create: `server/database/prepare.js`
- Modify: `server/database/seed.js` (rewrite for Postgres/async; absorbs `STANDARD_SECTORS` from the deleted `migrations.js`)
- Modify: `server/database/status.js`
- Modify: `server/database/rebuild.js`
- Modify: `server/index.js`

**Interfaces:**
- Consumes: `runMigrations` from Task 1, `pool`/`queryOne`/`execute` from Task 2.
- Produces: `seedDatabase()` (async), `STANDARD_SECTORS` (array) from `server/database/seed.js` — both are imported by later tasks (indices/analytics seeding in Task 6, tests throughout).

- [ ] **Step 1: Rewrite `server/database/seed.js`**

```javascript
import { randomUUID } from 'node:crypto';
import { queryOne, execute } from '../config/database.js';

export const STANDARD_SECTORS = [
  ['s1', 'Desossa', 'FRIA'], ['s2', 'Embalagem secundária', 'FRIA'],
  ['s3', 'Abate primeira fase', 'QUENTE'], ['s4', 'Expedição caixaria', 'FRIA'],
  ['s5', 'Abate segunda fase', 'QUENTE'], ['s6', 'Miúdos', 'QUENTE'],
  ['s7', 'Bucharia limpa', 'QUENTE'], ['s8', 'Bucharia suja', 'QUENTE'],
  ['s9', 'Gracharia', 'QUENTE'], ['s10', 'Expedição com osso', 'FRIA'],
];

const SHIFTS = [
  ['t1', 'Manhã', '06:00', '14:20'], ['t2', 'Tarde', '14:20', '22:35'],
  ['t3', 'Noite', '22:35', '06:00'],
];

async function seedResponses(sectorStart = 0) {
  const today = new Date();
  for (let day = 34; day >= 0; day -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - day);
    if ([0, 6].includes(date.getDay())) continue;
    const dateKey = date.toISOString().slice(0, 10);
    for (let index = sectorStart; index < STANDARD_SECTORS.length; index += 1) {
      for (const metric of ['ENERGY', 'PHYSICAL', 'STRESS']) {
        const base = metric === 'ENERGY' ? 3.9 - index * 0.07 : 2 + index * 0.08;
        for (let score = 1; score <= 5; score += 1) {
          const quantity = Math.max(0, Math.round(8 - Math.abs(score - (base + Math.sin(day / 4) * 0.25)) * 3));
          if (!quantity) continue;
          await execute(`
            INSERT INTO responses(id, unit_id, sector_id, shift_id, response_date, metric, score, quantity)
            VALUES($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (unit_id, sector_id, shift_id, response_date, metric, score) DO NOTHING
          `, [randomUUID(), 'u1', STANDARD_SECTORS[index][0], SHIFTS[day % 2][0], dateKey, metric, score, quantity]);
        }
      }
    }
  }
}

export async function seedDatabase() {
  const existing = await queryOne('SELECT id FROM units LIMIT 1');
  if (!existing) {
    await execute('INSERT INTO units VALUES($1, $2, $3)', ['u1', 'Frigorífico Vale Verde', 'America/Cuiaba']);
    await execute('INSERT INTO users VALUES($1, $2, $3, $4, $5)', ['sup1', 'u1', 'SUPERVISOR', 'Marina Alves', 'SUPERVISOR']);
    await execute('INSERT INTO users VALUES($1, $2, $3, $4, $5)', ['rh1', 'u1', 'RH', 'Equipe de RH', 'RH2026']);
    for (const [id, name, category] of STANDARD_SECTORS) {
      await execute('INSERT INTO sectors(id, unit_id, name, category) VALUES($1, $2, $3, $4)', [id, 'u1', name, category]);
      await execute('INSERT INTO user_sectors VALUES($1, $2)', ['sup1', id]);
    }
    for (const shift of SHIFTS) {
      await execute('INSERT INTO shifts VALUES($1, $2, $3, $4, $5)', [shift[0], 'u1', shift[1], shift[2], shift[3]]);
    }
    await execute('INSERT INTO totens VALUES($1, $2, $3, $4, 1)', ['tot1', 'u1', 'Entrada principal', 'TOTEM-01']);
    await seedResponses();
    const today = new Date();
    for (let week = 4; week >= 0; week -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - week * 7);
      for (let index = 0; index < STANDARD_SECTORS.length; index += 1) {
        await execute(`
          INSERT INTO hr_indicators(id, unit_id, sector_id, shift_id, period, absences, leaves, created_at)
          VALUES($1, $2, $3, $4, $5, $6, $7, $8)
        `, [randomUUID(), 'u1', STANDARD_SECTORS[index][0], 't1', date.toISOString().slice(0, 10), 2 + index, index % 3, new Date().toISOString()]);
      }
    }
  } else {
    const count = await queryOne("SELECT COUNT(*)::int AS total FROM responses WHERE sector_id = 's5'");
    if (count.total === 0) await seedResponses(4);
  }
}
```

- [ ] **Step 2: Write `server/database/prepare.js` (migrate + seed, used as `pretest` and available for manual runs)**

```javascript
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';

await runMigrations();
await seedDatabase();
console.log('Banco migrado e populado.');
process.exit(0);
```

- [ ] **Step 3: Rewrite `server/database/status.js`**

```javascript
import { pool } from '../config/database.js';
import { appConfig } from '../config/app-config.js';

const TABLES = ['units', 'users', 'sectors', 'shifts', 'totens', 'responses', 'hr_indicators'];

async function main() {
  const counts = {};
  for (const table of TABLES) {
    counts[table] = (await pool.query(`SELECT COUNT(*)::int AS total FROM ${table}`)).rows[0].total;
  }
  console.log(JSON.stringify({ database: appConfig.databaseUrl, counts }, null, 2));
  await pool.end();
}

main();
```

- [ ] **Step 4: Rewrite `server/database/rebuild.js`**

```javascript
import { pool } from '../config/database.js';
import { runMigrations } from './migrate.js';
import { seedDatabase } from './seed.js';

const TABLES_IN_DEPENDENCY_ORDER = [
  'hr_indicators', 'responses', 'totens', 'user_sectors', 'sectors', 'shifts', 'users', 'units',
];

async function main() {
  for (const table of TABLES_IN_DEPENDENCY_ORDER) {
    await pool.query(`TRUNCATE TABLE ${table} CASCADE`).catch(() => {});
  }
  await runMigrations();
  await seedDatabase();
  console.log('Banco recriado e populado no PostgreSQL.');
  await pool.end();
}

main();
```

- [ ] **Step 5: Wire app startup to run migrations + seed before listening**

`server/index.js`:

```javascript
import { createServer } from 'node:http';
import { app } from './app.js';
import { appConfig } from './config/app-config.js';
import { runMigrations } from './database/migrate.js';
import { seedDatabase } from './database/seed.js';

async function start() {
  await runMigrations();
  await seedDatabase();
  createServer(app).listen(appConfig.port, () => {
    console.log(`AgriHub em http://localhost:${appConfig.port}`);
  });
}

start().catch((error) => {
  console.error('Falha ao iniciar o AgriHub', error);
  process.exit(1);
});
```

- [ ] **Step 6: Run the full suite via the real `pretest` hook, then boot the app**

Run: `npm test`
Expected: all tests PASS (this now includes the 3 `mvc-services.test.js` tests that needed seeded data).

Run: `npm run build && npm start`
Expected: console prints `AgriHub em http://localhost:3001`; `curl -s localhost:3001/api/health` returns `{"ok":true}` (or whatever the existing health payload is).

This is the natural point to open the app in the browser and confirm the *existing* features (login, totem check-in, dashboard, RH indicator entry) still work end-to-end against Postgres — do that now, before moving to new features, so any regression is caught while the diff is still small.

---

## Task 4: SQLite → PostgreSQL data migration script

**Files:**
- Create: `server/database/migrate-from-sqlite.js`
- Test: `test/migrate-from-sqlite.test.js`

**Interfaces:**
- Consumes: `runMigrations(pool)` from Task 1.
- Produces: `migrateFromSqlite(sqlitePath, { pool })` — importable and used by the real one-off migration during the pilot cutover (spec §4.3 sequence).

- [ ] **Step 1: Write the script**

```javascript
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync } from 'node:fs';
import pg from 'pg';
import { runMigrations } from './migrate.js';
import { appConfig } from '../config/app-config.js';

const { Pool } = pg;
const TABLES = ['units', 'users', 'sectors', 'user_sectors', 'shifts', 'totens', 'responses', 'hr_indicators'];

function defaultPool() {
  return new Pool({
    connectionString: appConfig.databaseUrl,
    ssl: appConfig.databaseSsl ? { rejectUnauthorized: false } : false,
  });
}

async function importTable(client, sqlite, table) {
  const rows = sqlite.prepare(`SELECT * FROM ${table}`).all();
  for (const row of rows) {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    await client.query(
      `INSERT INTO ${table}(${columns.join(', ')}) VALUES(${placeholders}) ON CONFLICT DO NOTHING`,
      columns.map((column) => row[column]),
    );
  }
  return rows.length;
}

async function validate(sqlitePath, pool) {
  const sqlite = new DatabaseSync(sqlitePath);
  try {
    for (const table of TABLES) {
      const sourceCount = sqlite.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total;
      const destCount = (await pool.query(`SELECT COUNT(*)::int AS total FROM ${table}`)).rows[0].total;
      if (sourceCount !== destCount) {
        throw new Error(`Divergência em ${table}: origem=${sourceCount} destino=${destCount}`);
      }
    }
    const sourceTotals = sqlite.prepare(`
      SELECT sector_id, SUM(quantity) AS total FROM responses GROUP BY sector_id ORDER BY sector_id
    `).all();
    const destTotals = (await pool.query(`
      SELECT sector_id, SUM(quantity)::int AS total FROM responses GROUP BY sector_id ORDER BY sector_id
    `)).rows;
    if (JSON.stringify(sourceTotals) !== JSON.stringify(destTotals)) {
      throw new Error('Divergência nos totais agregados de respostas por setor');
    }
  } finally {
    sqlite.close();
  }
}

export async function migrateFromSqlite(sqlitePath, { pool } = {}) {
  if (!existsSync(sqlitePath)) throw new Error(`Arquivo SQLite não encontrado: ${sqlitePath}`);
  copyFileSync(sqlitePath, `${sqlitePath}.pre-migration-backup`);

  const ownedPool = pool ?? defaultPool();
  await runMigrations(ownedPool);

  const sqlite = new DatabaseSync(sqlitePath);
  const client = await ownedPool.connect();
  const report = {};
  try {
    await client.query('BEGIN');
    for (const table of TABLES) report[table] = await importTable(client, sqlite, table);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    sqlite.close();
  }

  await validate(sqlitePath, ownedPool);
  if (!pool) await ownedPool.end();
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrateFromSqlite(process.argv[2] || './data/agrihub.db')
    .then((report) => console.log('Migração concluída:', report))
    .catch((error) => { console.error('Migração falhou:', error.message); process.exit(1); });
}
```

- [ ] **Step 2: Write the test (own throwaway SQLite fixture + own throwaway Postgres database)**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import pg from 'pg';
import { migrateFromSqlite } from '../server/database/migrate-from-sqlite.js';
import { appConfig } from '../server/config/app-config.js';

const { Pool } = pg;

function buildFixtureSqlite(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE units(id TEXT PRIMARY KEY, name TEXT, timezone TEXT);
    CREATE TABLE users(id TEXT PRIMARY KEY, unit_id TEXT, role TEXT, name TEXT, code TEXT);
    CREATE TABLE sectors(id TEXT PRIMARY KEY, unit_id TEXT, name TEXT, category TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE user_sectors(user_id TEXT, sector_id TEXT);
    CREATE TABLE shifts(id TEXT PRIMARY KEY, unit_id TEXT, name TEXT, start_time TEXT, end_time TEXT);
    CREATE TABLE totens(id TEXT PRIMARY KEY, unit_id TEXT, name TEXT, credential TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE responses(id TEXT PRIMARY KEY, unit_id TEXT, sector_id TEXT, shift_id TEXT, response_date TEXT, metric TEXT, score INTEGER, quantity INTEGER);
    CREATE TABLE hr_indicators(id TEXT PRIMARY KEY, unit_id TEXT, sector_id TEXT, shift_id TEXT, period TEXT, absences INTEGER, leaves INTEGER, created_at TEXT);
  `);
  db.prepare('INSERT INTO units VALUES(?, ?, ?)').run('fx-unit', 'Unidade Fixture', 'America/Cuiaba');
  db.prepare('INSERT INTO shifts VALUES(?, ?, ?, ?, ?)').run('fx-shift', 'fx-unit', 'Manhã', '06:00', '14:00');
  db.prepare('INSERT INTO sectors(id, unit_id, name, category) VALUES(?, ?, ?, ?)').run('fx-sector', 'fx-unit', 'Setor Fixture', 'FRIA');
  db.prepare('INSERT INTO responses VALUES(?, ?, ?, ?, ?, ?, ?, ?)')
    .run('fx-resp-1', 'fx-unit', 'fx-sector', 'fx-shift', '2026-09-01', 'ENERGY', 4, 3);
  db.close();
}

async function withThrowawayDatabase(run) {
  const adminPool = new Pool({ connectionString: appConfig.databaseUrl });
  const name = `agrihub_test_import_${Date.now()}`;
  await adminPool.query(`CREATE DATABASE ${name}`);
  const testPool = new Pool({ connectionString: appConfig.databaseUrl.replace(/\/[^/]+$/, `/${name}`) });
  try {
    await run(testPool);
  } finally {
    await testPool.end();
    await adminPool.query(`DROP DATABASE ${name}`);
    await adminPool.end();
  }
}

test('migra do SQLite para um Postgres vazio sem divergência de totais', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'agrihub-migrate-'));
  const sqlitePath = resolve(dir, 'fixture.db');
  buildFixtureSqlite(sqlitePath);

  await withThrowawayDatabase(async (pool) => {
    const report = await migrateFromSqlite(sqlitePath, { pool });
    assert.equal(report.units, 1);
    assert.equal(report.responses, 1);
    const row = (await pool.query('SELECT * FROM responses WHERE id = $1', ['fx-resp-1'])).rows[0];
    assert.equal(row.quantity, 3);
  });

  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 3: Run it**

Run: `node --test test/migrate-from-sqlite.test.js`
Expected: PASS.

---

## Task 5: Analytics schema (the 9 new tables) + config/headcount seed defaults

**Files:**
- Create: `server/database/migrations/002_analytics.up.sql`
- Create: `server/database/migrations/002_analytics.down.sql`
- Modify: `server/database/seed.js` (add config + headcount seeding)
- Test: `test/migrate.test.js` (extend)

**Interfaces:**
- Produces: tables `configuracoes_indicadores`, `efetivos_setor_turno`, `indices_setor`, `alertas`, `analises_periodicas`, `planos_acao`, `acoes_plano`, `log_auditoria`, `requisicoes_totem` — exact names from `SPEC-ADICIONAL.md` §4.2, consumed by every task from here on.

- [ ] **Step 1: Write `002_analytics.up.sql`**

```sql
CREATE TABLE configuracoes_indicadores(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL UNIQUE REFERENCES units(id) ON DELETE CASCADE,
  peso_energia NUMERIC NOT NULL DEFAULT 0.30,
  peso_fisico NUMERIC NOT NULL DEFAULT 0.20,
  peso_emocional NUMERIC NOT NULL DEFAULT 0.20,
  peso_faltas NUMERIC NOT NULL DEFAULT 0.15,
  peso_afastamentos NUMERIC NOT NULL DEFAULT 0.15,
  limiar_verde NUMERIC NOT NULL DEFAULT 70,
  limiar_amarelo NUMERIC NOT NULL DEFAULT 50,
  amostra_minima INTEGER NOT NULL DEFAULT 5,
  cobertura_alvo NUMERIC NOT NULL DEFAULT 0.6,
  dias_consecutivos_amarelo INTEGER NOT NULL DEFAULT 2,
  variacao_relevante_percentual NUMERIC NOT NULL DEFAULT 0.15,
  versao INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE efetivos_setor_turno(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  efetivo_esperado INTEGER NOT NULL CHECK(efetivo_esperado > 0),
  UNIQUE(unidade_id, setor_id, turno_id)
);

CREATE TABLE indices_setor(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  tipo_periodo TEXT NOT NULL CHECK(tipo_periodo IN ('DIARIO','SEMANAL','MENSAL')),
  data_periodo TEXT NOT NULL CHECK(data_periodo ~ '^\d{4}-\d{2}-\d{2}$'),
  score NUMERIC,
  status TEXT CHECK(status IN ('VERDE','AMARELO','VERMELHO')),
  confiabilidade TEXT NOT NULL CHECK(confiabilidade IN ('INCONCLUSIVO','BAIXA','ALTA')),
  total_respostas INTEGER NOT NULL DEFAULT 0,
  taxa_participacao NUMERIC,
  detalhe JSONB NOT NULL DEFAULT '{}'::jsonb,
  calculado_em TIMESTAMPTZ NOT NULL,
  UNIQUE(unidade_id, setor_id, turno_id, tipo_periodo, data_periodo)
);
CREATE INDEX idx_indices_setor_scope ON indices_setor(unidade_id, setor_id, turno_id, tipo_periodo, data_periodo);

CREATE TABLE alertas(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  regra TEXT NOT NULL,
  nivel TEXT NOT NULL CHECK(nivel IN ('AMARELO','VERMELHO')),
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK(status IN ('ABERTO','EM_ANALISE','TRATADO','DESCARTADO')),
  motivo TEXT NOT NULL,
  dados_origem JSONB NOT NULL DEFAULT '{}'::jsonb,
  gerado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX idx_alertas_ativo_unico ON alertas(unidade_id, setor_id, turno_id, regra)
  WHERE status IN ('ABERTO','EM_ANALISE');
CREATE INDEX idx_alertas_scope ON alertas(unidade_id, setor_id, turno_id);

CREATE TABLE analises_periodicas(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  periodicidade TEXT NOT NULL CHECK(periodicidade IN ('SEMANAL','MENSAL')),
  data_periodo TEXT NOT NULL CHECK(data_periodo ~ '^\d{4}-\d{2}-\d{2}$'),
  versao_motor TEXT NOT NULL,
  resumo TEXT NOT NULL,
  evidencias JSONB NOT NULL,
  correlacoes JSONB NOT NULL,
  nivel_atencao TEXT NOT NULL CHECK(nivel_atencao IN ('BAIXA','MODERADA','ALTA')),
  indicadores_acompanhar JSONB NOT NULL,
  gerado_em TIMESTAMPTZ NOT NULL,
  UNIQUE(unidade_id, setor_id, turno_id, periodicidade, data_periodo)
);

CREATE TABLE planos_acao(
  id TEXT PRIMARY KEY,
  analise_id TEXT NOT NULL REFERENCES analises_periodicas(id) ON DELETE CASCADE,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  setor_id TEXT NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  turno_id TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','DESCARTADO')),
  criado_em TIMESTAMPTZ NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL
);

CREATE TABLE acoes_plano(
  id TEXT PRIMARY KEY,
  plano_id TEXT NOT NULL REFERENCES planos_acao(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  ordem INTEGER NOT NULL CHECK(ordem BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK(status IN ('PENDENTE','EM_ANDAMENTO','CONCLUIDO','DESCARTADO')),
  UNIQUE(plano_id, ordem)
);

CREATE TABLE log_auditoria(
  id TEXT PRIMARY KEY,
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  acao TEXT NOT NULL,
  usuario_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  detalhe JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_em TIMESTAMPTZ NOT NULL,
  hash_anterior TEXT,
  hash_atual TEXT NOT NULL
);
CREATE INDEX idx_log_auditoria_escopo ON log_auditoria(unidade_id, entidade, entidade_id);

CREATE TABLE requisicoes_totem(
  unidade_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(unidade_id, idempotency_key)
);
```

- [ ] **Step 2: Write `002_analytics.down.sql`**

```sql
DROP TABLE IF EXISTS requisicoes_totem;
DROP TABLE IF EXISTS log_auditoria;
DROP TABLE IF EXISTS acoes_plano;
DROP TABLE IF EXISTS planos_acao;
DROP TABLE IF EXISTS analises_periodicas;
DROP TABLE IF EXISTS alertas;
DROP TABLE IF EXISTS indices_setor;
DROP TABLE IF EXISTS efetivos_setor_turno;
DROP TABLE IF EXISTS configuracoes_indicadores;
```

- [ ] **Step 3: Extend `seed.js` to populate default config + demo headcount**

Add to `server/database/seed.js`, called from inside the `if (!existing)` branch in `seedDatabase()`, right after the sectors/shifts/totens block and before `await seedResponses();`:

```javascript
    await execute(`
      INSERT INTO configuracoes_indicadores(id, unidade_id) VALUES($1, $2)
    `, [randomUUID(), 'u1']);
    for (const [sectorId] of STANDARD_SECTORS) {
      for (const [shiftId] of SHIFTS) {
        await execute(`
          INSERT INTO efetivos_setor_turno(id, unidade_id, setor_id, turno_id, efetivo_esperado)
          VALUES($1, 'u1', $2, $3, 15)
        `, [randomUUID(), sectorId, shiftId]);
      }
    }
```

(All defaults come from the table's own `DEFAULT` clauses — the insert only needs `id` and `unidade_id`. `efetivo_esperado = 15` is the demo value confirmed for this round; adjustable per sector/turno later without a code change.)

- [ ] **Step 4: Extend `test/migrate.test.js` to cover the new migration**

Add a new test to the same file from Task 1:

```javascript
test('aplica a migration de analytics após a baseline', async () => {
  await withThrowawayDatabase(async (pool) => {
    await runMigrations(pool);
    const tables = (await pool.query(`
      SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `)).rows.map((row) => row.table_name);
    for (const table of [
      'configuracoes_indicadores', 'efetivos_setor_turno', 'indices_setor', 'alertas',
      'analises_periodicas', 'planos_acao', 'acoes_plano', 'log_auditoria', 'requisicoes_totem',
    ]) {
      assert.ok(tables.includes(table), `esperava a tabela ${table}`);
    }
    const versions = (await pool.query('SELECT version FROM schema_migrations ORDER BY version')).rows;
    assert.deepEqual(versions, [{ version: 1 }, { version: 2 }]);
  });
});
```

- [ ] **Step 5: Run it, then re-seed the dev database**

Run: `node --test test/migrate.test.js && npm run db:migrate && node server/database/prepare.js`
Expected: PASS; dev database now has `configuracoes_indicadores` and `efetivos_setor_turno` populated for `u1`.

---

## Task 6: Índice de atenção — pure calculation

**Files:**
- Delete: `src/domain/idt.js`, `src/domain/alertas.js` (dead code from the pre-`SPEC.md` entrada/saída model)
- Delete: `test/idt.test.js`, `test/alertas.test.js` (test the deleted modules)
- Create: `src/domain/indice-atencao.js`
- Test: `test/indice-atencao.test.js`

**Interfaces:**
- Produces: `calcularIndiceAtencao({ respostas, faltas, afastamentos, efetivoEsperado, config })` → `{ calculavel, score?, status?, confiabilidade, totalRespostas, taxaParticipacao?, ... }`, where `respostas` is `{ ENERGY: {1: n, ..., 5: n}, PHYSICAL: {...}, STRESS: {...} }` and `config` is `{ pesoEnergia, pesoFisico, pesoEmocional, pesoFaltas, pesoAfastamentos, limiarVerde, limiarAmarelo, amostraMinima, coberturaAlvo }` (same field names as `configuracoes_indicadores` columns, camelCased). Consumed by Task 7's `IndiceSetorService`.

- [ ] **Step 1: Delete the dead modules and their tests**

Run: `rm src/domain/idt.js src/domain/alertas.js test/idt.test.js test/alertas.test.js`

- [ ] **Step 2: Write the failing test**

`test/indice-atencao.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndiceAtencao } from '../src/domain/indice-atencao.js';

const config = {
  pesoEnergia: 0.30, pesoFisico: 0.20, pesoEmocional: 0.20, pesoFaltas: 0.15, pesoAfastamentos: 0.15,
  limiarVerde: 70, limiarAmarelo: 50, amostraMinima: 5, coberturaAlvo: 0.6,
};

function distribuicao(nota, quantidade) {
  return { [nota]: quantidade };
}

test('marca INCONCLUSIVO abaixo da amostra mínima', () => {
  const resultado = calcularIndiceAtencao({
    respostas: { ENERGY: distribuicao(5, 2), PHYSICAL: distribuicao(1, 2), STRESS: distribuicao(1, 2) },
    faltas: 0, afastamentos: 0, efetivoEsperado: 15, config,
  });
  assert.deepEqual(resultado, { calculavel: false, confiabilidade: 'INCONCLUSIVO', totalRespostas: 2 });
});

test('cenário saudável com amostra alta gera score alto e confiabilidade ALTA', () => {
  const resultado = calcularIndiceAtencao({
    respostas: { ENERGY: distribuicao(5, 10), PHYSICAL: distribuicao(1, 10), STRESS: distribuicao(1, 10) },
    faltas: 0, afastamentos: 0, efetivoEsperado: 15, config,
  });
  assert.equal(resultado.calculavel, true);
  assert.equal(resultado.score, 100);
  assert.equal(resultado.status, 'VERDE');
  assert.equal(resultado.confiabilidade, 'ALTA');
  assert.equal(resultado.taxaParticipacao, 10 / 15);
});

test('faltas e afastamentos derrubam o score mesmo com bem-estar bom', () => {
  const resultado = calcularIndiceAtencao({
    respostas: { ENERGY: distribuicao(5, 8), PHYSICAL: distribuicao(1, 8), STRESS: distribuicao(1, 8) },
    faltas: 15, afastamentos: 15, efetivoEsperado: 15, config,
  });
  assert.equal(resultado.calculavel, true);
  assert.equal(resultado.score, 70);
  assert.equal(resultado.status, 'VERDE');
});

test('amostra entre o mínimo e o ideal é BAIXA confiabilidade, não oculta o score', () => {
  const resultado = calcularIndiceAtencao({
    respostas: { ENERGY: distribuicao(3, 6), PHYSICAL: distribuicao(3, 6), STRESS: distribuicao(3, 6) },
    faltas: 0, afastamentos: 0, efetivoEsperado: 15, config,
  });
  assert.equal(resultado.calculavel, true);
  assert.equal(resultado.confiabilidade, 'BAIXA');
});

test('classifica exatamente nos limites', () => {
  const casos = [
    [{ ENERGY: distribuicao(5, 10), PHYSICAL: distribuicao(1, 10), STRESS: distribuicao(1, 10) }, 0, 0, 'VERDE'],
    [{ ENERGY: distribuicao(3, 10), PHYSICAL: distribuicao(3, 10), STRESS: distribuicao(3, 10) }, 7, 8, 'AMARELO'],
    [{ ENERGY: distribuicao(1, 10), PHYSICAL: distribuicao(5, 10), STRESS: distribuicao(5, 10) }, 15, 15, 'VERMELHO'],
  ];
  for (const [respostas, faltas, afastamentos, esperado] of casos) {
    const resultado = calcularIndiceAtencao({ respostas, faltas, afastamentos, efetivoEsperado: 15, config });
    assert.equal(resultado.status, esperado, JSON.stringify({ respostas, faltas, afastamentos }));
  }
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `node --test test/indice-atencao.test.js`
Expected: FAIL — `Cannot find module '../src/domain/indice-atencao.js'`.

- [ ] **Step 4: Implement**

`src/domain/indice-atencao.js`:

```javascript
function media(distribuicao) {
  const entries = Object.entries(distribuicao ?? {});
  const quantidade = entries.reduce((sum, [, qty]) => sum + qty, 0);
  if (quantidade === 0) return { media: null, quantidade: 0 };
  const soma = entries.reduce((sum, [nota, qty]) => sum + Number(nota) * qty, 0);
  return { media: soma / quantidade, quantidade };
}

export function classificarIndice(score, config) {
  if (score >= config.limiarVerde) return 'VERDE';
  if (score >= config.limiarAmarelo) return 'AMARELO';
  return 'VERMELHO';
}

export function calcularIndiceAtencao({ respostas, faltas = 0, afastamentos = 0, efetivoEsperado, config }) {
  const energia = media(respostas.ENERGY);
  const fisico = media(respostas.PHYSICAL);
  const emocional = media(respostas.STRESS);
  const totalRespostas = Math.round((energia.quantidade + fisico.quantidade + emocional.quantidade) / 3);

  if (totalRespostas < config.amostraMinima || energia.media === null || fisico.media === null || emocional.media === null) {
    return { calculavel: false, confiabilidade: 'INCONCLUSIVO', totalRespostas };
  }

  const energiaNorm = energia.media / 5;
  const fisicoNorm = (6 - fisico.media) / 5;
  const emocionalNorm = (6 - emocional.media) / 5;
  const taxaFaltas = Math.min(1, faltas / efetivoEsperado);
  const taxaAfastamentos = Math.min(1, afastamentos / efetivoEsperado);

  const scoreBruto = 100 * (
    config.pesoEnergia * energiaNorm
    + config.pesoFisico * fisicoNorm
    + config.pesoEmocional * emocionalNorm
    + config.pesoFaltas * (1 - taxaFaltas)
    + config.pesoAfastamentos * (1 - taxaAfastamentos)
  );
  const score = Math.round(scoreBruto * 100) / 100;
  const status = classificarIndice(score, config);

  const amostraIdeal = efetivoEsperado * config.coberturaAlvo;
  const confiabilidade = totalRespostas >= amostraIdeal ? 'ALTA' : 'BAIXA';
  const taxaParticipacao = Math.min(1, totalRespostas / efetivoEsperado);

  return {
    calculavel: true, score, status, confiabilidade, totalRespostas, taxaParticipacao,
    energiaNorm, fisicoNorm, emocionalNorm, taxaFaltas, taxaAfastamentos,
  };
}
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `node --test test/indice-atencao.test.js`
Expected: PASS (6 tests).

- [ ] **Step 6: Run the full suite (nothing else should reference the deleted files)**

Run: `npm test`
Expected: PASS.

---

## Task 7: `IndiceSetorService` — compute and cache into `indices_setor`

**Files:**
- Create: `server/models/config-model.js`
- Create: `server/models/indice-setor-model.js`
- Create: `server/services/indice-setor-service.js`
- Test: `test/indice-setor-service.test.js`

**Interfaces:**
- Consumes: `calcularIndiceAtencao` from Task 6.
- Produces: `IndiceSetorService.calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo, dataInicio, dataFim })` → the upserted `indices_setor` row (plain object, snake_case as read from the DB) — this is what Task 8 (comparação/participação endpoints) and Task 9 (alertas) both call to get a fresh or cached index.

- [ ] **Step 1: `server/models/config-model.js`**

```javascript
import { queryOne } from '../config/database.js';

export const ConfigModel = {
  async getForUnit(unidadeId) {
    const row = await queryOne('SELECT * FROM configuracoes_indicadores WHERE unidade_id = $1', [unidadeId]);
    return row && {
      pesoEnergia: Number(row.peso_energia),
      pesoFisico: Number(row.peso_fisico),
      pesoEmocional: Number(row.peso_emocional),
      pesoFaltas: Number(row.peso_faltas),
      pesoAfastamentos: Number(row.peso_afastamentos),
      limiarVerde: Number(row.limiar_verde),
      limiarAmarelo: Number(row.limiar_amarelo),
      amostraMinima: row.amostra_minima,
      coberturaAlvo: Number(row.cobertura_alvo),
      diasConsecutivosAmarelo: row.dias_consecutivos_amarelo,
      variacaoRelevantePercentual: Number(row.variacao_relevante_percentual),
    };
  },
};
```

- [ ] **Step 2: `server/models/indice-setor-model.js`**

> `node-postgres` parses `json`/`jsonb` columns into plain JS objects automatically on the way out — every `row.detalhe`, `row.evidencias`, `row.correlacoes`, `row.dados_origem`, `row.acoes` read anywhere in this plan is already an object/array, never a string. Write with `JSON.stringify(...)` (or just pass the object — `pg` stringifies objects for you too, the explicit call below is just for clarity), but never call `JSON.parse` on a value read back from one of these columns — it will throw, since it isn't a string.

```javascript
import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, execute } from '../config/database.js';

export const IndiceSetorModel = {
  upsert({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo, resultado }) {
    return execute(`
      INSERT INTO indices_setor(
        id, unidade_id, setor_id, turno_id, tipo_periodo, data_periodo,
        score, status, confiabilidade, total_respostas, taxa_participacao, detalhe, calculado_em
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (unidade_id, setor_id, turno_id, tipo_periodo, data_periodo)
      DO UPDATE SET score = $7, status = $8, confiabilidade = $9, total_respostas = $10,
        taxa_participacao = $11, detalhe = $12, calculado_em = $13
    `, [
      randomUUID(), unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo,
      resultado.calculavel ? resultado.score : null,
      resultado.calculavel ? resultado.status : null,
      resultado.confiabilidade,
      resultado.totalRespostas,
      resultado.calculavel ? resultado.taxaParticipacao : null,
      JSON.stringify(resultado),
      new Date().toISOString(),
    ]);
  },

  find({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo }) {
    return queryOne(`
      SELECT * FROM indices_setor
      WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3 AND tipo_periodo = $4 AND data_periodo = $5
    `, [unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo]);
  },

  listHistory({ unidadeId, setorId, turnoId, tipoPeriodo, limit = 30 }) {
    return queryAll(`
      SELECT * FROM indices_setor
      WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3 AND tipo_periodo = $4
      ORDER BY data_periodo DESC
      LIMIT $5
    `, [unidadeId, setorId, turnoId, tipoPeriodo, limit]);
  },
};
```

- [ ] **Step 3: Write the failing integration test**

`test/indice-setor-service.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { IndiceSetorService } from '../server/services/indice-setor-service.js';
import { IndiceSetorModel } from '../server/models/indice-setor-model.js';

test('calcula e armazena o índice diário de um setor com amostra do seed', async () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const row = await IndiceSetorService.calcularEArmazenar({
    unidadeId: 'u1', setorId: 's1', turnoId: 't1', tipoPeriodo: 'DIARIO', dataPeriodo: hoje,
  });
  assert.equal(row.unidade_id, 'u1');
  assert.ok(['INCONCLUSIVO', 'BAIXA', 'ALTA'].includes(row.confiabilidade));

  const stored = await IndiceSetorModel.find({
    unidadeId: 'u1', setorId: 's1', turnoId: 't1', tipoPeriodo: 'DIARIO', dataPeriodo: hoje,
  });
  assert.equal(stored.id, row.id);
});

test('recalcular o mesmo escopo faz upsert (não duplica linha)', async () => {
  const hoje = new Date().toISOString().slice(0, 10);
  await IndiceSetorService.calcularEArmazenar({
    unidadeId: 'u1', setorId: 's2', turnoId: 't1', tipoPeriodo: 'DIARIO', dataPeriodo: hoje,
  });
  const second = await IndiceSetorService.calcularEArmazenar({
    unidadeId: 'u1', setorId: 's2', turnoId: 't1', tipoPeriodo: 'DIARIO', dataPeriodo: hoje,
  });
  const history = await IndiceSetorModel.listHistory({
    unidadeId: 'u1', setorId: 's2', turnoId: 't1', tipoPeriodo: 'DIARIO',
  });
  assert.equal(history.filter((row) => row.data_periodo === hoje).length, 1);
  assert.equal(second.confiabilidade, second.confiabilidade);
});
```

- [ ] **Step 4: Run it and confirm it fails**

Run: `node --test test/indice-setor-service.test.js`
Expected: FAIL — `Cannot find module '../server/services/indice-setor-service.js'`.

- [ ] **Step 5: Implement**

`server/services/indice-setor-service.js`:

```javascript
import { calcularIndiceAtencao } from '../../src/domain/indice-atencao.js';
import { queryAll, queryOne } from '../config/database.js';
import { ConfigModel } from '../models/config-model.js';
import { IndiceSetorModel } from '../models/indice-setor-model.js';

async function respostasNoPeriodo({ unidadeId, setorId, turnoId, dataInicio, dataFim }) {
  const rows = await queryAll(`
    SELECT metric, score, SUM(quantity)::int AS quantity
    FROM responses
    WHERE unit_id = $1 AND sector_id = $2 AND shift_id = $3
      AND response_date BETWEEN $4 AND $5
    GROUP BY metric, score
  `, [unidadeId, setorId, turnoId, dataInicio, dataFim]);

  const respostas = { ENERGY: {}, PHYSICAL: {}, STRESS: {} };
  for (const row of rows) respostas[row.metric][row.score] = row.quantity;
  return respostas;
}

async function hrNoPeriodo({ unidadeId, setorId, turnoId, dataInicio, dataFim }) {
  return queryOne(`
    SELECT COALESCE(SUM(absences), 0)::int AS faltas, COALESCE(SUM(leaves), 0)::int AS afastamentos
    FROM hr_indicators
    WHERE unit_id = $1 AND sector_id = $2 AND shift_id = $3 AND period BETWEEN $4 AND $5
  `, [unidadeId, setorId, turnoId, dataInicio, dataFim]);
}

async function efetivoEsperado({ unidadeId, setorId, turnoId }) {
  const row = await queryOne(`
    SELECT efetivo_esperado FROM efetivos_setor_turno
    WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3
  `, [unidadeId, setorId, turnoId]);
  return row?.efetivo_esperado ?? null;
}

function periodoParaIntervalo(tipoPeriodo, dataPeriodo) {
  if (tipoPeriodo === 'DIARIO') return { dataInicio: dataPeriodo, dataFim: dataPeriodo };
  const referencia = new Date(`${dataPeriodo}T00:00:00Z`);
  if (tipoPeriodo === 'SEMANAL') {
    const inicio = new Date(referencia);
    inicio.setUTCDate(inicio.getUTCDate() - 6);
    return { dataInicio: inicio.toISOString().slice(0, 10), dataFim: dataPeriodo };
  }
  const inicioMes = new Date(Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), 1));
  return { dataInicio: inicioMes.toISOString().slice(0, 10), dataFim: dataPeriodo };
}

export const IndiceSetorService = {
  async calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo }) {
    const { dataInicio, dataFim } = periodoParaIntervalo(tipoPeriodo, dataPeriodo);
    const [respostas, hr, config, efetivo] = await Promise.all([
      respostasNoPeriodo({ unidadeId, setorId, turnoId, dataInicio, dataFim }),
      hrNoPeriodo({ unidadeId, setorId, turnoId, dataInicio, dataFim }),
      ConfigModel.getForUnit(unidadeId),
      efetivoEsperado({ unidadeId, setorId, turnoId }),
    ]);

    const resultado = efetivo
      ? calcularIndiceAtencao({
        respostas, faltas: hr.faltas, afastamentos: hr.afastamentos, efetivoEsperado: efetivo, config,
      })
      : { calculavel: false, confiabilidade: 'INCONCLUSIVO', totalRespostas: 0 };

    await IndiceSetorModel.upsert({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo, resultado });
    return IndiceSetorModel.find({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo });
  },
};
```

- [ ] **Step 6: Run it and confirm it passes**

Run: `node --test test/indice-setor-service.test.js`
Expected: PASS.

---

## Task 8: Comparação temporal + participação + `GET /indices`, `/comparativo`, `/participacao`

**Files:**
- Create: `src/domain/comparacao-temporal.js`
- Test: `test/comparacao-temporal.test.js`
- Create: `server/services/supervisor-analytics-service.js`
- Create: `server/controllers/supervisor-controller.js`
- Modify: `server/routes/api-routes.js`

**Interfaces:**
- Consumes: `IndiceSetorService.calcularEArmazenar`, `IndiceSetorModel.listHistory` from Task 7.
- Produces: `compararPeriodos(atual, anterior, config)` from `src/domain/comparacao-temporal.js`; three new authorized routes.

- [ ] **Step 1: Write the failing test for the pure comparison function**

`test/comparacao-temporal.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { compararPeriodos } from '../src/domain/comparacao-temporal.js';

const config = { variacaoRelevantePercentual: 0.15 };

test('sem período anterior calculável, sinaliza amostra insuficiente', () => {
  const atual = { calculavel: true, score: 80, energiaNorm: 0.9, fisicoNorm: 0.8, emocionalNorm: 0.8, taxaFaltas: 0.1, taxaAfastamentos: 0 };
  const anterior = { calculavel: false, confiabilidade: 'INCONCLUSIVO' };
  const comparacao = compararPeriodos(atual, anterior, config);
  assert.equal(comparacao.comparavel, false);
  assert.equal(comparacao.motivo, 'AMOSTRA_INSUFICIENTE');
});

test('detecta melhora quando o score sobe', () => {
  const atual = { calculavel: true, score: 90, energiaNorm: 0.9, fisicoNorm: 0.9, emocionalNorm: 0.9, taxaFaltas: 0, taxaAfastamentos: 0 };
  const anterior = { calculavel: true, score: 70, energiaNorm: 0.7, fisicoNorm: 0.7, emocionalNorm: 0.7, taxaFaltas: 0.1, taxaAfastamentos: 0.1 };
  const comparacao = compararPeriodos(atual, anterior, config);
  assert.equal(comparacao.comparavel, true);
  assert.equal(comparacao.tendencia, 'MELHORA');
  assert.ok(comparacao.variacaoScorePercentual > 0);
});

test('detecta piora quando o score cai além do limiar', () => {
  const atual = { calculavel: true, score: 50, energiaNorm: 0.5, fisicoNorm: 0.5, emocionalNorm: 0.5, taxaFaltas: 0.3, taxaAfastamentos: 0.2 };
  const anterior = { calculavel: true, score: 70, energiaNorm: 0.7, fisicoNorm: 0.7, emocionalNorm: 0.7, taxaFaltas: 0.1, taxaAfastamentos: 0.1 };
  const comparacao = compararPeriodos(atual, anterior, config);
  assert.equal(comparacao.tendencia, 'PIORA');
});

test('variação pequena é classificada como estável', () => {
  const atual = { calculavel: true, score: 71, energiaNorm: 0.71, fisicoNorm: 0.71, emocionalNorm: 0.71, taxaFaltas: 0.1, taxaAfastamentos: 0.1 };
  const anterior = { calculavel: true, score: 70, energiaNorm: 0.70, fisicoNorm: 0.70, emocionalNorm: 0.70, taxaFaltas: 0.1, taxaAfastamentos: 0.1 };
  const comparacao = compararPeriodos(atual, anterior, config);
  assert.equal(comparacao.tendencia, 'ESTAVEL');
});
```

- [ ] **Step 2: Confirm it fails, then implement**

Run: `node --test test/comparacao-temporal.test.js` → FAIL (module not found).

`src/domain/comparacao-temporal.js`:

```javascript
function variacaoPercentual(atual, anterior) {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return (atual - anterior) / anterior;
}

export function compararPeriodos(atual, anterior, config) {
  if (!atual?.calculavel || !anterior?.calculavel) {
    return { comparavel: false, motivo: 'AMOSTRA_INSUFICIENTE' };
  }

  const variacaoScorePercentual = variacaoPercentual(atual.score, anterior.score);
  const tendencia = Math.abs(variacaoScorePercentual) < config.variacaoRelevantePercentual
    ? 'ESTAVEL'
    : variacaoScorePercentual > 0 ? 'MELHORA' : 'PIORA';

  return {
    comparavel: true,
    tendencia,
    variacaoScorePercentual,
    variacaoEnergiaPercentual: variacaoPercentual(atual.energiaNorm, anterior.energiaNorm),
    variacaoFisicoPercentual: variacaoPercentual(atual.fisicoNorm, anterior.fisicoNorm),
    variacaoEmocionalPercentual: variacaoPercentual(atual.emocionalNorm, anterior.emocionalNorm),
    variacaoFaltasPercentual: variacaoPercentual(atual.taxaFaltas, anterior.taxaFaltas),
    variacaoAfastamentosPercentual: variacaoPercentual(atual.taxaAfastamentos, anterior.taxaAfastamentos),
  };
}
```

Run: `node --test test/comparacao-temporal.test.js` → PASS.

- [ ] **Step 3: `server/services/supervisor-analytics-service.js`**

```javascript
import { compararPeriodos } from '../../src/domain/comparacao-temporal.js';
import { ConfigModel } from '../models/config-model.js';
import { IndiceSetorModel } from '../models/indice-setor-model.js';
import { IndiceSetorService } from './indice-setor-service.js';
import { SectorModel } from '../models/sector-model.js';

function periodoAnterior(tipoPeriodo, dataPeriodo) {
  const data = new Date(`${dataPeriodo}T00:00:00Z`);
  if (tipoPeriodo === 'DIARIO') data.setUTCDate(data.getUTCDate() - 1);
  else if (tipoPeriodo === 'SEMANAL') data.setUTCDate(data.getUTCDate() - 7);
  else data.setUTCMonth(data.getUTCMonth() - 1);
  return data.toISOString().slice(0, 10);
}

export const SupervisorAnalyticsService = {
  async indices({ unidadeId, setorIds, turnoId, tipoPeriodo, dataPeriodo }) {
    const setores = setorIds
      ? await Promise.all(setorIds.map((id) => SectorModel.findActiveInUnit(id, unidadeId)))
      : await SectorModel.listActiveByUnit(unidadeId);
    const escopos = setorIds ? setores.filter(Boolean) : setores;

    return Promise.all(escopos.map((setor) => IndiceSetorService.calcularEArmazenar({
      unidadeId, setorId: setor.id, turnoId, tipoPeriodo, dataPeriodo,
    })));
  },

  async comparativo({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo }) {
    const config = await ConfigModel.getForUnit(unidadeId);
    const atualRow = await IndiceSetorService.calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo });
    const anteriorData = periodoAnterior(tipoPeriodo, dataPeriodo);
    const anteriorRow = await IndiceSetorService.calcularEArmazenar({
      unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo: anteriorData,
    });
    return {
      atual: atualRow,
      anterior: anteriorRow,
      comparacao: compararPeriodos(atualRow.detalhe, anteriorRow.detalhe, config),
    };
  },

  async participacao({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo }) {
    const row = await IndiceSetorService.calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo, dataPeriodo });
    return {
      totalRespostas: row.total_respostas,
      taxaParticipacao: row.taxa_participacao === null ? null : Number(row.taxa_participacao),
      confiabilidade: row.confiabilidade,
    };
  },

  async historico({ unidadeId, setorId, turnoId, tipoPeriodo, limit }) {
    return IndiceSetorModel.listHistory({ unidadeId, setorId, turnoId, tipoPeriodo, limit });
  },
};
```

- [ ] **Step 4: `server/controllers/supervisor-controller.js` (indices/comparativo/participacao only — alertas/analises/planos-acao are added in Tasks 9 and 10)**

```javascript
import { SupervisorAnalyticsService } from '../services/supervisor-analytics-service.js';
import { json } from '../utils/http.js';
import { dateKey } from '../utils/date.js';

function scopedSectorIds(session, url) {
  const requested = url.searchParams.get('setor');
  if (requested && requested !== 'all') return [requested];
  return null;
}

export async function getIndices(_request, response, { session, url }) {
  const tipoPeriodo = url.searchParams.get('periodo') || 'DIARIO';
  const dataPeriodo = url.searchParams.get('data') || dateKey();
  const turnoId = url.searchParams.get('turno');
  const rows = await SupervisorAnalyticsService.indices({
    unidadeId: session.unitId, setorIds: scopedSectorIds(session, url), turnoId, tipoPeriodo, dataPeriodo,
  });
  json(response, 200, { indices: rows });
}

export async function getComparativo(_request, response, { session, url }) {
  const setorId = url.searchParams.get('setor');
  const turnoId = url.searchParams.get('turno');
  const tipoPeriodo = url.searchParams.get('periodo') || 'DIARIO';
  const dataPeriodo = url.searchParams.get('data') || dateKey();
  if (!setorId || !turnoId) return json(response, 422, { error: 'Informe setor e turno' });
  json(response, 200, await SupervisorAnalyticsService.comparativo({
    unidadeId: session.unitId, setorId, turnoId, tipoPeriodo, dataPeriodo,
  }));
}

export async function getParticipacao(_request, response, { session, url }) {
  const setorId = url.searchParams.get('setor');
  const turnoId = url.searchParams.get('turno');
  const tipoPeriodo = url.searchParams.get('periodo') || 'DIARIO';
  const dataPeriodo = url.searchParams.get('data') || dateKey();
  if (!setorId || !turnoId) return json(response, 422, { error: 'Informe setor e turno' });
  json(response, 200, await SupervisorAnalyticsService.participacao({
    unidadeId: session.unitId, setorId, turnoId, tipoPeriodo, dataPeriodo,
  }));
}
```

- [ ] **Step 5: Wire the routes**

`server/routes/api-routes.js` — add the import and the three route entries:

```javascript
import { getIndices, getComparativo, getParticipacao } from '../controllers/supervisor-controller.js';
```

```javascript
  ['GET /api/v1/supervisor/indices', authorize(['SUPERVISOR'], getIndices)],
  ['GET /api/v1/supervisor/comparativo', authorize(['SUPERVISOR'], getComparativo)],
  ['GET /api/v1/supervisor/participacao', authorize(['SUPERVISOR'], getParticipacao)],
```

(inserted into the existing `routes` Map, alongside the current entries.)

- [ ] **Step 6: Manual smoke test**

Run: `npm start` in one terminal; in another:

```bash
TOKEN=$(curl -s -X POST localhost:3001/api/auth -d '{"type":"SUPERVISOR","code":"SUPERVISOR"}' -H 'content-type: application/json' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
curl -s "localhost:3001/api/v1/supervisor/indices?turno=t1" -H "authorization: Bearer $TOKEN" | head -c 400
```

Expected: JSON with an `indices` array, one entry per active sector, each with `confiabilidade` and (when calculable) `score`/`status`.

---

## Task 9: Alertas — new rule engine + generation + `GET`/`PATCH /alertas`

**Files:**
- Create: `src/domain/alertas.js` (new file — the old one was deleted in Task 6)
- Test: `test/alertas.test.js` (new — the old one was deleted in Task 6)
- Create: `server/models/alerta-model.js`
- Modify: `server/services/supervisor-analytics-service.js` (wire alert evaluation into `indices()`)
- Modify: `server/controllers/supervisor-controller.js` (add `getAlertas`, `patchAlerta`)
- Modify: `server/routes/api-routes.js`

**Interfaces:**
- Consumes: `IndiceSetorModel.listHistory`, `compararPeriodos` from Tasks 7-8.
- Produces: `avaliarAlertas({ historico, comparacao, config })` → array of `{ regra, nivel, motivo, dadosOrigem }` (zero or more triggers) from `src/domain/alertas.js`.

- [ ] **Step 1: Write the failing test**

`test/alertas.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { avaliarAlertas } from '../src/domain/alertas.js';

const config = { limiarAmarelo: 50, limiarVerde: 70, diasConsecutivosAmarelo: 2, variacaoRelevantePercentual: 0.15, amostraMinima: 5 };

function indice(status, score, extra = {}) {
  return { calculavel: true, status, score, confiabilidade: 'ALTA', totalRespostas: 20, ...extra };
}

test('índice em vermelho dispara alerta vermelho', () => {
  const alertas = avaliarAlertas({ historico: [indice('VERMELHO', 40)], comparacao: { comparavel: false }, config });
  assert.equal(alertas.length, 1);
  assert.equal(alertas[0].nivel, 'VERMELHO');
  assert.equal(alertas[0].regra, 'INDICE_VERMELHO');
});

test('amarelo por dias consecutivos dispara, um único amarelo não dispara', () => {
  const umDia = avaliarAlertas({ historico: [indice('AMARELO', 60)], comparacao: { comparavel: false }, config });
  assert.equal(umDia.some((alerta) => alerta.regra === 'AMARELO_CONSECUTIVO'), false);

  const doisDias = avaliarAlertas({
    historico: [indice('AMARELO', 60), indice('AMARELO', 58)],
    comparacao: { comparavel: false },
    config,
  });
  assert.ok(doisDias.some((alerta) => alerta.regra === 'AMARELO_CONSECUTIVO'));
});

test('queda relevante de energia dispara alerta', () => {
  const alertas = avaliarAlertas({
    historico: [indice('VERDE', 75)],
    comparacao: { comparavel: true, tendencia: 'PIORA', variacaoEnergiaPercentual: -0.2, variacaoFisicoPercentual: 0, variacaoEmocionalPercentual: 0, variacaoFaltasPercentual: 0, variacaoAfastamentosPercentual: 0 },
    config,
  });
  assert.ok(alertas.some((alerta) => alerta.regra === 'QUEDA_ENERGIA'));
});

test('aumento simultâneo de desgaste e faltas dispara alerta combinado', () => {
  const alertas = avaliarAlertas({
    historico: [indice('AMARELO', 55)],
    comparacao: { comparavel: true, tendencia: 'PIORA', variacaoEnergiaPercentual: 0, variacaoFisicoPercentual: 0.2, variacaoEmocionalPercentual: 0, variacaoFaltasPercentual: 0.25, variacaoAfastamentosPercentual: 0 },
    config,
  });
  assert.ok(alertas.some((alerta) => alerta.regra === 'DESGASTE_E_FALTAS'));
});

test('amostra abaixo do mínimo dispara alerta de amostra reduzida', () => {
  const alertas = avaliarAlertas({
    historico: [{ calculavel: false, confiabilidade: 'INCONCLUSIVO', totalRespostas: 2 }],
    comparacao: { comparavel: false },
    config,
  });
  assert.ok(alertas.some((alerta) => alerta.regra === 'AMOSTRA_REDUZIDA'));
});

test('sem gatilhos, não gera alerta', () => {
  const alertas = avaliarAlertas({ historico: [indice('VERDE', 90)], comparacao: { comparavel: true, tendencia: 'ESTAVEL' }, config });
  assert.deepEqual(alertas, []);
});
```

- [ ] **Step 2: Confirm it fails, then implement**

Run: `node --test test/alertas.test.js` → FAIL.

`src/domain/alertas.js`:

```javascript
export function avaliarAlertas({ historico, comparacao, config }) {
  const alertas = [];
  const atual = historico[0];
  if (!atual) return alertas;

  if (atual.calculavel && atual.status === 'VERMELHO') {
    alertas.push({
      regra: 'INDICE_VERMELHO', nivel: 'VERMELHO',
      motivo: `Índice em ${atual.score} (faixa vermelha)`,
      dadosOrigem: { score: atual.score },
    });
  }

  const amarelosConsecutivos = [];
  for (const registro of historico) {
    if (registro.calculavel && registro.status === 'AMARELO') amarelosConsecutivos.push(registro);
    else break;
  }
  if (amarelosConsecutivos.length >= config.diasConsecutivosAmarelo) {
    alertas.push({
      regra: 'AMARELO_CONSECUTIVO', nivel: 'AMARELO',
      motivo: `Índice em faixa amarela por ${amarelosConsecutivos.length} períodos consecutivos`,
      dadosOrigem: { periodos: amarelosConsecutivos.length },
    });
  }

  if (comparacao.comparavel) {
    const limiar = config.variacaoRelevantePercentual;
    if (comparacao.variacaoEnergiaPercentual !== null && comparacao.variacaoEnergiaPercentual <= -limiar) {
      alertas.push({
        regra: 'QUEDA_ENERGIA', nivel: 'AMARELO',
        motivo: `Energia caiu ${Math.round(Math.abs(comparacao.variacaoEnergiaPercentual) * 100)}% frente ao período anterior`,
        dadosOrigem: { variacaoEnergiaPercentual: comparacao.variacaoEnergiaPercentual },
      });
    }
    const pioraFisicoOuEmocional = (comparacao.variacaoFisicoPercentual !== null && comparacao.variacaoFisicoPercentual >= limiar)
      || (comparacao.variacaoEmocionalPercentual !== null && comparacao.variacaoEmocionalPercentual >= limiar);
    if (pioraFisicoOuEmocional) {
      alertas.push({
        regra: 'AUMENTO_DOR_OU_ESTRESSE', nivel: 'AMARELO',
        motivo: 'Aumento relevante de dor/cansaço ou ansiedade/estresse frente ao período anterior',
        dadosOrigem: {
          variacaoFisicoPercentual: comparacao.variacaoFisicoPercentual,
          variacaoEmocionalPercentual: comparacao.variacaoEmocionalPercentual,
        },
      });
    }
    const desgasteSobe = pioraFisicoOuEmocional;
    const faltasSobe = (comparacao.variacaoFaltasPercentual !== null && comparacao.variacaoFaltasPercentual >= limiar)
      || (comparacao.variacaoAfastamentosPercentual !== null && comparacao.variacaoAfastamentosPercentual >= limiar);
    if (desgasteSobe && faltasSobe) {
      alertas.push({
        regra: 'DESGASTE_E_FALTAS', nivel: 'AMARELO',
        motivo: 'Aumento simultâneo de desgaste físico/emocional e de faltas ou afastamentos',
        dadosOrigem: {
          variacaoFaltasPercentual: comparacao.variacaoFaltasPercentual,
          variacaoAfastamentosPercentual: comparacao.variacaoAfastamentosPercentual,
        },
      });
    }
  }

  if (!atual.calculavel && atual.confiabilidade === 'INCONCLUSIVO') {
    alertas.push({
      regra: 'AMOSTRA_REDUZIDA', nivel: 'AMARELO',
      motivo: `Amostra (${atual.totalRespostas}) abaixo do mínimo configurado (${config.amostraMinima})`,
      dadosOrigem: { totalRespostas: atual.totalRespostas, amostraMinima: config.amostraMinima },
    });
  }

  return alertas;
}
```

Run: `node --test test/alertas.test.js` → PASS (6 tests).

- [ ] **Step 3: `server/models/alerta-model.js`**

```javascript
import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, execute } from '../config/database.js';

export const AlertaModel = {
  findActive({ unidadeId, setorId, turnoId, regra }) {
    return queryOne(`
      SELECT id FROM alertas
      WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3 AND regra = $4
        AND status IN ('ABERTO', 'EM_ANALISE')
    `, [unidadeId, setorId, turnoId, regra]);
  },

  async createIfNotActive({ unidadeId, setorId, turnoId, regra, nivel, motivo, dadosOrigem }) {
    if (await AlertaModel.findActive({ unidadeId, setorId, turnoId, regra })) return null;
    const now = new Date().toISOString();
    await execute(`
      INSERT INTO alertas(id, unidade_id, setor_id, turno_id, regra, nivel, status, motivo, dados_origem, gerado_em, atualizado_em)
      VALUES($1, $2, $3, $4, $5, $6, 'ABERTO', $7, $8, $9, $9)
      ON CONFLICT DO NOTHING
    `, [randomUUID(), unidadeId, setorId, turnoId, regra, nivel, motivo, JSON.stringify(dadosOrigem), now]);
    return true;
  },

  listByUnit({ unidadeId, setorIds, status }) {
    const clauses = ['unidade_id = $1'];
    const params = [unidadeId];
    if (setorIds) {
      params.push(setorIds);
      clauses.push(`setor_id = ANY($${params.length})`);
    }
    if (status) {
      params.push(status);
      clauses.push(`status = $${params.length}`);
    }
    return queryAll(`
      SELECT a.*, s.name AS setor_nome, sh.name AS turno_nome
      FROM alertas a
      JOIN sectors s ON s.id = a.setor_id
      JOIN shifts sh ON sh.id = a.turno_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY a.gerado_em DESC
    `, params);
  },

  async updateStatus({ id, unidadeId, status }) {
    const rowCount = await execute(`
      UPDATE alertas SET status = $1, atualizado_em = $2
      WHERE id = $3 AND unidade_id = $4
    `, [status, new Date().toISOString(), id, unidadeId]);
    return rowCount > 0;
  },
};
```

- [ ] **Step 4: Wire alert generation into `SupervisorAnalyticsService.indices` and add the alert query/patch methods**

In `server/services/supervisor-analytics-service.js`, add the imports and extend `indices()`:

```javascript
import { avaliarAlertas } from '../../src/domain/alertas.js';
import { compararPeriodos } from '../../src/domain/comparacao-temporal.js';
import { AlertaModel } from '../models/alerta-model.js';
```

Replace the `indices()` method body with:

```javascript
  async indices({ unidadeId, setorIds, turnoId, tipoPeriodo, dataPeriodo }) {
    const setores = setorIds
      ? (await Promise.all(setorIds.map((id) => SectorModel.findActiveInUnit(id, unidadeId)))).filter(Boolean)
      : await SectorModel.listActiveByUnit(unidadeId);
    const config = await ConfigModel.getForUnit(unidadeId);

    return Promise.all(setores.map(async (setor) => {
      const atual = await IndiceSetorService.calcularEArmazenar({
        unidadeId, setorId: setor.id, turnoId, tipoPeriodo, dataPeriodo,
      });
      const historico = await IndiceSetorModel.listHistory({
        unidadeId, setorId: setor.id, turnoId, tipoPeriodo, limit: config.diasConsecutivosAmarelo + 1,
      });
      const historicoDetalhe = historico.map((row) => row.detalhe);
      const comparacao = historicoDetalhe[1]
        ? compararPeriodos(historicoDetalhe[0], historicoDetalhe[1], config)
        : { comparavel: false };
      const gatilhos = avaliarAlertas({ historico: historicoDetalhe, comparacao, config });
      for (const gatilho of gatilhos) {
        await AlertaModel.createIfNotActive({
          unidadeId, setorId: setor.id, turnoId, regra: gatilho.regra, nivel: gatilho.nivel,
          motivo: gatilho.motivo, dadosOrigem: gatilho.dadosOrigem,
        });
      }
      return atual;
    }));
  },

  async alertas({ unidadeId, setorIds, status }) {
    return AlertaModel.listByUnit({ unidadeId, setorIds, status });
  },

  async atualizarAlerta({ unidadeId, id, status }) {
    const validStatuses = ['ABERTO', 'EM_ANALISE', 'TRATADO', 'DESCARTADO'];
    if (!validStatuses.includes(status)) return { ok: false, error: 'Status inválido' };
    const updated = await AlertaModel.updateStatus({ id, unidadeId, status });
    return updated ? { ok: true } : { ok: false, error: 'Alerta não encontrado' };
  },
```

- [ ] **Step 5: Controllers + routes**

Add `parseBody` to this file's existing `import { json } from '../utils/http.js';` line, making it `import { json, parseBody } from '../utils/http.js';`, then add:

```javascript
export async function getAlertas(_request, response, { session, url }) {
  const status = url.searchParams.get('status');
  const setorIds = scopedSectorIds(session, url);
  const rows = await SupervisorAnalyticsService.alertas({ unidadeId: session.unitId, setorIds, status });
  json(response, 200, { alertas: rows });
}

export async function patchAlerta(request, response, { session, url }) {
  const id = url.pathname.split('/').pop();
  const body = await parseBody(request);
  const result = await SupervisorAnalyticsService.atualizarAlerta({ unidadeId: session.unitId, id, status: body.status });
  json(response, result.ok ? 200 : 422, result);
}
```

`server/routes/api-routes.js` — the router is a `Map` keyed by exact `"METHOD /path"`, which doesn't support `:id` path params. Add a dedicated check before the `Map` lookup in `handleApi` for this one parametric route:

```javascript
import { getIndices, getComparativo, getParticipacao, getAlertas, patchAlerta } from '../controllers/supervisor-controller.js';
```

```javascript
  ['GET /api/v1/supervisor/indices', authorize(['SUPERVISOR'], getIndices)],
  ['GET /api/v1/supervisor/comparativo', authorize(['SUPERVISOR'], getComparativo)],
  ['GET /api/v1/supervisor/participacao', authorize(['SUPERVISOR'], getParticipacao)],
  ['GET /api/v1/supervisor/alertas', authorize(['SUPERVISOR'], getAlertas)],
```

and in `handleApi`, before `const controller = routes.get(...)`:

```javascript
export async function handleApi(request, response, url) {
  if (request.method === 'PATCH' && url.pathname.startsWith('/api/v1/supervisor/alertas/')) {
    return asyncController(authorize(['SUPERVISOR'], patchAlerta))(request, response, { url });
  }
  const controller = routes.get(`${request.method} ${url.pathname}`);
  if (!controller) return json(response, 404, { error: 'Rota não encontrada' });
  return asyncController(controller)(request, response, { url });
}
```

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

---

## Task 10: Motor de análise e planos de ação + `GET /analises`, `GET`/`PATCH /planos-acao`

**Files:**
- Create: `src/domain/analise-planos.js`
- Test: `test/analise-planos.test.js`
- Create: `server/models/analise-model.js`
- Create: `server/models/plano-acao-model.js`
- Modify: `server/services/supervisor-analytics-service.js`
- Modify: `server/controllers/supervisor-controller.js`
- Modify: `server/routes/api-routes.js`
- Modify: `server/services/dashboard-service.js` (drop the hardcoded `simulatedAnalysis`, call the real engine — closes the last item from Task 2's TODO)

**Interfaces:**
- Produces: `gerarAnalise({ setorNome, turnoNome, historico, comparacao, alertasAbertos, hr })` → the 7-part object from `SPEC-ADICIONAL.md` §2.5, tagged `versaoMotor: 'v1'`.

- [ ] **Step 1: Write the failing test**

`test/analise-planos.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarAnalise } from '../src/domain/analise-planos.js';

function base() {
  return {
    setorNome: 'Desossa', turnoNome: 'Manhã',
    historico: [
      { calculavel: true, score: 55, status: 'AMARELO', totalRespostas: 20, confiabilidade: 'ALTA' },
      { calculavel: true, score: 68, status: 'AMARELO', totalRespostas: 22, confiabilidade: 'ALTA' },
    ],
    comparacao: { comparavel: true, tendencia: 'PIORA', variacaoFisicoPercentual: 0.2, variacaoFaltasPercentual: 0.18 },
    alertasAbertos: [{ regra: 'DESGASTE_E_FALTAS', motivo: 'Aumento simultâneo de desgaste e faltas' }],
    hr: { faltas: 6, afastamentos: 1 },
  };
}

test('produz os 7 elementos exigidos pelo spec', () => {
  const analise = gerarAnalise(base());
  assert.equal(typeof analise.resumo, 'string');
  assert.ok(analise.evidencias.length > 0);
  assert.ok(analise.correlacoes.length > 0);
  assert.ok(['BAIXA', 'MODERADA', 'ALTA'].includes(analise.nivelAtencao));
  assert.ok(analise.acoesSugeridas.length >= 1 && analise.acoesSugeridas.length <= 3);
  assert.ok(analise.indicadoresAcompanhar.length > 0);
  assert.match(analise.aviso, /apoia|apoio/i);
  assert.equal(analise.versaoMotor, 'v1');
});

test('correlações nunca afirmam causalidade', () => {
  const analise = gerarAnalise(base());
  for (const correlacao of analise.correlacoes) {
    assert.doesNotMatch(correlacao, /caus/i);
  }
});

test('nível de atenção ALTA quando há alerta vermelho aberto', () => {
  const cenario = base();
  cenario.alertasAbertos = [{ regra: 'INDICE_VERMELHO', motivo: 'Índice em faixa vermelha' }];
  cenario.historico[0] = { calculavel: true, score: 40, status: 'VERMELHO', totalRespostas: 20, confiabilidade: 'ALTA' };
  const analise = gerarAnalise(cenario);
  assert.equal(analise.nivelAtencao, 'ALTA');
});

test('sem alertas e tendência de melhora, nível BAIXA', () => {
  const cenario = base();
  cenario.alertasAbertos = [];
  cenario.comparacao = { comparavel: true, tendencia: 'MELHORA', variacaoFisicoPercentual: -0.1, variacaoFaltasPercentual: -0.1 };
  cenario.historico = [
    { calculavel: true, score: 85, status: 'VERDE', totalRespostas: 20, confiabilidade: 'ALTA' },
    { calculavel: true, score: 78, status: 'VERDE', totalRespostas: 20, confiabilidade: 'ALTA' },
  ];
  const analise = gerarAnalise(cenario);
  assert.equal(analise.nivelAtencao, 'BAIXA');
});
```

- [ ] **Step 2: Confirm it fails, then implement**

Run: `node --test test/analise-planos.test.js` → FAIL.

`src/domain/analise-planos.js`:

```javascript
const ACOES_POR_MOTIVO = {
  DESGASTE_E_FALTAS: 'Reforçar pausas e avaliar rodízio de postos no setor',
  QUEDA_ENERGIA: 'Observar ritmo operacional e reforçar orientação ergonômica',
  AUMENTO_DOR_OU_ESTRESSE: 'Realizar escuta coletiva e revisar pausas do turno',
  INDICE_VERMELHO: 'Solicitar análise técnica do SESMT para o setor/turno',
  AMARELO_CONSECUTIVO: 'Acompanhar de perto os próximos períodos antes de escalar',
  AMOSTRA_REDUZIDA: 'Reforçar divulgação do totem para ampliar a amostra',
};

function nivelAtencao({ alertasAbertos, historico }) {
  if (alertasAbertos.some((alerta) => alerta.regra === 'INDICE_VERMELHO')) return 'ALTA';
  const atual = historico[0];
  if (atual?.status === 'VERMELHO') return 'ALTA';
  if (alertasAbertos.length > 0 || atual?.status === 'AMARELO') return 'MODERADA';
  return 'BAIXA';
}

export function gerarAnalise({ setorNome, turnoNome, historico, comparacao, alertasAbertos, hr }) {
  const atual = historico[0];
  const nivel = nivelAtencao({ alertasAbertos, historico });

  const evidencias = [
    atual?.calculavel
      ? `Índice atual de ${setorNome} (${turnoNome}): ${atual.score} (${atual.status}), amostra ${atual.confiabilidade.toLowerCase()}`
      : `Amostra insuficiente para calcular o índice atual de ${setorNome} (${turnoNome})`,
    `Faltas agregadas no período: ${hr.faltas}; afastamentos agregados: ${hr.afastamentos}`,
    ...alertasAbertos.map((alerta) => `Alerta aberto: ${alerta.motivo}`),
  ];

  const correlacoes = [];
  if (comparacao.comparavel && comparacao.variacaoFisicoPercentual > 0 && comparacao.variacaoFaltasPercentual > 0) {
    correlacoes.push('Há associação entre o aumento de dor/cansaço e o aumento de faltas no mesmo período, sem indicar causalidade.');
  }
  if (comparacao.comparavel) {
    correlacoes.push(`Os dados coincidem com uma tendência geral de ${comparacao.tendencia.toLowerCase()} frente ao período anterior.`);
  } else {
    correlacoes.push('Sem período anterior comparável, a leitura de tendência fica limitada a este período isolado.');
  }

  const acoesSugeridas = [...new Set(alertasAbertos.map((alerta) => ACOES_POR_MOTIVO[alerta.regra]).filter(Boolean))]
    .slice(0, 3);
  if (acoesSugeridas.length === 0) {
    acoesSugeridas.push('Manter o acompanhamento de rotina do setor/turno');
  }

  return {
    resumo: `${setorNome} (${turnoNome}) está em nível de atenção ${nivel.toLowerCase()}, com ${alertasAbertos.length} alerta(s) aberto(s).`,
    evidencias,
    correlacoes,
    nivelAtencao: nivel,
    acoesSugeridas,
    indicadoresAcompanhar: ['Energia', 'Dor/cansaço físico', 'Ansiedade/estresse', 'Faltas', 'Afastamentos'],
    aviso: 'Esta análise apoia decisões da liderança e não constitui diagnóstico individual.',
    versaoMotor: 'v1',
  };
}
```

Run: `node --test test/analise-planos.test.js` → PASS (4 tests).

- [ ] **Step 3: `server/models/analise-model.js` and `server/models/plano-acao-model.js`**

```javascript
// server/models/analise-model.js
import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, execute } from '../config/database.js';

export const AnaliseModel = {
  async upsert({ unidadeId, setorId, turnoId, periodicidade, dataPeriodo, analise }) {
    const now = new Date().toISOString();
    await execute(`
      INSERT INTO analises_periodicas(
        id, unidade_id, setor_id, turno_id, periodicidade, data_periodo, versao_motor,
        resumo, evidencias, correlacoes, nivel_atencao, indicadores_acompanhar, gerado_em
      ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (unidade_id, setor_id, turno_id, periodicidade, data_periodo)
      DO UPDATE SET resumo = $8, evidencias = $9, correlacoes = $10, nivel_atencao = $11,
        indicadores_acompanhar = $12, gerado_em = $13
    `, [
      randomUUID(), unidadeId, setorId, turnoId, periodicidade, dataPeriodo, analise.versaoMotor,
      analise.resumo, JSON.stringify(analise.evidencias), JSON.stringify(analise.correlacoes),
      analise.nivelAtencao, JSON.stringify(analise.indicadoresAcompanhar), now,
    ]);
    return queryOne(`
      SELECT * FROM analises_periodicas
      WHERE unidade_id = $1 AND setor_id = $2 AND turno_id = $3 AND periodicidade = $4 AND data_periodo = $5
    `, [unidadeId, setorId, turnoId, periodicidade, dataPeriodo]);
  },

  listByUnit({ unidadeId, periodicidade, setorIds }) {
    const clauses = ['unidade_id = $1', 'periodicidade = $2'];
    const params = [unidadeId, periodicidade];
    if (setorIds) {
      params.push(setorIds);
      clauses.push(`setor_id = ANY($${params.length})`);
    }
    return queryAll(`
      SELECT a.*, s.name AS setor_nome, sh.name AS turno_nome
      FROM analises_periodicas a
      JOIN sectors s ON s.id = a.setor_id
      JOIN shifts sh ON sh.id = a.turno_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY a.data_periodo DESC
    `, params);
  },
};
```

```javascript
// server/models/plano-acao-model.js
import { randomUUID } from 'node:crypto';
import { queryAll, queryOne, execute, pool } from '../config/database.js';

export const PlanoAcaoModel = {
  async createFromAnalise({ analiseId, unidadeId, setorId, turnoId, acoes }) {
    const client = await pool.connect();
    const now = new Date().toISOString();
    const planoId = randomUUID();
    try {
      await client.query('BEGIN');
      await client.query(`
        INSERT INTO planos_acao(id, analise_id, unidade_id, setor_id, turno_id, status, criado_em, atualizado_em)
        VALUES($1, $2, $3, $4, $5, 'PENDENTE', $6, $6)
      `, [planoId, analiseId, unidadeId, setorId, turnoId, now]);
      let ordem = 1;
      for (const descricao of acoes) {
        await client.query(`
          INSERT INTO acoes_plano(id, plano_id, descricao, ordem, status)
          VALUES($1, $2, $3, $4, 'PENDENTE')
        `, [randomUUID(), planoId, descricao, ordem]);
        ordem += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return planoId;
  },

  listByUnit({ unidadeId, setorIds }) {
    const clauses = ['p.unidade_id = $1'];
    const params = [unidadeId];
    if (setorIds) {
      params.push(setorIds);
      clauses.push(`p.setor_id = ANY($${params.length})`);
    }
    return queryAll(`
      SELECT p.*, s.name AS setor_nome, sh.name AS turno_nome,
        COALESCE(json_agg(json_build_object('id', ap.id, 'descricao', ap.descricao, 'ordem', ap.ordem, 'status', ap.status)
          ORDER BY ap.ordem) FILTER (WHERE ap.id IS NOT NULL), '[]') AS acoes
      FROM planos_acao p
      JOIN sectors s ON s.id = p.setor_id
      JOIN shifts sh ON sh.id = p.turno_id
      LEFT JOIN acoes_plano ap ON ap.plano_id = p.id
      WHERE ${clauses.join(' AND ')}
      GROUP BY p.id, s.name, sh.name
      ORDER BY p.criado_em DESC
    `, params);
  },

  async updateStatus({ id, unidadeId, status }) {
    const rowCount = await execute(`
      UPDATE planos_acao SET status = $1, atualizado_em = $2
      WHERE id = $3 AND unidade_id = $4
    `, [status, new Date().toISOString(), id, unidadeId]);
    return rowCount > 0;
  },
};
```

- [ ] **Step 4: Wire into `SupervisorAnalyticsService`**

Add to `server/services/supervisor-analytics-service.js`:

```javascript
import { gerarAnalise } from '../../src/domain/analise-planos.js';
import { AnaliseModel } from '../models/analise-model.js';
import { PlanoAcaoModel } from '../models/plano-acao-model.js';
import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { ShiftModel } from '../models/shift-model.js';
```

```javascript
  async gerarAnaliseEPlano({ unidadeId, setorId, turnoId, periodicidade, dataPeriodo }) {
    const [setor, turno, config] = await Promise.all([
      SectorModel.findActiveInUnit(setorId, unidadeId),
      ShiftModel.findInUnit(turnoId, unidadeId),
      ConfigModel.getForUnit(unidadeId),
    ]);
    await IndiceSetorService.calcularEArmazenar({ unidadeId, setorId, turnoId, tipoPeriodo: periodicidade === 'SEMANAL' ? 'SEMANAL' : 'MENSAL', dataPeriodo });
    const historicoRows = await IndiceSetorModel.listHistory({
      unidadeId, setorId, turnoId, tipoPeriodo: periodicidade === 'SEMANAL' ? 'SEMANAL' : 'MENSAL', limit: 2,
    });
    const historico = historicoRows.map((row) => row.detalhe);
    const comparacao = historico[1] ? compararPeriodos(historico[0], historico[1], config) : { comparavel: false };
    const alertasAbertos = await AlertaModel.listByUnit({ unidadeId, setorIds: [setorId], status: 'ABERTO' });
    const hrRows = await HrIndicatorModel.listRecent({ unitId: unidadeId, sectorId: setorId, limit: 1 });
    const hr = hrRows[0] ? { faltas: hrRows[0].absences, afastamentos: hrRows[0].leaves } : { faltas: 0, afastamentos: 0 };

    const analise = gerarAnalise({
      setorNome: setor.name, turnoNome: turno.name, historico, comparacao,
      alertasAbertos: alertasAbertos.map((alerta) => ({ regra: alerta.regra, motivo: alerta.motivo })),
      hr,
    });

    const stored = await AnaliseModel.upsert({ unidadeId, setorId, turnoId, periodicidade, dataPeriodo, analise });
    await PlanoAcaoModel.createFromAnalise({
      analiseId: stored.id, unidadeId, setorId, turnoId, acoes: analise.acoesSugeridas,
    });
    return stored;
  },

  async analises({ unidadeId, periodicidade, setorIds }) {
    return AnaliseModel.listByUnit({ unidadeId, periodicidade, setorIds });
  },

  async planosAcao({ unidadeId, setorIds }) {
    return PlanoAcaoModel.listByUnit({ unidadeId, setorIds });
  },

  async atualizarPlanoAcao({ unidadeId, id, status }) {
    const validStatuses = ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'DESCARTADO'];
    if (!validStatuses.includes(status)) return { ok: false, error: 'Status inválido' };
    const updated = await PlanoAcaoModel.updateStatus({ id, unidadeId, status });
    return updated ? { ok: true } : { ok: false, error: 'Plano não encontrado' };
  },
```

`compararPeriodos` is already imported at the top of the file from Task 9 (`import { compararPeriodos } from '../../src/domain/comparacao-temporal.js';`) — this task's `gerarAnaliseEPlano()` reuses that same import, alongside `indices()` from Task 9.

- [ ] **Step 5: Controllers + routes**

Add to `server/controllers/supervisor-controller.js`:

```javascript
export async function getAnalises(_request, response, { session, url }) {
  const periodicidade = url.searchParams.get('periodicidade') === 'mensal' ? 'MENSAL' : 'SEMANAL';
  const setorIds = scopedSectorIds(session, url);
  const rows = await SupervisorAnalyticsService.analises({ unidadeId: session.unitId, periodicidade, setorIds });
  json(response, 200, { analises: rows });
}

export async function getPlanosAcao(_request, response, { session, url }) {
  const setorIds = scopedSectorIds(session, url);
  const rows = await SupervisorAnalyticsService.planosAcao({ unidadeId: session.unitId, setorIds });
  json(response, 200, { planos: rows });
}

export async function patchPlanoAcao(request, response, { session, url }) {
  const id = url.pathname.split('/').pop();
  const body = await parseBody(request);
  const result = await SupervisorAnalyticsService.atualizarPlanoAcao({ unidadeId: session.unitId, id, status: body.status });
  json(response, result.ok ? 200 : 422, result);
}
```

(add `parseBody` to this file's existing `import { json } from '../utils/http.js';` line, making it `import { json, parseBody } from '../utils/http.js';`.)

`server/routes/api-routes.js`:

```javascript
  ['GET /api/v1/supervisor/analises', authorize(['SUPERVISOR'], getAnalises)],
  ['GET /api/v1/supervisor/planos-acao', authorize(['SUPERVISOR'], getPlanosAcao)],
```

and extend the parametric-route check in `handleApi`:

```javascript
export async function handleApi(request, response, url) {
  if (request.method === 'PATCH' && url.pathname.startsWith('/api/v1/supervisor/alertas/')) {
    return asyncController(authorize(['SUPERVISOR'], patchAlerta))(request, response, { url });
  }
  if (request.method === 'PATCH' && url.pathname.startsWith('/api/v1/supervisor/planos-acao/')) {
    return asyncController(authorize(['SUPERVISOR'], patchPlanoAcao))(request, response, { url });
  }
  const controller = routes.get(`${request.method} ${url.pathname}`);
  if (!controller) return json(response, 404, { error: 'Rota não encontrada' });
  return asyncController(controller)(request, response, { url });
}
```

- [ ] **Step 6: Replace the dashboard's hardcoded `simulatedAnalysis` with a real weekly read**

`server/services/dashboard-service.js` — full replacement:

```javascript
import { HrIndicatorModel } from '../models/hr-indicator-model.js';
import { ResponseModel } from '../models/response-model.js';
import { AnaliseModel } from '../models/analise-model.js';

function fallbackAnalysis() {
  return {
    attention: 'BAIXA',
    title: 'Ainda sem análise semanal gerada para este setor',
    summary: 'Assim que houver amostra suficiente, a análise semanal aparecerá aqui.',
    actions: [],
    monthly: 'Análise mensal ainda não gerada para este setor.',
  };
}

export const DashboardService = {
  async get({ unitId, sectorId, days = 30 }) {
    const [series, latest, sectorSummary, hr, analisesSemanal] = await Promise.all([
      ResponseModel.getSeries({ unitId, sectorId, days }),
      ResponseModel.getTodayBySector(unitId),
      ResponseModel.getMonthlyBySector(unitId),
      HrIndicatorModel.listRecent({ unitId, sectorId }),
      AnaliseModel.listByUnit({ unidadeId: unitId, periodicidade: 'SEMANAL', setorIds: sectorId && sectorId !== 'all' ? [sectorId] : null }),
    ]);
    const maisRecente = analisesSemanal[0];
    const analysis = maisRecente ? {
      attention: maisRecente.nivel_atencao,
      title: `Análise de ${maisRecente.setor_nome} (${maisRecente.turno_nome})`,
      summary: maisRecente.resumo,
      actions: maisRecente.evidencias,
      monthly: maisRecente.resumo,
    } : fallbackAnalysis();
    return { series, latest, sectorSummary, hr, analysis };
  },
};
```

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS.

---

## Task 11: Totem idempotency (`requisicoes_totem`)

**Files:**
- Modify: `server/models/response-model.js` (add idempotency check inside the same transaction)
- Modify: `server/services/totem-service.js`
- Modify: `server/controllers/totem-controller.js`
- Modify: `web/src/features/totem/Totem.jsx`
- Test: `test/totem-idempotency.test.js`

**Interfaces:**
- `ResponseModel.incrementAnswers` gains a required `idempotencyKey` field; `TotemService.record` accepts and forwards it; the frontend generates one `crypto.randomUUID()` per submit attempt (not per worker — the value is discarded after the request settles).

- [ ] **Step 1: Write the failing test**

`test/totem-idempotency.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TotemService } from '../server/services/totem-service.js';
import { ResponseModel } from '../server/models/response-model.js';

test('reenviar a mesma idempotency key não duplica os contadores', async () => {
  const key = randomUUID();
  const before = await ResponseModel.getTodayBySector('u1');
  const totalBefore = before.filter((row) => row.id === 's1').reduce((sum, row) => sum + Number(row.responses || 0), 0);

  const answers = { ENERGY: 4, PHYSICAL: 2, STRESS: 2 };
  const first = await TotemService.record('u1', { sectorId: 's1', answers, idempotencyKey: key });
  const second = await TotemService.record('u1', { sectorId: 's1', answers, idempotencyKey: key });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const after = await ResponseModel.getTodayBySector('u1');
  const totalAfter = after.filter((row) => row.id === 's1').reduce((sum, row) => sum + Number(row.responses || 0), 0);
  assert.equal(totalAfter - totalBefore, 3);
});

test('duas tentativas com chaves diferentes incrementam normalmente', async () => {
  const answers = { ENERGY: 3, PHYSICAL: 3, STRESS: 3 };
  const before = await ResponseModel.getTodayBySector('u1');
  const totalBefore = before.filter((row) => row.id === 's2').reduce((sum, row) => sum + Number(row.responses || 0), 0);

  await TotemService.record('u1', { sectorId: 's2', answers, idempotencyKey: randomUUID() });
  await TotemService.record('u1', { sectorId: 's2', answers, idempotencyKey: randomUUID() });

  const after = await ResponseModel.getTodayBySector('u1');
  const totalAfter = after.filter((row) => row.id === 's2').reduce((sum, row) => sum + Number(row.responses || 0), 0);
  assert.equal(totalAfter - totalBefore, 6);
});
```

- [ ] **Step 2: Confirm it fails**

Run: `node --test test/totem-idempotency.test.js`
Expected: FAIL — `TotemService.record` currently ignores `idempotencyKey` and both calls increment, so the first assertion (`totalAfter - totalBefore === 3`) fails with `6`.

- [ ] **Step 3: Implement — `response-model.js`**

Replace `incrementAnswers` in `server/models/response-model.js`:

```javascript
  async incrementAnswers({ unitId, sectorId, shiftId, date, answers, idempotencyKey }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(`
        INSERT INTO requisicoes_totem(unidade_id, idempotency_key, criado_em)
        VALUES($1, $2, $3)
        ON CONFLICT (unidade_id, idempotency_key) DO NOTHING
      `, [unitId, idempotencyKey, new Date().toISOString()]);
      if (inserted.rowCount === 0) {
        await client.query('COMMIT');
        return;
      }
      for (const [metric, score] of Object.entries(answers)) {
        await client.query(`
          INSERT INTO responses VALUES($1, $2, $3, $4, $5, $6, $7, 1)
          ON CONFLICT (unit_id, sector_id, shift_id, response_date, metric, score)
          DO UPDATE SET quantity = responses.quantity + 1
        `, [randomUUID(), unitId, sectorId, shiftId, date, metric, score]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
```

- [ ] **Step 4: `totem-service.js`**

Update `record`:

```javascript
  async record(unitId, { sectorId, answers, idempotencyKey }) {
    const validAnswers = answers && METRICS.every((metric) =>
      Number.isInteger(answers[metric]) && answers[metric] >= 1 && answers[metric] <= 5);
    if (!sectorId || !validAnswers || !idempotencyKey) {
      return { ok: false, error: 'Responda as três perguntas' };
    }
    if (!(await SectorModel.findActiveInUnit(sectorId, unitId))) {
      return { ok: false, error: 'Setor inválido' };
    }
    const shift = await findCurrentShift(unitId);
    await ResponseModel.incrementAnswers({
      unitId, sectorId, shiftId: shift.id, date: dateKey(), answers, idempotencyKey,
    });
    return { ok: true };
  },
```

`server/controllers/totem-controller.js` needs no change — it already forwards the whole parsed body to `TotemService.record`.

- [ ] **Step 5: Frontend — generate and send the key**

`web/src/features/totem/Totem.jsx` — change the `answer` function:

```javascript
  async function answer(score) {
    const next = { ...answers, [questions[step].key]: score };
    setAnswers(next);
    if (step < 2) return setStep(step + 1);
    await api('/api/totem/responses', {
      method: 'POST',
      body: JSON.stringify({ sectorId: sector.id, answers: next, idempotencyKey: crypto.randomUUID() }),
    }, auth.token);
    setSent(true);
    setTimeout(() => { setSector(); setStep(0); setAnswers({}); setSent(false); }, 2200);
  }
```

- [ ] **Step 6: Run it and confirm it passes**

Run: `node --test test/totem-idempotency.test.js`
Expected: PASS (2 tests).

Run: `npm test`
Expected: full suite PASS.

---

## Task 12: Concurrency test — parallel totem submissions never lose a count

**Files:**
- Test: `test/totem-concurrency.test.js`

**Interfaces:** none new — this exercises Task 11's transaction under real parallelism, satisfying the spec's explicit acceptance criterion ("envios concorrentes não perdem incrementos").

- [ ] **Step 1: Write the test**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { TotemService } from '../server/services/totem-service.js';
import { ResponseModel } from '../server/models/response-model.js';

test('20 envios simultâneos ao mesmo setor não perdem incrementos', async () => {
  const before = await ResponseModel.getTodayBySector('u1');
  const totalBefore = before.filter((row) => row.id === 's3').reduce((sum, row) => sum + Number(row.responses || 0), 0);

  const answers = { ENERGY: 5, PHYSICAL: 1, STRESS: 1 };
  await Promise.all(Array.from({ length: 20 }, () =>
    TotemService.record('u1', { sectorId: 's3', answers, idempotencyKey: randomUUID() })));

  const after = await ResponseModel.getTodayBySector('u1');
  const totalAfter = after.filter((row) => row.id === 's3').reduce((sum, row) => sum + Number(row.responses || 0), 0);
  assert.equal(totalAfter - totalBefore, 60);
});
```

- [ ] **Step 2: Run it**

Run: `node --test test/totem-concurrency.test.js`
Expected: PASS. (This is why `incrementAnswers` uses a real transaction with `ON CONFLICT ... DO UPDATE SET quantity = quantity + 1` rather than read-then-write — the database serializes the conflicting upserts, so no race is possible even under real parallel connections.)

---

## Task 13: Frontend — índice, comparação, alertas and plano de ação on the supervisor screens

**Files:**
- Modify: `web/src/api/client.js` (no change needed — generic `api()` already supports any path)
- Modify: `web/src/features/dashboard/Dashboard.jsx`
- Modify: `web/src/features/dashboard/SectorIndicators.jsx`
- Modify: `web/src/features/dashboard/MonthlyAnalysis.jsx`

**Interfaces:**
- Consumes: `GET /api/v1/supervisor/indices`, `/comparativo`, `/participacao`, `/alertas`, `PATCH /alertas/:id`, `GET /analises`, `GET`/`PATCH /planos-acao` from Tasks 8-10.

- [ ] **Step 1: Dashboard — índice card, alertas panel, comparação**

Add to `web/src/features/dashboard/Dashboard.jsx`, inside the component (after the existing `data`/`meta` fetch effects), a new fetch for indices/alerts scoped to the selected sector+turno (use the first shift as a sane default when "all sectors" is selected, matching how the rest of the dashboard already reduces the multi-sector view):

```javascript
  const [analytics, setAnalytics] = useState();
  useEffect(() => {
    if (!meta?.shifts?.length) return;
    const turno = meta.shifts[0].id;
    Promise.all([
      api(`/api/v1/supervisor/indices?turno=${turno}${sector !== 'all' ? `&setor=${sector}` : ''}`, {}, auth.token),
      api('/api/v1/supervisor/alertas?status=ABERTO', {}, auth.token),
    ]).then(([indicesRes, alertasRes]) => setAnalytics({ indices: indicesRes.indices, alertas: alertasRes.alertas }));
  }, [auth.token, meta, sector]);
```

Add a new section right after the existing `<section className="metrics">` block (before `<section className="grid">`):

```jsx
    {analytics && <section className="grid">
      <article className="card">
        <header><div><span className="overline">ÍNDICE DE ATENÇÃO</span><h2>Setores monitorados</h2></div></header>
        <div className="sector-table">
          <div className="sector-table-head"><span>Setor</span><span>Índice</span><span>Status</span><span>Amostra</span></div>
          {analytics.indices.map((row) => <div className="sector-table-row" key={row.id}>
            <strong>{row.setor_id}</strong>
            <span>{row.score ?? '—'}</span>
            <span className={row.status ? row.status.toLowerCase() : 'inconclusivo'}>{row.status || row.confiabilidade}</span>
            <span>{row.total_respostas} respostas ({row.confiabilidade.toLowerCase()})</span>
          </div>)}
        </div>
      </article>
      <article className="card">
        <header><div><span className="overline">ALERTAS ATIVOS</span><h2>{analytics.alertas.length} em aberto</h2></div></header>
        {analytics.alertas.length === 0 && <p>Nenhum alerta aberto no momento.</p>}
        {analytics.alertas.map((alerta) => <div className="action" key={alerta.id}>
          <span>{alerta.nivel}</span>{alerta.motivo} — {alerta.setor_nome} ({alerta.turno_nome})
        </div>)}
      </article>
    </section>}
```

- [ ] **Step 2: `SectorIndicators.jsx` — real índice column, sortable by attention**

Full replacement:

```jsx
import { CalendarDays } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { buildSectorRows } from './sector-utils.js';

export function SectorIndicators({ auth }) {
  const [data, setData] = useState();
  const [meta, setMeta] = useState();
  const [indices, setIndices] = useState([]);
  useEffect(() => { api('/api/dashboard?days=30', {}, auth.token).then(setData); }, [auth.token]);
  useEffect(() => { api('/api/meta', {}, auth.token).then(setMeta); }, [auth.token]);
  useEffect(() => {
    if (!meta?.shifts?.length) return;
    api(`/api/v1/supervisor/indices?turno=${meta.shifts[0].id}`, {}, auth.token).then((res) => setIndices(res.indices));
  }, [auth.token, meta]);
  if (!data || !meta) return <div className="loading">Carregando indicadores…</div>;

  const indiceBySector = Object.fromEntries(indices.map((row) => [row.setor_id, row]));
  const rows = buildSectorRows(data.sectorSummary)
    .map((row) => ({ ...row, indice: indiceBySector[row.id] }))
    .sort((a, b) => (a.indice?.score ?? 100) - (b.indice?.score ?? 100));

  return <div className="content"><header className="page-head"><div><span className="overline">INDICADORES POR SETOR</span><h1>Saúde das equipes</h1><p>Comparativo dos últimos 30 dias por área e setor, ordenado por nível de atenção.</p></div><div className="period-badge"><CalendarDays />Últimos 30 dias</div></header>
    {['QUENTE', 'FRIA'].map((category) => <section className="sector-report" key={category}><header><div><span className={`area-mark ${category.toLowerCase()}`} /><div><span className="overline">{category === 'QUENTE' ? 'ÁREA QUENTE' : 'ÁREA FRIA'}</span><h2>{category === 'QUENTE' ? 'Processamento inicial' : 'Processamento e expedição'}</h2></div></div><span>{rows.filter((row) => row.category === category).length} setores</span></header>
      <div className="sector-table"><div className="sector-table-head"><span>Setor</span><span>Energia</span><span>Dor / cansaço</span><span>Estresse</span><span>Índice de atenção</span><span>Amostra</span></div>
        {rows.filter((row) => row.category === category).map((row) => <div className="sector-table-row" key={row.id}>
          <strong>{row.name}</strong><span>{row.ENERGY?.toFixed(1) || '—'}</span><span>{row.PHYSICAL?.toFixed(1) || '—'}</span><span>{row.STRESS?.toFixed(1) || '—'}</span>
          <span><b className={row.indice?.status ? row.indice.status.toLowerCase() : 'watch'}>{row.indice?.score ?? '—'}</b></span>
          <span>{row.indice ? `${row.indice.total_respostas} (${row.indice.confiabilidade.toLowerCase()})` : '—'}</span>
        </div>)}
      </div></section>)}
  </div>;
}
```

- [ ] **Step 3: `MonthlyAnalysis.jsx` — real plano de ação with status editing**

Add fetch + update handler, and replace the static `.correlation` blocks with the real plan list. Add near the top of the component:

```javascript
  const [planos, setPlanos] = useState([]);
  useEffect(() => { api('/api/v1/supervisor/planos-acao', {}, auth.token).then((res) => setPlanos(res.planos)); }, [auth.token]);

  async function atualizarStatus(planoId, status) {
    await api(`/api/v1/supervisor/planos-acao/${planoId}`, { method: 'PATCH', body: JSON.stringify({ status }) }, auth.token);
    setPlanos((current) => current.map((plano) => (plano.id === planoId ? { ...plano, status } : plano)));
  }
```

Add a new section after the existing `<section className="monthly-layout">` block:

```jsx
    <section className="card ranking"><header><div><span className="overline">PLANOS DE AÇÃO</span><h2>Sugeridos pela análise determinística</h2></div></header>
      {planos.length === 0 && <p>Nenhum plano gerado ainda.</p>}
      {planos.map((plano) => <article key={plano.id}>
        <div><strong>{plano.setor_nome}</strong><small>{plano.turno_nome}</small>
          <ul>{plano.acoes.map((acao) => <li key={acao.id}>{acao.descricao}</li>)}</ul>
        </div>
        <select value={plano.status} onChange={(event) => atualizarStatus(plano.id, event.target.value)}>
          <option value="PENDENTE">Pendente</option>
          <option value="EM_ANDAMENTO">Em andamento</option>
          <option value="CONCLUIDO">Concluído</option>
          <option value="DESCARTADO">Descartado</option>
        </select>
      </article>)}
    </section>
```

- [ ] **Step 4: Build and manually verify in the browser**

Run: `npm run build`

This is the checkpoint described at the end of this plan — open the app in the browser here (Dashboard, Indicadores por Setor, Análise Mensal) and confirm: índice cards render with real scores/status, alerts list populates, sector table sorts by attention, and changing a plan's status via the dropdown persists (reload the page and confirm it stuck).

---

## Task 14: `README`/`ARCHITECTURE.md` refresh + final full-suite run

**Files:**
- Modify: `README.md`
- Modify: `ARCHITECTURE.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Update `ARCHITECTURE.md`'s "Backend Node.js" section**

Replace the `HTTP → Routes → ... → SQLite` diagram line and the "Configuração" section's SQLite-specific description with the Postgres equivalent (pool, migrations directory, `docker compose up -d db`), and add the new `/api/v1/supervisor/*` routes to the endpoints table. Also document the `src/domain/*.js` pure-calculation modules (`indice-atencao.js`, `comparacao-temporal.js`, `alertas.js`, `analise-planos.js`) and their role.

- [ ] **Step 2: Update `README.md`'s setup instructions**

Replace any SQLite-specific setup step with: `docker compose up -d db`, `npm install`, `npm run db:migrate`, `npm run dev` / `npm start`. Mention `npm run db:status` and `npm run db:rebuild` now operate on Postgres.

- [ ] **Step 3: Run the entire test suite one last time**

Run: `npm test`
Expected: every test file passes — `migrate.test.js`, `migrate-from-sqlite.test.js`, `database.test.js`, `mvc-services.test.js`, `validation.test.js`, `indice-atencao.test.js`, `comparacao-temporal.test.js`, `alertas.test.js`, `analise-planos.test.js`, `indice-setor-service.test.js`, `totem-idempotency.test.js`, `totem-concurrency.test.js`.

---

## After Task 13/14: the browser checkpoint and commits

Per the session's explicit instruction: **do not run `git commit` for any task above until the person has seen the app running in the browser (built-in browser pane) and explicitly approves.** The natural demo point is right after Task 13 (frontend wired) — at that point:

1. `npm run build && npm start`.
2. Open the app in the browser: log in as supervisor, show the Dashboard (índice card, alerts), Indicadores por Setor (sorted table), Análise Mensal (plan with editable status); also re-run the totem flow to confirm it still works untouched.
3. Walk through what changed, task by task, referencing this plan.
4. Only once the person approves, commit — either one commit per task (replaying the "Commit" steps implied by each task above, in order) or a small number of logical commits grouping them (e.g., one for the Postgres cutover, one for the analytics engine, one for the frontend) — ask which they prefer at that point.
