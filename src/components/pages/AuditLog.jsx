import { useState, useEffect, useCallback } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SortableTable from '@/components/SortableTable';

const ACTION_STYLES = {
  created: 'bg-green-500/15 text-green-600 dark:text-green-400',
  updated: 'bg-primary/15 text-primary dark:text-yellow-300',
  deleted: 'bg-destructive/15 text-destructive dark:text-red-400',
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await base44.entities.AuditLog.list('-created_date', 500);
      setEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const q = search.toLowerCase().trim();
  const filtered = entries.filter((e) => {
    if (filterEntity !== 'all' && e.entity_type !== filterEntity) return false;
    if (filterAction !== 'all' && e.action !== filterAction) return false;
    if (q) {
      const hay = `${e.user_name} ${e.entity_name} ${e.entity_type} ${(e.changes || []).join(' ')}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const columns = [
    {
      key: 'created_date',
      label: 'Date & Time',
      render: (row) => <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(row.created_date).toLocaleString()}</span>,
    },
    {
      key: 'user_name',
      label: 'User',
      render: (row) => <span className="font-medium">{row.user_name || 'Unknown'}</span>,
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <span className={`badge ${ACTION_STYLES[row.action] || 'bg-muted text-muted-foreground'}`}>
          {row.action}
        </span>
      ),
    },
    {
      key: 'entity_type',
      label: 'Type',
      render: (row) => <span className="text-xs text-muted-foreground">{row.entity_type}</span>,
    },
    {
      key: 'entity_name',
      label: 'Entity',
      render: (row) => <span className="font-medium">{row.entity_name || '—'}</span>,
    },
    {
      key: 'changes',
      label: 'Details',
      sortable: false,
      render: (row) => (
        (row.changes && row.changes.length > 0) ? (
          <ul className="space-y-0.5">
            {row.changes.map((c, i) => (
              <li key={i} className="text-xs text-muted-foreground">{c}</li>
            ))}
          </ul>
        ) : <span className="text-xs text-muted-foreground">—</span>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {filtered.length} entr{filtered.length !== 1 ? 'ies' : 'y'}
          {(filterEntity !== 'all' || filterAction !== 'all' || q) ? ' (filtered)' : ' total'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select className="input-field w-auto" value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
          <option value="all">All Types</option>
          <option value="Equipment">Equipment</option>
          <option value="Rental">Rental</option>
          <option value="Client">Client</option>
        </select>
        <select className="input-field w-auto" value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
          <option value="all">All Actions</option>
          <option value="created">Created</option>
          <option value="updated">Updated</option>
          <option value="deleted">Deleted</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by user, entity, or change…"
            className="input-field pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={() => { setFilterEntity('all'); setFilterAction('all'); setSearch(''); }}
          className="btn-ghost text-sm"
        >
          Reset
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-secondary border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ScrollText size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No audit entries found</p>
          </div>
        ) : (
          <SortableTable columns={columns} data={filtered} />
        )}
      </div>
    </div>
  );
}