import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Pencil, Trash2, Calendar, Download, FileText, FileSpreadsheet, Search, CheckCircle2, ClipboardList, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { daysBetween, calculateRentalPrice, formatCurrency, isInRange } from '@/lib/calc';
import { exportRentals } from '@/lib/export';
import { generateRentalPDF } from '@/lib/pdf';
import { printPickList } from '@/lib/pickList';
import { logAudit } from '@/lib/auditLog';
import SortableTable from '@/components/SortableTable';
import Modal from '@/components/Modal';
import RentalForm from '@/components/RentalForm';
import RentalDetail from '@/components/RentalDetail';

const STATUS_STYLES = {
  active: 'bg-primary/15 text-primary dark:text-yellow-300',
  completed: 'bg-green-500/15 text-green-600 dark:text-green-400',
  reserved: 'bg-accent/20 text-accent-foreground dark:text-yellow-200',
  cancelled: 'bg-destructive/15 text-destructive dark:text-red-400',
};

function toLocalDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultRange(rentals) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const hasThisMonth = (rentals || []).some((r) => {
    const d = new Date(r.start_date);
    return d >= thisMonthStart && d <= end;
  });
  const start = hasThisMonth
    ? thisMonthStart
    : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { start: toLocalDateStr(start), end: toLocalDateStr(end) };
}

