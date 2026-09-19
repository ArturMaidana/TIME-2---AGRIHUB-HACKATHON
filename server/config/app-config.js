export const appConfig = Object.freeze({
  port: Number(process.env.PORT || 3001),
  timezone: process.env.APP_TIMEZONE || 'America/Cuiaba',
  databasePath: process.env.DATABASE_PATH || null,
});
