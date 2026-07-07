import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Users, Mail, Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getClientStats, formatCurrency, tierColor } from '@/lib/calc';
import { logAudit } from '@/lib/auditLog';
import SortableTable from '@/components/SortableTable';
import Modal from '@/components/Modal';
import ClientForm from '@/components/ClientForm';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [cl, rn] = await Promise.all([
        base44.entities.Client.list('-created_date', 500),
        base44.entities.Rental.list('-created_date', 500),
      ]);
      setClients(cl);
      setRentals(rn);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await base44.entities.Client.delete(deleteTarget.id);
      await logAudit({ action: 'deleted', entityType: 'Client', entityId: deleteTarget.id, entityName: deleteTarget.name, changes: [`Deleted: ${deleteTarget.name}`] });
      setDeleteTarget(null);
      loadData();
    } catch (e) {
      console.error(e);
      alert('Failed to delete client');
    }
  };

  const rows = clients.map((c) => ({
    ...c,
    ...getClientStats(c.id, rentals),
  }));

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
            {row.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <span className="font-medium text-foreground">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (row) => {
        if (!row.contact) return <span className="text-muted-foreground">—</span>;
        const isEmail = row.contact.includes('@');
        return (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isEmail ? <Mail size={12} /> : <Phone size={12} />}
            {row.contact}
          </span>
        );
      },
    },
    {
      key: 'totalRentals',
      label: 'Rentals',
      render: (row) => row.totalRentals,
    },
    {
      key: 'totalRevenue',
      label: 'Total Revenue',
      render: (row) => <span className="font-semibold">{formatCurrency(row.totalRevenue)}</span>,
    },
    {
      key: 'avgOrderValue',
      label: 'Avg Order',
      render: (row) => formatCurrency(row.avgOrderValue),
    },
    {
      key: 'tier',
      label: 'Tier',
      render: (row) => (
        <span className={`badge ${tierColor(row.tier)}`}>{row.tier}</span>
      ),
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (row) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => { setEditing(row); setModalOpen(true); }}
            className="btn-ghost !p-1.5"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteTarget(row)}
            className="btn-danger !p-1.5"
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
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} client{clients.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="btn-primary"
        >
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-secondary border-t-primary rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Users size={32} className="mb-3 opacity-40" />
            <p className="text-sm mb-3">No clients yet</p>
            <button onClick={() => { setEditing(null); setModalOpen(true); }} className="btn-primary text-sm">
              <Plus size={14} /> Add your first client
            </button>
          </div>
        ) : (
          <SortableTable columns={columns} data={rows} />
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Client' : 'Add Client'}
      >
        <ClientForm
          client={editing}
          onSaved={() => { setModalOpen(false); loadData(); }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Client"
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
    </div>
  );
}