export default function Rentals() {
  const [rentals, setRentals] = useState([]);
  const [clients, setClients] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paidFilter, setPaidFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('paid');
    return p === 'unpaid' || p === 'paid' ? p : 'all';
  });
  const [dateRange, setDateRange] = useState(() => defaultRange());
  const [dateRangeInitialized, setDateRangeInitialized] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [search, setSearch] = useState('');

  const [formModal, setFormModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editing, setEditing] = useState(null);
  const [duplicating, setDuplicating] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [paidConfirmTarget, setPaidConfirmTarget] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [rn, cl, eq, cats] = await Promise.all([
        base44.entities.Rental.list('-created_date', 500),
        base44.entities.Client.list('-created_date', 500),
        base44.entities.Equipment.list('-created_date', 500),
        base44.entities.Category.list('sort_order', 500),
      ]);
      setRentals(rn);
      setClients(cl);
      setEquipment(eq);
      setCategories(cats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-adjust date range once rentals are loaded
  useEffect(() => {
    if (!loading && !dateRangeInitialized) {
      setDateRange(defaultRange(rentals));
      setDateRangeInitialized(true);
    }
  }, [loading, dateRangeInitialized, rentals]);

  // Filter by status
  let filtered = statusFilter === 'all'
    ? rentals
    : rentals.filter((r) => r.status === statusFilter);

  // Filter by payment status
  if (paidFilter === 'paid') filtered = filtered.filter((r) => r.is_paid);
  if (paidFilter === 'unpaid') filtered = filtered.filter((r) => !r.is_paid);

  const rangeStart = new Date(dateRange.start);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(dateRange.end);
  rangeEnd.setHours(23, 59, 59, 999);

  // Filter by search (client name or rental ID) — bypasses date range
  const q = search.toLowerCase().trim();
  if (!q) {
    filtered = filtered.filter((r) => isInRange(r.start_date, rangeStart, rangeEnd));
  } else {
    filtered = filtered.filter((r) => {
      const client = clients.find((c) => c.id === r.client_id);
      const clientName = client?.name?.toLowerCase() || '';
      const id = (r.id || '').toLowerCase();
      return clientName.includes(q) || id.includes(q);
    });
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await base44.entities.Rental.delete(deleteTarget.id);
      const client = clients.find((c) => c.id === deleteTarget.client_id);
      await logAudit({ action: 'deleted', entityType: 'Rental', entityId: deleteTarget.id, entityName: client?.name || 'Unknown', changes: [`Deleted rental for ${client?.name || 'Unknown'}`] });
      setDeleteTarget(null);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to delete rental');
    }
  };

  const handleExport = (format) => {
    exportRentals(filtered, equipment, clients, format, { start: rangeStart, end: rangeEnd });
    setShowExport(false);
  };

  const handleComplete = async (isPaid) => {
    if (!completeTarget) return;
    try {
      await base44.entities.Rental.update(completeTarget.id, {
        status: 'completed',
        is_paid: isPaid,
      });
      const client = clients.find((c) => c.id === completeTarget.client_id);
      await logAudit({ action: 'updated', entityType: 'Rental', entityId: completeTarget.id, entityName: client?.name || 'Unknown', changes: [`Status: ${completeTarget.status} → completed`, `Payment: ${isPaid ? 'Paid' : 'Unpaid'}`] });
      setCompleteTarget(null);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to complete rental');
    }
  };

  const togglePaid = (rental) => {
    if (!rental.is_paid) {
      setPaidConfirmTarget(rental);
    } else {
      doTogglePaid(rental);
    }
  };

  const doTogglePaid = async (rental) => {
    try {
      await base44.entities.Rental.update(rental.id, { is_paid: !rental.is_paid });
      const client = clients.find((c) => c.id === rental.client_id);
      await logAudit({ action: 'updated', entityType: 'Rental', entityId: rental.id, entityName: client?.name || 'Unknown', changes: [`Payment: ${rental.is_paid ? 'Paid' : 'Unpaid'} → ${!rental.is_paid ? 'Paid' : 'Unpaid'}`] });
      loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to update payment status');
    }
  };

  const confirmMarkPaid = async () => {
    if (!paidConfirmTarget) return;
    await doTogglePaid(paidConfirmTarget);
    setPaidConfirmTarget(null);
  };

  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (row) => <span className="font-mono text-xs text-muted-foreground">{(row.id || '').slice(-8)}</span>,
    },
    {
      key: 'client',
      label: 'Client',
      render: (row) => {
        const client = clients.find((c) => c.id === row.client_id);
        return <span className="font-medium">{client?.name || 'Unknown'}</span>;
      },
    },
    {
      key: 'start_date',
      label: 'Start',
      render: (row) => <span className="text-xs">{new Date(row.start_date).toLocaleDateString()}</span>,
    },
    {
      key: 'end_date',
      label: 'End',
      render: (row) => <span className="text-xs">{new Date(row.end_date).toLocaleDateString()}</span>,
    },
    {
      key: 'days',
      label: 'Days',
      render: (row) => daysBetween(row.start_date, row.end_date),
    },
    {
      key: 'items_count',
      label: 'Items',
      render: (row) => (row.items || []).length,
    },
    {
      key: 'finalPrice',
      label: 'Final Price',
      render: (row) => {
        const days = daysBetween(row.start_date, row.end_date);
        const { finalPrice } = calculateRentalPrice(row.items, days, row.discount);
        return <span className="font-semibold">{formatCurrency(finalPrice)}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`badge ${STATUS_STYLES[row.status] || 'bg-muted text-muted-foreground'}`}>
          {row.status}
        </span>
      ),
    },
    {
      key: 'is_paid',
      label: 'Paid',
      render: (row) => (
        <button
          onClick={() => togglePaid(row)}
          title={row.is_paid ? 'Mark as unpaid' : 'Mark as paid'}
          className={`badge cursor-pointer transition-colors ${
            row.is_paid
              ? 'bg-green-500/15 text-green-600 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {row.is_paid ? 'Paid' : 'Unpaid'}
        </button>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          {row.status === 'active' && (
            <button
              onClick={() => setCompleteTarget(row)}
              className="btn-ghost !p-1.5 text-green-600 dark:text-green-400"
              title="Complete"
            >
              <CheckCircle2 size={14} />
            </button>
          )}
          <button
            onClick={() => { setViewing(row); setViewModal(true); }}
            className="btn-ghost !p-1.5"
            title="View"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => printPickList(row, clients.find((c) => c.id === row.client_id), equipment, categories)}
            className="btn-ghost !p-1.5"
            title="Pack List"
          >
            <ClipboardList size={14} />
          </button>
          <button
            onClick={() => generateRentalPDF(row, clients.find((c) => c.id === row.client_id), equipment, categories)}
            className="btn-ghost !p-1.5"
            title="Rental Agreement PDF"
          >
            <FileText size={14} />
          </button>

          <button
            onClick={() => { setDuplicating(row); setFormModal(true); }}
            className="btn-ghost !p-1.5"
            title="Duplicate"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => { setEditing(row); setFormModal(true); }}
            className="btn-ghost !p-1.5"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="btn-danger !p-1.5"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rentals</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} rental{filtered.length !== 1 ? 's' : ''} in selected range
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExport(true)} className="btn-secondary">
            <Download size={16} /> Export
          </button>
          <button
            onClick={() => { setEditing(null); setFormModal(true); }}
            className="btn-primary"
          >
            <Plus size={16} /> New Rental
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              From
            </label>
            <input
              type="date"
              className="input-field"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              To
            </label>
            <input
              type="date"
              className="input-field"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Status
            </label>
            <select
              className="input-field"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="reserved">Reserved</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Payment
            </label>
            <select
              className="input-field"
              value={paidFilter}
              onChange={(e) => setPaidFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Search
            </label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Client or ID…"
                className="input-field pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <button
            onClick={() => { setDateRange(defaultRange(rentals)); setStatusFilter('all'); setPaidFilter('all'); setSearch(''); }}
            className="btn-ghost text-sm ml-auto"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-secondary border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar size={32} className="mb-3 opacity-40" />
            <p className="text-sm mb-3">No rentals found</p>
            <button onClick={() => { setEditing(null); setFormModal(true); }} className="btn-primary text-sm">
              <Plus size={14} /> Create your first rental
            </button>
          </div>
        ) : (
          <SortableTable columns={columns} data={filtered} />
        )}
      </div>

      {/* Form Modal */}
      <Modal
        open={formModal}
        onClose={() => { setFormModal(false); setDuplicating(null); }}
        title={duplicating ? 'Duplicate Rental' : editing ? 'Edit Rental' : 'New Rental'}
        size="xl"
      >
        <RentalForm
          rental={editing}
          duplicateFrom={duplicating}
          clients={clients}
          equipment={equipment}
          categories={categories}
          rentals={rentals}
          onSaved={() => { setFormModal(false); setDuplicating(null); loadData(); }}
          onCancel={() => { setFormModal(false); setDuplicating(null); }}
          onClientCreated={(client) => setClients(prev => [...prev, client])}
        />
      </Modal>

      {/* View Modal */}
      <Modal
        open={viewModal}
        onClose={() => setViewModal(false)}
        title="Rental Details"
        size="lg"
        footer={
          <>
            <button onClick={() => setViewModal(false)} className="btn-ghost">Close</button>
            <button
              onClick={() => generateRentalPDF(viewing, clients.find((c) => c.id === viewing.client_id), equipment, categories)}
              className="btn-secondary"
            >
              <FileText size={14} /> PDF
            </button>
            <button
              onClick={() => { setDuplicating(viewing); setViewModal(false); setFormModal(true); }}
              className="btn-secondary"
            >
              <Copy size={14} /> Duplicate
            </button>
            <button
              onClick={() => { setEditing(viewing); setViewModal(false); setFormModal(true); }}
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
            categories={categories}
            />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Rental"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
            <button onClick={handleDelete} className="btn-primary !bg-destructive !text-destructive-foreground">Delete</button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete this rental? This action cannot be undone.
        </p>
      </Modal>

      {/* Complete Modal */}
      <Modal
        open={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        title="Complete Rental"
        size="sm"
      >
        {completeTarget && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Complete rental for{' '}
              <span className="font-semibold text-foreground">
                {clients.find((c) => c.id === completeTarget.client_id)?.name || 'Unknown'}
              </span>
              ?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleComplete(true)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-green-500/30 hover:bg-green-500/5 transition-all"
              >
                <CheckCircle2 size={24} className="text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium">Paid</span>
              </button>
              <button
                onClick={() => handleComplete(false)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:bg-secondary transition-all"
              >
                <FileText size={24} className="text-muted-foreground" />
                <span className="text-sm font-medium">Unpaid</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Paid Confirmation Modal */}
      <Modal
        open={!!paidConfirmTarget}
        onClose={() => setPaidConfirmTarget(null)}
        title="Confirm Payment"
        size="sm"
        footer={
          <>
            <button onClick={() => setPaidConfirmTarget(null)} className="btn-ghost">Cancel</button>
            <button onClick={confirmMarkPaid} className="btn-primary !bg-green-600 !text-white">
              <CheckCircle2 size={14} /> Confirm Paid
            </button>
          </>
        }
      >
        {paidConfirmTarget && (
          <p className="text-sm text-muted-foreground">
            Mark rental for{' '}
            <span className="font-semibold text-foreground">
              {clients.find((c) => c.id === paidConfirmTarget.client_id)?.name || 'Unknown'}
            </span>{' '}
            as paid? The amount of{' '}
            <span className="font-semibold text-foreground">
              {formatCurrency(
                calculateRentalPrice(
                  paidConfirmTarget.items,
                  daysBetween(paidConfirmTarget.start_date, paidConfirmTarget.end_date),
                  paidConfirmTarget.discount
                ).finalPrice
              )}
            </span>{' '}
            will be included in revenue.
          </p>
        )}
      </Modal>

      {/* Export Modal */}
      <Modal
        open={showExport}
        onClose={() => setShowExport(false)}
        title="Export Rentals"
        size="sm"
      >
        <p className="text-sm text-muted-foreground mb-4">
          Export {filtered.length} rental{filtered.length !== 1 ? 's' : ''} from{' '}
          {new Date(rangeStart).toLocaleDateString()} to {new Date(rangeEnd).toLocaleDateString()}.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => handleExport('csv')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all">
            <FileText size={24} className="text-primary" />
            <span className="text-sm font-medium">CSV</span>
          </button>
          <button onClick={() => handleExport('xls')} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all">
            <FileSpreadsheet size={24} className="text-primary" />
            <span className="text-sm font-medium">XLS</span>
          </button>
        </div>
      </Modal>
    </div>
  );
}