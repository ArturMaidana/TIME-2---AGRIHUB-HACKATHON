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
