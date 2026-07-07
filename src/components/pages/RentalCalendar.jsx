import { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { datesOverlap, calculateRentalPrice, daysBetween, formatCurrency, getReservedQuantity } from '@/lib/calc';
import Modal from '@/components/Modal';
import RentalDetail from '@/components/RentalDetail';
import RentalForm from '@/components/RentalForm';
import { useToast } from '@/components/ui/use-toast';

const STATUS_STYLES = {
  active: 'bg-primary/15 text-primary dark:text-yellow-300 border-primary/30',
  completed: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
  reserved: 'bg-accent/20 text-yellow-700 dark:text-yellow-300 border-accent/30',
  cancelled: 'bg-destructive/15 text-destructive dark:text-red-400 border-destructive/30',
};

const CHIP_STYLES = {
  active: 'bg-blue-500 text-white',
  reserved: 'bg-accent text-accent-foreground',
  cancelled: 'bg-destructive text-destructive-foreground',
};

function chipClass(r) {
  if (r.status === 'completed') {
    return r.is_paid
      ? 'bg-green-500/70 text-white'
      : 'bg-red-500/70 text-white';
  }
  return CHIP_STYLES[r.status] || 'bg-muted text-muted-foreground';
}

const LEGEND_ITEMS = [
  { label: 'Active', cls: 'bg-blue-500 text-white' },
  { label: 'Reserved', cls: 'bg-accent text-accent-foreground' },
  { label: 'Completed (Paid)', cls: 'bg-green-500/70 text-white' },
  { label: 'Completed (Unpaid)', cls: 'bg-red-500/70 text-white' },
];

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0=Sun
  const gridStart = new Date(year, month, 1 - startOffset);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }
  return days;
}

function sameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

