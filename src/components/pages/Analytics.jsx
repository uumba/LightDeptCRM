import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getEquipmentAnalytics, getSubrentalAnalytics, formatCurrency, formatNumber, daysInPeriod, getPeriodRange } from '@/lib/calc';
import SortableTable from '@/components/SortableTable';
import PeriodSelector from '@/components/PeriodSelector';
import SubrentalSection from '@/components/SubrentalSection';
import { Package, Download } from 'lucide-react';

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

function exportAnalyticsCSV(ownedRows, subrentalRows, periodDays) {
  const headers = ['Equipment', 'Type', 'Calendar Days', 'Item-Days', 'Revenue', 'Revenue/Day', 'Utilisation %', 'ROI %', 'Status', 'Avg Discount %'];
  const lines = [headers.join(',')];

  ownedRows.forEach((r) => {
    lines.push([
      `"${r.name}"`,
      'Owned',
      r.calendarDays,
      r.rentalDays,
      r.revenue.toFixed(2),
      r.revenuePerDay.toFixed(2),
      r.utilisation.toFixed(1),
      r.roi.toFixed(1),
      `"${r.status}"`,
      r.avgDiscount.toFixed(1),
    ].join(','));
  });

  subrentalRows.forEach((r) => {
    lines.push([
      `"${r.name}"`,
      'Sub-Rental',
      r.calendarDays,
      r.rentalDays,
      r.revenue.toFixed(2),
      (r.rentalDays > 0 ? r.revenue / r.rentalDays : 0).toFixed(2),
      r.utilisation.toFixed(1),
      r.marginPercentage.toFixed(1),
      r.netResult >= 0 ? 'Profit' : 'Loss',
      '0',
    ].join(','));
  });

  downloadBlob(lines.join('\n'), 'text/csv', `analytics_${periodDays}d_${new Date().toISOString().slice(0, 10)}.csv`);
}

export default function Analytics() {
  const [equipment, setEquipment] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({
    preset: '30d',
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [eq, rn] = await Promise.all([
          base44.entities.Equipment.list('-created_date', 500),
          base44.entities.Rental.list('-created_date', 500),
        ]);
        if (!mounted) return;
        setEquipment(eq);
        setRentals(rn);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const { start: periodStart, end: periodEnd } = getPeriodRange(period.preset, period.start, period.end);
  const periodDays = daysInPeriod(periodStart, periodEnd);

  const ownedEquipment = equipment.filter((e) => !e.is_subrental);
  const subrentalEquipment = equipment.filter((e) => e.is_subrental);

  const ownedRows = ownedEquipment.map((eq) => getEquipmentAnalytics(eq, rentals, periodStart, periodEnd));
  const subrentalRows = subrentalEquipment.map((eq) => getSubrentalAnalytics(eq, rentals, periodStart, periodEnd));

  const ownedAvgUtilisation = ownedRows.length > 0
    ? ownedRows.reduce((s, r) => s + r.utilisation, 0) / ownedRows.length
    : 0;

  const ownedColumns = [
    {
      key: 'name',
      label: 'Equipment',
      render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      key: 'calendarDays',
      label: 'Calendar Days',
      render: (row) => formatNumber(row.calendarDays),
    },
    {
      key: 'rentalDays',
      label: 'Item-Days',
      render: (row) => <span className="text-muted-foreground">{formatNumber(row.rentalDays)}</span>,
    },
    {
      key: 'revenue',
      label: 'Revenue',
      render: (row) => <span className="font-semibold">{formatCurrency(row.revenue)}</span>,
    },
    {
      key: 'revenuePerDay',
      label: 'Rev / Day',
      render: (row) => formatCurrency(row.revenuePerDay),
    },
    {
      key: 'utilisation',
      label: 'Utilisation',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, row.utilisation)}%` }}
            />
          </div>
          <span className="text-xs font-medium text-primary">{row.utilisation.toFixed(0)}%</span>
        </div>
      ),
    },
    {
      key: 'roi',
      label: 'ROI',
      render: (row) => (
        <span className={row.roi >= 100 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}>
          {row.roi.toFixed(0)}%
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`badge ${row.paidOff ? 'bg-green-500/20 text-green-700 dark:text-green-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'avgDiscount',
      label: 'Avg Discount',
      render: (row) => `${row.avgDiscount.toFixed(1)}%`,
    },
  ];

  const ownedSummary = [
    { label: 'Total Revenue', value: formatCurrency(ownedRows.reduce((s, r) => s + r.revenue, 0)) },
    { label: 'Total Days', value: formatNumber(ownedRows.reduce((s, r) => s + r.rentalDays, 0)) },
    { label: 'Paid Off', value: ownedRows.filter(r => r.paidOff).length + ' / ' + ownedRows.length },
    { label: 'Avg Utilisation', value: ownedAvgUtilisation.toFixed(0) + '%' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Equipment performance across {periodDays} day{periodDays !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => exportAnalyticsCSV(ownedRows, subrentalRows, periodDays)}
          className="btn-primary"
          disabled={loading}
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <PeriodSelector period={period} onChange={setPeriod} />

      {/* Owned Equipment Section */}
      <div className="flex items-center gap-2 mb-4 mt-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Package size={18} className="text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Owned Equipment</h2>
          <p className="text-xs text-muted-foreground">Revenue and utilisation for gear you own outright</p>
        </div>
      </div>

      {/* Owned Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {ownedSummary.map((s, i) => (
          <div key={i} className="bg-card rounded-lg border border-border p-3">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{s.label}</div>
            <div className="text-lg font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Owned Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-secondary border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <SortableTable columns={ownedColumns} data={ownedRows} emptyMessage="No owned equipment to analyze" />
        )}
      </div>

      {/* Sub-Rental Section */}
      <SubrentalSection
        subrentalRows={subrentalRows}
        ownedAvgUtilisation={ownedAvgUtilisation}
        periodDays={periodDays}
        loading={loading}
      />
    </div>
  );
}