export function buildSectorRows(rows) {
  const map = {};
  for (const row of rows) {
    const item = map[row.id] ??= {
      id: row.id, name: row.name, category: row.category, responses: 0,
    };
    if (row.metric) {
      item[row.metric] = Number(row.average);
      item.responses = Math.max(item.responses, Number(row.responses || 0));
    }
  }
  return Object.values(map).map((item) => ({
    ...item,
    wellness: item.ENERGY
      ? (item.ENERGY + (6 - item.PHYSICAL) + (6 - item.STRESS)) / 3
      : 0,
  }));
}
