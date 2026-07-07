import { useState, useEffect, useCallback } from 'react';
import { Search, AlertTriangle, CheckCircle2, Database, Bug, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { datesOverlap, getReservedQuantity, formatCurrency } from '@/lib/calc';
import StatCard from '@/components/StatCard';

export default function DataCheck() {
  const [equipment, setEquipment] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [checkStart, setCheckStart] = useState('');
  const [checkEnd, setCheckEnd] = useState('');
  const [checkEquipmentId, setCheckEquipmentId] = useState('');
  const [availabilityResult, setAvailabilityResult] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [eq, rn, cl] = await Promise.all([
        base44.entities.Equipment.list('-created_date', 500),
        base44.entities.Rental.list('-created_date', 500),
        base44.entities.Client.list('-created_date', 500),
      ]);
      setEquipment(eq);
      setRentals(rn);
      setClients(cl);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Structural issues ──
  const issues = [];

  // Duplicate serials
  const serialMap = {};
  equipment.forEach((eq) => {
    if (eq.has_serial && eq.serial_number) {
      if (serialMap[eq.serial_number]) {
        issues.push(`Duplicate serial number "${eq.serial_number}" — ${eq.name}`);
      }
      serialMap[eq.serial_number] = true;
    }
  });

  // Serial items without serial number
  equipment.forEach((eq) => {
    if (eq.has_serial && !eq.serial_number) {
      issues.push(`Serial item without serial number — ${eq.name}`);
    }
  });

  // Bulk items with weird quantity
  equipment.forEach((eq) => {
    if (!eq.has_serial && (Number(eq.quantity) <= 0 || Number(eq.quantity) > 9999)) {
      issues.push(`Bulk item with unusual quantity — ${eq.name} (${eq.quantity})`);
    }
  });

  // Rental lines referencing deleted equipment
  rentals.forEach((r) => {
    (r.items || []).forEach((item) => {
      if (!equipment.find((e) => e.id === item.equipment_id)) {
        issues.push(`Rental #${(r.id || '').slice(-8)} references deleted equipment (${item.equipment_id.slice(-8)})`);
      }
    });
  });

  // ── Availability check ──
  const checkAvailability = () => {
    if (!checkEquipmentId || !checkStart || !checkEnd) {
      setAvailabilityResult({ error: 'Please select equipment and both dates' });
      return;
    }
    const eq = equipment.find((e) => e.id === checkEquipmentId);
    if (!eq) return;

    const total = Number(eq.quantity) || 1;
    const reserved = getReservedQuantity(eq.id, checkStart, checkEnd, rentals);
    const available = Math.max(0, total - reserved);

    const blockingRentals = rentals.filter((r) => {
      if (r.status !== 'active' && r.status !== 'reserved') return false;
      if (!datesOverlap(checkStart, checkEnd, r.start_date, r.end_date)) return false;
      return (r.items || []).some((i) => i.equipment_id === checkEquipmentId);
    });

    setAvailabilityResult({ equipment: eq, total, reserved, available, isAvailable: available > 0, blockingRentals });
  };

  // ── Search ──
  const q = search.toLowerCase().trim();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
  const searchResults = tokens.length === 0
    ? []
    : equipment.filter((e) => {
        const haystack = `${e.name || ''} ${e.serial_number || ''} ${e.category || ''}`.toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-3 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Data Check</h1>
      <p className="text-sm text-muted-foreground mb-6">Diagnostic tools for data integrity and availability</p>

      {/* Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StatCard label="Equipment" value={equipment.length} icon={Database} />
        <StatCard label="Rentals" value={rentals.length} icon={Calendar} accent="bg-accent/15 text-accent-foreground" />
        <StatCard label="Clients" value={clients.length} icon={Database} accent="bg-green-500/15 text-green-600 dark:text-green-400" />
        <StatCard
          label="Issues Found"
          value={issues.length}
          icon={Bug}
          accent={issues.length > 0 ? 'bg-destructive/15 text-destructive' : 'bg-green-500/15 text-green-600 dark:text-green-400'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Equipment Search */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Search Equipment</h2>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, serial, or category…"
              className="input-field pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {q && (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No matches</p>
              ) : (
                searchResults.map((eq) => (
                  <div key={eq.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50">
                    <div>
                      <div className="text-sm font-medium">{eq.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {eq.has_serial ? `Serial: ${eq.serial_number || '—'}` : `Qty: ${eq.quantity}`} · {eq.category}
                      </div>
                    </div>
                    <span className="text-xs font-medium">{formatCurrency(eq.price_per_day)}/d</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Availability Check */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Check Availability</h2>
          <div className="space-y-3 mb-4">
            <select
              className="input-field"
              value={checkEquipmentId}
              onChange={(e) => setCheckEquipmentId(e.target.value)}
            >
              <option value="">Select equipment…</option>
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} {eq.has_serial ? `(${eq.serial_number || '—'})` : `(x${eq.quantity})`}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Start</label>
                <input type="datetime-local" className="input-field" value={checkStart} onChange={(e) => setCheckStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">End</label>
                <input type="datetime-local" className="input-field" value={checkEnd} onChange={(e) => setCheckEnd(e.target.value)} />
              </div>
            </div>
            <button onClick={checkAvailability} className="btn-primary w-full">Check Availability</button>
          </div>

          {availabilityResult?.error && (
            <p className="text-sm text-destructive">{availabilityResult.error}</p>
          )}

          {availabilityResult && !availabilityResult.error && (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${availabilityResult.isAvailable ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
                {availabilityResult.isAvailable ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <span className="text-sm font-medium">
                  {availabilityResult.isAvailable ? 'Available' : 'Not available'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-secondary/50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-sm font-bold">{availabilityResult.total}</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Reserved</div>
                  <div className="text-sm font-bold text-destructive">{availabilityResult.reserved}</div>
                </div>
                <div className="bg-secondary/50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Available</div>
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">{availabilityResult.available}</div>
                </div>
              </div>
              {availabilityResult.blockingRentals.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Blocking Rentals</div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {availabilityResult.blockingRentals.map((r) => {
                      const client = clients.find((c) => c.id === r.client_id);
                      const item = (r.items || []).find((i) => i.equipment_id === checkEquipmentId);
                      return (
                        <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded bg-secondary/30">
                          <span className="text-xs">{client?.name || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(r.start_date).toLocaleDateString()} → {new Date(r.end_date).toLocaleDateString()} · qty: {item?.quantity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Issues */}
      <div className="bg-card rounded-xl border border-border p-5 mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Structural Issues</h2>
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 size={18} /> No issues found
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <div key={i} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-destructive/5">
                <AlertTriangle size={14} className="text-destructive shrink-0" />
                <span className="text-sm text-foreground">{issue}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}