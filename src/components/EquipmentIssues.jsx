import { Pencil, Trash2, AlertTriangle, Wrench, Search } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency } from '@/lib/calc';
import { getCategoryColorClass } from '@/lib/categoryColors';
import SortableTable from '@/components/SortableTable';

const CONDITION_STYLES = {
  broken: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  lost: 'bg-red-500/15 text-red-600 dark:text-red-400',
};

export default function EquipmentIssues({ items, categories, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const q = search.toLowerCase().trim();
  const issues = items.filter((e) => {
    const cond = e.condition || 'ok';
    if (cond !== 'broken' && cond !== 'lost') return false;
    if (filter !== 'all' && cond !== filter) return false;
    if (!q) return true;
    return (
      e.name?.toLowerCase().includes(q) ||
      e.serial_number?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    );
  });

  const brokenCount = items.filter((e) => e.condition === 'broken').length;
  const lostCount = items.filter((e) => e.condition === 'lost').length;

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{row.name}</span>
          {row.is_subrental && (
            <span className="badge bg-blue-500/15 text-blue-600 dark:text-blue-400">Sub</span>
          )}
        </div>
      ),
    },
    {
      key: 'serial_number',
      label: 'Serial #',
      render: (row) => row.has_serial
        ? <span className="font-mono text-xs text-muted-foreground">{row.serial_number || '—'}</span>
        : <span className="text-xs text-muted-foreground">Bulk (×{row.quantity})</span>,
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) => (
        <span className={`badge ${getCategoryColorClass(row.category, categories)}`}>{row.category}</span>
      ),
    },
    {
      key: 'condition',
      label: 'Condition',
      sortable: true,
      render: (row) => (
        <span className={`badge ${CONDITION_STYLES[row.condition]}`}>
          {row.condition === 'broken' && <Wrench size={10} className="mr-1" />}
          {row.condition === 'lost' && <AlertTriangle size={10} className="mr-1" />}
          {row.condition}
        </span>
      ),
    },
    {
      key: 'price_per_day',
      label: 'Price/Day',
      render: (row) => formatCurrency(row.price_per_day),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => onEdit(row)}
            className="btn-ghost !p-1.5"
            title="Edit"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(row)}
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
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
        >
          All Issues ({issues.length})
        </button>
        <button
          onClick={() => setFilter('broken')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'broken' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
        >
          <Wrench size={12} className="inline mr-1" />
          Broken ({brokenCount})
        </button>
        <button
          onClick={() => setFilter('lost')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'lost' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'}`}
        >
          <AlertTriangle size={12} className="inline mr-1" />
          Lost ({lostCount})
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search issues…"
          className="input-field pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {issues.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertTriangle size={32} className="mb-3 opacity-40" />
            <p className="text-sm">No equipment issues found</p>
            <p className="text-xs mt-1">All items are in working condition</p>
          </div>
        ) : (
          <SortableTable columns={columns} data={issues} />
        )}
      </div>
    </div>
  );
}