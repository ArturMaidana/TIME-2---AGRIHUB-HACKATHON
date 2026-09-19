import { appConfig } from '../config/app-config.js';

export function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: appConfig.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}
