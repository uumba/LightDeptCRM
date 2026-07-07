import { formatCurrency } from './calc';

export function printInventoryReport(equipment, categories) {
  const orderMap = {};
  (categories || []).forEach((c) => { orderMap[c.name] = c.sort_order ?? 999; });

  const groups = {};
  (equipment || []).forEach((item) => {
    const cat = item.category || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  const sortedCats = Object.keys(groups).sort((a, b) => (orderMap[a] ?? 999) - (orderMap[b] ?? 999));

  const today = new Date().toLocaleDateString('ru-RU');

  const categoryHtml = sortedCats.map((cat) => {
    const items = groups[cat];
    const rows = items.map((item, idx) => {
      const serial = item.has_serial
        ? (item.serial_number || '—')
        : `${item.quantity} units`;
      return `
        <tr>
          <td class="cb"><span class="checkbox"></span></td>
          <td>${idx + 1}</td>
          <td class="name">${item.name}</td>
          <td class="serial">${serial}</td>
          <td class="qty">${item.has_serial ? '1' : item.quantity}</td>
          <td class="notes"></td>
        </tr>`;
    }).join('');

    return `
      <div class="category-section">
        <h2>${cat} <span class="cat-count">(${items.length})</span></h2>
        <table>
          <thead>
            <tr>
              <th class="cb">✓</th>
              <th>#</th>
              <th class="name">Name</th>
              <th>Serial #</th>
              <th>Qty</th>
              <th class="notes">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Stock Check Report — ${today}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  .header { text-align: center; margin-bottom: 32px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
  .header h1 { font-size: 22px; margin: 0 0 4px; }
  .header .meta { font-size: 13px; color: #666; }
  .header .meta span { margin: 0 8px; }
  .signature { margin-top: 40px; display: flex; gap: 60px; font-size: 13px; }
  .signature div { flex: 1; }
  .signature .line { border-bottom: 1px solid #999; margin-top: 20px; padding-top: 4px; }
  .category-section { margin-bottom: 28px; page-break-inside: avoid; }
  .category-section h2 { font-size: 15px; background: #f0f0f0; padding: 6px 12px; margin: 0 0 0; border-radius: 4px 4px 0 0; border: 1px solid #ddd; border-bottom: none; }
  .cat-count { font-weight: normal; color: #777; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #ddd; }
  thead th { background: #fafafa; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; color: #555; }
  tbody td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  td.cb, th.cb { width: 32px; text-align: center; }
  .checkbox { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #555; border-radius: 2px; }
  td.name { font-weight: 500; }
  td.serial { font-family: monospace; font-size: 11px; color: #666; }
  td.qty, th:not(.name):not(.notes):not(.cb) { text-align: center; width: 50px; }
  td.notes, th.notes { width: 180px; }
  .sub-badge { display: inline-block; font-size: 10px; background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 3px; margin-left: 6px; vertical-align: middle; }
  @media print {
    body { padding: 16px; }
    .category-section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Stock Check Report</h1>
    <div class="meta">
      <span>Date: ${today}</span>
      <span>•</span>
      <span>Items: ${equipment.length}</span>
      <span>•</span>
      <span>Categories: ${sortedCats.length}</span>
    </div>
  </div>
  ${categoryHtml}
  <div class="signature">
    <div>
      <div>Checked by:</div>
      <div class="line">Signature / Name</div>
    </div>
    <div>
      <div>Date checked:</div>
      <div class="line"></div>
    </div>
  </div>
</body>
</html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}