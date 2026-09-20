function escapeCsvField(value) {
  const str = String(value ?? '');
  if (/["\n\r,;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

export function downloadCsv(filename, content) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
