import { daysBetween } from './calc';

export function printPickList(rental, client, equipment, categories) {
  const orderMap = {};
  (categories || []).forEach((c) => { orderMap[c.name] = c.sort_order ?? 999; });

  // Group items by category
  const groups = {};
  (rental.items || []).forEach((item) => {
    const eq = equipment.find((e) => e.id === item.equipment_id);
    const cat = eq?.category || 'Uncategorized';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ ...item, equipment: eq });
  });

  const sortedCats = Object.keys(groups).sort((a, b) => (orderMap[a] ?? 999) - (orderMap[b] ?? 999));

  const clientName = client?.name || 'Unknown';
  const today = new Date().toLocaleDateString();
  const startDate = new Date(rental.start_date).toLocaleDateString();
  const endDate = new Date(rental.end_date).toLocaleDateString();
  const days = daysBetween(rental.start_date, rental.end_date);
  const rentalId = (rental.id || '').slice(-8);

  const categoryHtml = sortedCats.map((cat) => {
    const items = groups[cat];
    const rows = items.map((item, idx) => {
      const eq = item.equipment;
      const serial = eq?.has_serial ? (eq.serial_number || '—') : '';
      return `
        <tr>
          <td class="cb"><span class="checkbox"></span></td>
          <td>${idx + 1}</td>
          <td class="name">${eq?.name || 'Unknown'}${eq?.is_subrental ? ' <span class="sub-badge">SUB</span>' : ''}</td>
          <td class="serial">${serial}</td>
          <td class="qty">${item.quantity}</td>
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
              <th class="name">Item</th>
              <th class="serial">Serial #</th>
              <th class="qty">Qty</th>
              <th class="notes">Notes</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');

  const totalItems = (rental.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pack List — ${clientName} — ${today}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, system-ui, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; }
  .header { margin-bottom: 24px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; }
  .header h1 { font-size: 22px; margin: 0 0 8px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 32px; font-size: 13px; }
  .info-grid .label { color: #777; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
  .info-grid .value { font-size: 14px; margin-bottom: 8px; }
  .status-badge { display: inline-block; font-size: 11px; font-weight: 600; text-transform: uppercase; padding: 2px 10px; border-radius: 3px; letter-spacing: 0.5px; }
  .status-active { background: #fef3c7; color: #92400e; }
  .status-reserved { background: #e0e7ff; color: #3730a3; }
  .status-completed { background: #d1fae5; color: #065f46; }
  .status-cancelled { background: #fee2e2; color: #991b1b; }
  .category-section { margin-bottom: 28px; page-break-inside: avoid; }
  .category-section h2 { font-size: 15px; background: #f0f0f0; padding: 6px 12px; margin: 0; border-radius: 4px 4px 0 0; border: 1px solid #ddd; border-bottom: none; }
  .cat-count { font-weight: normal; color: #777; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; border: 1px solid #ddd; }
  thead th { background: #fafafa; padding: 6px 8px; text-align: left; font-weight: 600; border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; color: #555; }
  tbody td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: middle; }
  tbody tr:last-child td { border-bottom: none; }
  td.cb, th.cb { width: 32px; text-align: center; }
  .checkbox { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #555; border-radius: 2px; }
  td.name { font-weight: 500; }
  td.serial { font-family: monospace; font-size: 11px; color: #666; }
  td.qty, th.qty { text-align: center; width: 50px; font-weight: 600; }
  td.notes, th.notes { width: 180px; }
  .sub-badge { display: inline-block; font-size: 10px; background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 3px; margin-left: 6px; vertical-align: middle; }
  .footer { margin-top: 40px; display: flex; gap: 60px; font-size: 13px; }
  .footer div { flex: 1; }
  .footer .line { border-bottom: 1px solid #999; margin-top: 20px; padding-top: 4px; }
  @media print {
    body { padding: 16px; }
    .category-section { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Pack List / Assembly Sheet</h1>
    <div class="info-grid">
      <div>
        <div class="label">Client</div>
        <div class="value">${clientName}</div>
      </div>
      <div>
        <div class="label">Rental ID</div>
        <div class="value">#${rentalId}</div>
      </div>
      <div>
        <div class="label">Dates</div>
        <div class="value">${startDate} — ${endDate} (${days} day${days !== 1 ? 's' : ''})</div>
      </div>
      <div>
        <div class="label">Status</div>
        <div class="value"><span class="status-badge status-${rental.status}">${rental.status}</span></div>
      </div>
      <div>
        <div class="label">Total Items</div>
        <div class="value">${totalItems}</div>
      </div>
      <div>
        <div class="label">Date Printed</div>
        <div class="value">${today}</div>
      </div>
    </div>
  </div>
  ${categoryHtml}
  <div class="footer">
    <div>
      <div>Picked by:</div>
      <div class="line">Signature / Name</div>
    </div>
    <div>
      <div>Checked by:</div>
      <div class="line">Signature / Name</div>
    </div>
  </div>
</body>
</html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}