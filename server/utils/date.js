import { appConfig } from '../config/app-config.js';

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: appConfig.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

// Calendar-day arithmetic anchored to dateKey() — never Postgres's CURRENT_DATE or
// the host machine's local time, both of which can disagree with appConfig.timezone
// (e.g. server in UTC, unit in America/Cuiaba: "today" differs for hours every day).
export function dateKeyOffset(daysAgo, referenceKey = dateKey()) {
  const reference = new Date(`${referenceKey}T00:00:00Z`);
  reference.setUTCDate(reference.getUTCDate() - daysAgo);
  return reference.toISOString().slice(0, 10);
}
