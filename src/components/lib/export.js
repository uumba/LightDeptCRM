import { daysBetween, calculateRentalPrice } from './calc';

function buildExportRows(rentals, equipment, clients) {
  return rentals.map((r) => {
    const days = daysBetween(r.start_date, r.end_date);
    const { basePrice, finalPrice } = calculateRentalPrice(r.items, days, r.discount);
    const client = clients.find((c) => c.id === r.client_id);
    return {
      'Rental ID': (r.id || '').slice(-8),
      Client: client?.name || '',
      'Start Date': new Date(r.start_date).toLocaleString(),
      'End Date': new Date(r.end_date).toLocaleString(),
      Days: days,
      Status: r.status,
      Items: (r.items || [])
        .map((i) => {
          const eq = equipment.find((e) => e.id === i.equipment_id);
          return `${eq?.name || 'Unknown'} (x${i.quantity} @ €${i.price_per_day}/day)`;
        })
        .join('; '),
      'Base Price': basePrice.toFixed(2),
      'Discount %': r.discount || 0,
      'Final Price': finalPrice.toFixed(2),
    };
  });
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRentals(rentals, equipment, clients, format, dateRange) {
  const rows = buildExportRows(rentals, equipment, clients);
  const stamp = `${dateRange?.start ? new Date(dateRange.start).toISOString().slice(0, 10) : 'all'}_to_${dateRange?.end ? new Date(dateRange.end).toISOString().slice(0, 10) : 'now'}`;

  if (format === 'csv') {
    if (rows.length === 0) {
      downloadBlob('No rentals found in selected date range', 'text/csv', `rentals_${stamp}.csv`);
      return;
    }
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        headers.map((h) => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    downloadBlob(csv, 'text/csv', `rentals_${stamp}.csv`);
  } else if (format === 'xls') {
    if (rows.length === 0) {
      downloadBlob(
        '<table><tr><td>No rentals found in selected date range</td></tr></table>',
        'application/vnd.ms-excel',
        `rentals_${stamp}.xls`
      );
      return;
    }
    const headers = Object.keys(rows[0]);
    let html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>';
    html += '<table border="1"><tr>';
    html += headers.map((h) => `<th style="background:#00C7D9;color:#fff;font-weight:bold">${h}</th>`).join('');
    html += '</tr>';
    rows.forEach((r) => {
      html += '<tr>';
      html += headers
        .map((h) => `<td>${String(r[h] ?? '').replace(/</g, '&lt;')}</td>`)
        .join('');
      html += '</tr>';
    });
    html += '</table></body></html>';
    downloadBlob(html, 'application/vnd.ms-excel', `rentals_${stamp}.xls`);
  }
}