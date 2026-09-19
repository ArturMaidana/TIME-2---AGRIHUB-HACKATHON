export const appConfig = Object.freeze({
  port: Number(process.env.PORT || 3001),
  timezone: process.env.APP_TIMEZONE || 'America/Cuiaba',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://agrihub:agrihub@localhost:5433/agrihub',
  databaseSsl: process.env.DATABASE_SSL === 'true',
});
