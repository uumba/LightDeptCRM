import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Package, ChevronDown, ChevronUp, Search, Repeat, Copy, ClipboardCheck, AlertTriangle, Wrench, Upload, Tags } from 'lucide-react';
import { printInventoryReport } from '@/lib/inventoryReport';
import { base44 } from '@/api/base44Client';
import { formatCurrency, getEquipmentAnalytics, daysInPeriod } from '@/lib/calc';
import { getCategoryColorClass } from '@/lib/categoryColors';
import { logAudit } from '@/lib/auditLog';

export function categoryColor(name, categories) {
  return getCategoryColorClass(name, categories);
}
import SortableTable from '@/components/SortableTable';
import Modal from '@/components/Modal';
import EquipmentForm from '@/components/EquipmentForm';
import EquipmentIssues from '@/components/EquipmentIssues';
import CategoriesTab from '@/components/CategoriesTab';
import BulkUploadModal from '@/components/BulkUploadModal';

export default function Equipment() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterSubrental, setFilterSubrental] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cloning, setCloning] = useState(null);
  const [quickAddTarget, setQuickAddTarget] = useState(null);
  const [quickAddAmount, setQuickAddAmount] = useState(1);
  const [tab, setTab] = useState('inventory');
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [eq, cats, rn] = await Promise.all([
        base44.entities.Equipment.list('-created_date', 500),
        base44.entities.Category.list('sort_order', 500),
        base44.entities.Rental.list('-created_date', 500),
      ]);
      setItems(eq);
      setCategories(cats);
      setRentals(rn);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const q = search.toLowerCase().trim();
  const filtered = items.filter((e) => {
    const matchesCategory = filterCategory === 'all' || e.category === filterCategory;
    const matchesSubrental =
      filterSubrental === 'all' ||
      (filterSubrental === 'owned' && !e.is_subrental) ||
      (filterSubrental === 'subrental' && e.is_subrental);
    const matchesSearch = !q ||
      e.name?.toLowerCase().includes(q) ||
      e.serial_number?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q);
    return matchesCategory && matchesSubrental && matchesSearch;
  });

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((item) => {
      const key = `${(item.name || '').toLowerCase()}__${item.is_subrental}`;
      if (!map[key]) {
        map[key] = {
          id: key,
          name: item.name,
          items: [],
          has_serial: item.has_serial,
          is_subrental: item.is_subrental,
          category: item.category,
          price_per_day: item.price_per_day,
          purchase_price: item.purchase_price,
          subrental_cost_per_day: item.subrental_cost_per_day,
          quantity: 0,
        };
      }
      map[key].items.push(item);
      map[key].quantity += Number(item.quantity) || 1;
    });
    return Object.values(map).map((group) => ({
      ...group,
      serial_number: group.has_serial
        ? (group.items.length === 1 ? (group.items[0].serial_number || '') : `${group.items.length} serials`)
        : '',
    }));
  }, [filtered]);

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = now;
  const periodDays = daysInPeriod(periodStart, periodEnd);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await base44.entities.Equipment.delete(deleteTarget.id);
      await logAudit({ action: 'deleted', entityType: 'Equipment', entityId: deleteTarget.id, entityName: deleteTarget.name, changes: [`Deleted: ${deleteTarget.name}`] });
      setDeleteTarget(null);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to delete equipment');
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddTarget) return;
    try {
      const newQty = (Number(quickAddTarget.quantity) || 0) + (Number(quickAddAmount) || 0);
      await base44.entities.Equipment.update(quickAddTarget.id, { quantity: newQty });
      await logAudit({ action: 'updated', entityType: 'Equipment', entityId: quickAddTarget.id, entityName: quickAddTarget.name, changes: [`Quantity: ${quickAddTarget.quantity} → ${newQty}`] });
      setQuickAddTarget(null);
      setQuickAddAmount(1);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to update quantity');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            {expandedRow === row.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <span className="font-medium text-foreground">{row.name}</span>
          {row.is_subrental && (
            <span className="badge bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <Repeat size={10} /> Sub
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'serial_number',
      label: 'Serial #',
      render: (row) => {
        if (!row.has_serial) return <span className="text-xs text-muted-foreground">Bulk</span>;
        if (row.items.length === 1) return <span className="font-mono text-xs text-muted-foreground">{row.items[0].serial_number || '—'}</span>;
        return <span className="text-xs text-muted-foreground">{row.items.length} serials</span>;
      },
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <span className={`badge ${categoryColor(row.category, categories)}`}>{row.category}</span>
      ),
    },
    {
      key: 'price_per_day',
      label: 'Price/Day',
      render: (row) => formatCurrency(row.price_per_day),
    },
    {
      key: 'quantity',
      label: 'Qty',
      render: (row) => row.quantity,
    },
    {
      key: 'purchase_price',
      label: 'Cost',
      render: (row) => row.is_subrental
        ? <span className="text-blue-600 dark:text-blue-400">{formatCurrency(row.subrental_cost_per_day)}/d</span>
        : formatCurrency(row.purchase_price),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (row) => {
        const isMulti = row.items.length > 1;
        return (
          <div className="flex items-center gap-1 justify-end">
            {row.has_serial && !isMulti && (
              <button
                onClick={() => { setCloning(row.items[0]); setModalOpen(true); }}
                className="btn-ghost !p-1.5"
                title="Clone"
              >
                <Copy size={14} />
              </button>
            )}
            {!row.has_serial && (
              <button
                onClick={() => { setQuickAddTarget(row.items[0]); setQuickAddAmount(1); }}
                className="btn-ghost !p-1.5"
                title="Add stock"
              >
                <Plus size={14} />
              </button>
            )}
            {!isMulti && (
              <>
                <button
                  onClick={() => { setEditing(row.items[0]); setModalOpen(true); }}
                  className="btn-ghost !p-1.5"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => setDeleteTarget(row.items[0])}
                  className="btn-danger !p-1.5"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {items.length} item{items.length !== 1 ? 's' : ''} in inventory
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'inventory' && (
            <>
              <button
                onClick={() => setBulkUploadOpen(true)}
                className="btn-secondary"
              >
                <Upload size={16} /> Bulk Upload
              </button>
              <button
                onClick={() => printInventoryReport(items, categories)}
                className="btn-secondary"
                disabled={loading || items.length === 0}
              >
                <ClipboardCheck size={16} /> Stock Check
              </button>
            </>
          )}
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="btn-primary"
          >
            <Plus size={16} /> Add Equipment
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-6 border-b border-border">
        <button
          onClick={() => setTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'inventory' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Package size={16} />
          Inventory
        </button>
        <button
          onClick={() => setTab('issues')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'issues' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle size={16} />
          Issues
          {items.filter((e) => e.condition === 'broken' || e.condition === 'lost').length > 0 && (
            <span className="badge bg-red-500/15 text-red-600 dark:text-red-400">
              {items.filter((e) => e.condition === 'broken' || e.condition === 'lost').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            tab === 'categories' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Tags size={16} />
          Categories
        </button>
      </div>

      {/* Issues Tab */}
      {tab === 'issues' ? (
        <EquipmentIssues
          items={items}
          categories={categories}
          onEdit={(item) => { setEditing(item); setModalOpen(true); }}
          onDelete={(item) => setDeleteTarget(item)}
        />
      ) : tab === 'categories' ? (
        <CategoriesTab
          categories={categories}
          equipment={items}
          onReload={loadData}
        />
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, serial number, or category…"
              className="input-field pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Sub-Rental Filter */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setFilterSubrental('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filterSubrental === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
            >
              All Equipment
            </button>
            <button
              onClick={() => setFilterSubrental('owned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filterSubrental === 'owned' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
            >
              Owned ({items.filter(e => !e.is_subrental).length})
            </button>
            <button
              onClick={() => setFilterSubrental('subrental')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filterSubrental === 'subrental' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
            >
              <Repeat size={12} className="inline mr-1" />
              Sub-Rental ({items.filter(e => e.is_subrental).length})
            </button>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filterCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
            >
              All ({items.length})
            </button>
            {categories.map((c) => {
              const count = items.filter((e) => e.category === c.name).length;
              return (
                <button
                  key={c.id}
                  onClick={() => setFilterCategory(c.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${filterCategory === c.name ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
                >
                  {c.name} ({count})
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-3 border-secondary border-t-primary rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Package size={32} className="mb-3 opacity-40" />
                <p className="text-sm mb-3">No equipment found</p>
                <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary text-sm">
                  <Plus size={14} /> Add your first item
                </button>
              </div>
            ) : (
              <SortableTable
                columns={columns}
                data={grouped}
                expandedRowId={expandedRow}
                renderExpandedRow={(row) => {
                  if (row.has_serial && row.items.length > 1) {
                    return (
                      <div className="px-6 py-4 bg-secondary/30">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Units ({row.items.length})
                        </div>
                        <div className="space-y-2">
                          {row.items.map((item, idx) => (
                            <div key={item.id} className="flex items-center justify-between bg-card rounded-lg px-3 py-2 border border-border">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground font-mono">#{idx + 1}</span>
                                <span className="font-mono text-sm text-foreground">{item.serial_number || '—'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setCloning(item); setModalOpen(true); }}
                                  className="btn-ghost !p-1.5"
                                  title="Clone"
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  onClick={() => { setEditing(item); setModalOpen(true); }}
                                  className="btn-ghost !p-1.5"
                                  title="Edit"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(item)}
                                  className="btn-danger !p-1.5"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  const eq = row.items[0];
                  const analytics = getEquipmentAnalytics(eq, rentals, periodStart, periodEnd);
                  return (
                    <div className="px-6 py-4 bg-secondary/30">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Revenue ({periodDays}d)</div>
                          <div className="text-sm font-bold">{formatCurrency(analytics.revenue)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Calendar Days</div>
                          <div className="text-sm font-bold">{analytics.calendarDays}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Item-Days</div>
                          <div className="text-sm font-bold text-muted-foreground">{analytics.rentalDays}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ROI</div>
                          <div className={`text-sm font-bold ${analytics.paidOff ? 'text-green-600 dark:text-green-400' : 'text-accent-foreground'}`}>
                            {analytics.roi.toFixed(0)}% — {analytics.status}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Utilisation</div>
                          <div className="text-sm font-bold text-primary">{analytics.utilisation.toFixed(0)}%</div>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setCloning(null); }}
        title={cloning ? 'Clone Equipment' : editing ? 'Edit Equipment' : 'Add Equipment'}
        size="lg"
      >
        <EquipmentForm
          equipment={editing}
          cloneFrom={cloning}
          categories={categories}
          onSaved={() => { setModalOpen(false); setCloning(null); loadData(); }}
          onCancel={() => { setModalOpen(false); setCloning(null); }}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Equipment"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
            <button onClick={handleDelete} className="btn-primary !bg-destructive !text-destructive-foreground">Delete</button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
          This action cannot be undone.
        </p>
      </Modal>

      <Modal
        open={!!quickAddTarget}
        onClose={() => { setQuickAddTarget(null); setQuickAddAmount(1); }}
        title="Add Stock"
        size="sm"
        footer={
          <>
            <button onClick={() => { setQuickAddTarget(null); setQuickAddAmount(1); }} className="btn-ghost">Cancel</button>
            <button onClick={handleQuickAdd} className="btn-primary">Add</button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Add stock to <span className="font-semibold text-foreground">{quickAddTarget?.name}</span>
          </p>
          <div className="flex items-center justify-between bg-secondary/40 rounded-lg p-3">
            <span className="text-sm text-muted-foreground">Current quantity</span>
            <span className="text-sm font-bold">{quickAddTarget?.quantity}</span>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Amount to add
            </label>
            <input
              type="number"
              min="1"
              className="input-field"
              value={quickAddAmount}
              onChange={(e) => setQuickAddAmount(Math.max(1, Number(e.target.value) || 1))}
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between bg-primary/10 rounded-lg p-3">
            <span className="text-sm text-muted-foreground">New total</span>
            <span className="text-sm font-bold text-primary">
              {(Number(quickAddTarget?.quantity) || 0) + (Number(quickAddAmount) || 0)}
            </span>
          </div>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <BulkUploadModal
        open={bulkUploadOpen}
        onClose={() => { setBulkUploadOpen(false); }}
        categories={categories}
        onDone={loadData}
      />
    </div>
  );
}