export default function RentalCalendar() {
  const [rentals, setRentals] = useState([]);
  const [clients, setClients] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formModal, setFormModal] = useState(false);
  const [draggedRentalId, setDraggedRentalId] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const { toast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const [rn, cl, eq] = await Promise.all([
        base44.entities.Rental.list('-created_date', 500),
        base44.entities.Client.list('-created_date', 500),
        base44.entities.Equipment.list('-created_date', 500),
      ]);
      setRentals(rn);
      setClients(cl);
      setEquipment(eq);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const days = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const monthEnd = new Date(cursor.year, cursor.month + 1, 0, 23, 59, 59, 999);

  const visibleRentals = useMemo(
    () => rentals.filter((r) => r.status !== 'cancelled' && datesOverlap(r.start_date, r.end_date, monthStart, monthEnd)),
    [rentals, monthStart, monthEnd]
  );

  const rentalsForDay = useCallback((day) => {
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    return visibleRentals
      .filter((r) => datesOverlap(r.start_date, r.end_date, day, dayEnd))
      .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
  }, [visibleRentals]);

  const prevMonth = () => setCursor((c) => {
    const d = new Date(c.year, c.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const nextMonth = () => setCursor((c) => {
    const d = new Date(c.year, c.month + 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  const today = new Date();

  const handleDrop = async (rentalId, targetDay) => {
    setDragOverDay(null);
    setDraggedRentalId(null);
    if (!rentalId) return;
    const rental = rentals.find((r) => r.id === rentalId);
    if (!rental || rental.status === 'cancelled') return;

    const oldStart = new Date(rental.start_date);
    const targetStart = new Date(targetDay);
    targetStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);

    const oldEnd = new Date(rental.end_date);
    const durationMs = oldEnd.getTime() - oldStart.getTime();
    const newEnd = new Date(targetStart.getTime() + durationMs);

    const conflicts = [];
    for (const item of (rental.items || [])) {
      const eq = equipment.find((e) => e.id === item.equipment_id);
      if (!eq) continue;
      const total = Number(eq.quantity) || 1;
      const reserved = getReservedQuantity(
        eq.id,
        targetStart.toISOString(),
        newEnd.toISOString(),
        rentals,
        rental.id
      );
      const available = Math.max(0, total - reserved);
      if ((Number(item.quantity) || 0) > available) {
        conflicts.push(`${eq.name}: need ${item.quantity}, only ${available} available`);
      }
    }

    if (conflicts.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Cannot move rental',
        description: conflicts.join('; '),
      });
      return;
    }

    try {
      await base44.entities.Rental.update(rental.id, {
        start_date: targetStart.toISOString(),
        end_date: newEnd.toISOString(),
      });
      loadData();
      toast({
        title: 'Rental moved',
        description: `${targetStart.toLocaleDateString()} – ${newEnd.toLocaleDateString()}`,
      });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Failed to move rental' });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rental Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {visibleRentals.length} rental{visibleRentals.length !== 1 ? 's' : ''} scheduled this month
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-ghost !p-2" title="Previous month">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center">
            {MONTH_NAMES[cursor.month]} {cursor.year}
          </span>
          <button onClick={nextMonth} className="btn-ghost !p-2" title="Next month">
            <ChevronRight size={18} />
          </button>
          <button onClick={goToday} className="btn-secondary text-sm ml-2">Today</button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-border">
          {DOW_LABELS.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const isCurrentMonth = day.getMonth() === cursor.month;
            const isToday = sameDay(day, today);
            const dayRentals = rentalsForDay(day);
            return (
              <div
                key={i}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDay(i); }}
                onDrop={() => handleDrop(draggedRentalId, day)}
                className={`min-h-[110px] border-b border-r border-border p-1.5 flex flex-col gap-1 transition-colors ${
                  !isCurrentMonth ? 'bg-secondary/30' : ''
                } ${(i + 1) % 7 === 0 ? 'border-r-0' : ''} ${i >= 35 ? 'border-b-0' : ''} ${
                  dragOverDay === i && draggedRentalId ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''
                }`}
              >
                <div className={`text-xs font-medium text-right ${
                  !isCurrentMonth ? 'text-muted-foreground/40' : isToday ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center ml-auto' : 'text-muted-foreground'
                }`}>
                  {day.getDate()}
                </div>
                {dayRentals.slice(0, 3).map((r) => {
                  const client = clients.find((c) => c.id === r.client_id);
                  const isStart = sameDay(new Date(r.start_date), day);
                  return (
                    <button
                      key={r.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedRentalId(r.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => { setDraggedRentalId(null); setDragOverDay(null); }}
                      onClick={() => { setViewing(r); }}
                      className={`text-left text-[10px] leading-tight px-1.5 py-1 rounded truncate font-medium transition-opacity hover:opacity-100 cursor-grab active:cursor-grabbing ${chipClass(r)} ${draggedRentalId === r.id ? 'opacity-50' : ''}`}
                      title={`${client?.name || 'Unknown'} — ${r.status} (drag to move)`}
                    >
                      {isStart && <span className="opacity-70">●</span>} {client?.name || 'Unknown'}
                    </button>
                  );
                })}
                {dayRentals.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1.5">
                    +{dayRentals.length - 3} more
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded ${item.cls}`} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>

      {/* View Modal */}
      <Modal
        open={!!viewing && !formModal}
        onClose={() => setViewing(null)}
        title="Rental Details"
        size="lg"
        footer={
          <>
            <button onClick={() => setViewing(null)} className="btn-ghost">Close</button>
            <button
              onClick={() => { setEditing(viewing); setViewing(null); setFormModal(true); }}
              className="btn-primary"
            >
              <Pencil size={14} /> Edit
            </button>
          </>
        }
      >
        {viewing && (
          <RentalDetail
            rental={viewing}
            client={clients.find((c) => c.id === viewing.client_id)}
            equipment={equipment}
          />
        )}
      </Modal>

      {/* Form Modal */}
      <Modal
        open={formModal}
        onClose={() => setFormModal(false)}
        title={editing ? 'Edit Rental' : 'New Rental'}
        size="xl"
      >
        <RentalForm
          rental={editing}
          clients={clients}
          equipment={equipment}
          rentals={rentals}
          onSaved={() => { setFormModal(false); loadData(); }}
          onCancel={() => setFormModal(false)}
          onClientCreated={(client) => setClients(prev => [...prev, client])}
        />
      </Modal>
    </div>
  );
}