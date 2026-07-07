import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DollarSign, Calendar, Package, Users, Plus, ArrowRight, TrendingUp, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getDashboardStats, formatCurrency, formatNumber, getPeriodRange, daysBetween, calculateRentalPrice } from '@/lib/calc';
import StatCard from '@/components/StatCard';
import PeriodSelector from '@/components/PeriodSelector';

const PERIOD_LABELS = {
  week: 'Last 7 days',
  '30d': 'Last 30 days',
  '60d': 'Last 60 days',
  year: 'Last year',
  all: 'All time'
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState({
    preset: '30d',
    start: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    end: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [rentals, equipment, clients] = await Promise.all([
        base44.entities.Rental.list('-created_date', 500),
        base44.entities.Equipment.list('-created_date', 500),
        base44.entities.Client.list('-created_date', 500)]
        );
        if (!mounted) return;
        setData({ rentals, equipment, clients });
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {mounted = false;};
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const { start, end } = getPeriodRange(period.preset, period.start, period.end);
    return getDashboardStats(data.rentals, data.equipment, data.clients, start, end);
  }, [data, period]);

  const unpaidRentals = useMemo(() => {
    if (!data) return [];
    return data.rentals.filter((r) => r.status !== 'cancelled' && !r.is_paid);
  }, [data]);

  const unpaidTotal = useMemo(() => {
    return unpaidRentals.reduce((sum, r) => {
      const days = daysBetween(r.start_date, r.end_date);
      const { finalPrice } = calculateRentalPrice(r.items, days, r.discount);
      return sum + finalPrice;
    }, 0);
  }, [unpaidRentals]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const periodLabel = period.preset === 'custom' ?
  `${new Date(period.start).toLocaleDateString()} – ${new Date(period.end).toLocaleDateString()}` :
  PERIOD_LABELS[period.preset] || 'Last 30 days';

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-3 border-secondary border-t-primary rounded-full animate-spin" />
      </div>);

  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{greeting}.</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You have <span className="font-semibold text-primary">{stats.activeRentals}</span> active rental{stats.activeRentals !== 1 ? 's' : ''}
            {stats.returningToday > 0 &&
            <span> and <span className="font-semibold text-accent-foreground">{stats.returningToday}</span> piece{stats.returningToday !== 1 ? 's' : ''} of equipment returning today</span>
            }.
          </p>
        </div>
        <Link to="/rentals" className="btn-primary">
          <Plus size={16} /> New Rental
        </Link>
      </div>

      <PeriodSelector period={period} onChange={setPeriod} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} sublabel={periodLabel} icon={DollarSign} />
        <StatCard label="Calendar Days" value={formatNumber(stats.totalCalendarDays)} sublabel={periodLabel} icon={Calendar} accent="bg-accent/15 text-accent-foreground dark:text-yellow-300" />
        <StatCard label="Equipment" value={data.equipment.length} sublabel="In inventory" icon={Package} />
        <StatCard label="Clients" value={data.clients.length} sublabel="Total registered" icon={Users} accent="bg-green-500/15 text-green-600 dark:text-green-400" />
        <StatCard
          label="Active Rentals"
          value={stats.activeRentals}
          sublabel={stats.returningToday > 0 ? `${stats.returningToday} returning today` : 'None returning today'}
          icon={TrendingUp}
          accent="bg-primary/10 text-primary" />
        
      </div>

      {/* Unpaid Rentals Alert */}
      {unpaidRentals.length > 0 &&
      <Link
        to="/rentals?paid=unpaid"
        className="flex items-center justify-between gap-4 border border-amber-500/40 rounded-xl p-4 mb-6 transition-colors bg-amber-500/10 dark:bg-amber-500/15 hover:bg-amber-500/20 dark:hover:bg-amber-500/25 ring-1 ring-amber-500/20">
        
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 dark:bg-amber-500/25 flex items-center justify-center shrink-0">
              <AlertCircle size={20} className="text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {unpaidRentals.length} unpaid rental{unpaidRentals.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {formatCurrency(unpaidTotal)} in outstanding payments — click to review
              </p>
            </div>
          </div>
          <ArrowRight size={18} className="text-amber-700 dark:text-amber-300 shrink-0" />
        </Link>
      }

      {/* Top Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 by Revenue */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top 5 Equipment by Revenue</h2>
            <DollarSign size={16} className="text-muted-foreground" />
          </div>
          {stats.topByRevenue.length === 0 ?
          <p className="text-sm text-muted-foreground py-6 text-center">No data for this period</p> :

          <div className="space-y-3">
              {stats.topByRevenue.map((item, i) =>
            <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <span className="text-sm font-semibold">{formatCurrency(item.value)}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${item.value / stats.topByRevenue[0].value * 100}%` }} />
                  
                    </div>
                  </div>
                </div>
            )}
            </div>
          }
        </div>

        {/* Top 5 by Rental Days */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top 5 Equipment by Rental Days</h2>
            <Calendar size={16} className="text-muted-foreground" />
          </div>
          {stats.topByDays.length === 0 ?
          <p className="text-sm text-muted-foreground py-6 text-center">No data for this period</p> :

          <div className="space-y-3">
              {stats.topByDays.map((item, i) =>
            <div key={i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <span className="text-sm font-semibold">{formatNumber(item.value)} days</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div
                    className="h-full bg-accent rounded-full transition-all duration-500"
                    style={{ width: `${item.value / stats.topByDays[0].value * 100}%` }} />
                  
                    </div>
                  </div>
                </div>
            )}
            </div>
          }
        </div>

        {/* Least Used */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Least Used Equipment</h2>
            <TrendingUp size={16} className="text-muted-foreground rotate-180" />
          </div>
          {stats.leastUsed.length === 0 ?
          <p className="text-sm text-muted-foreground py-6 text-center">No data for this period</p> :

          <div className="space-y-2">
              {stats.leastUsed.map((item, i) =>
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  <span className="text-sm text-muted-foreground">{formatNumber(item.value)} days</span>
                </div>
            )}
            </div>
          }
        </div>

        {/* Top Clients */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Top Clients</h2>
            <Users size={16} className="text-muted-foreground" />
          </div>
          {stats.topClients.length === 0 ?
          <p className="text-sm text-muted-foreground py-6 text-center">No data for this period</p> :

          <div className="space-y-2">
              {stats.topClients.map((item, i) =>
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(item.value)}</span>
                </div>
            )}
            </div>
          }
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Link to="/analytics" className="btn-ghost text-sm">
          View Full Analytics <ArrowRight size={14} />
        </Link>
      </div>
    </div>);

}