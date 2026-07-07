import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Tags } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import Modal from '@/components/Modal';
import { CATEGORY_COLOR_OPTIONS, getColorOption } from '@/lib/categoryColors';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', sort_order: 999, color: 'stone' });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [cats, eq] = await Promise.all([
        base44.entities.Category.list('sort_order', 500),
        base44.entities.Equipment.list('-created_date', 500),
      ]);
      setCategories(cats);
      setEquipment(eq);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAdd = async () => {
    if (!newCat.name.trim()) return;
    try {
      await base44.entities.Category.create({
        name: newCat.name.trim(),
        sort_order: Number(newCat.sort_order) || 999,
        color: newCat.color || 'stone',
      });
      setNewCat({ name: '', sort_order: 999, color: 'stone' });
      setShowAdd(false);
      loadData();
    } catch (e) {
      alert('Failed to create category: ' + (e.message || 'Unknown error'));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const affected = equipment.filter((e) => e.category === deleteTarget.name);
      for (const eq of affected) {
        await base44.entities.Equipment.update(eq.id, { category: 'Uncategorized' });
      }
      await base44.entities.Category.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    } catch (e) {
      alert('Failed to delete category: ' + (e.message || 'Unknown error'));
    }
  };

  const handleColorChange = async (cat, colorKey) => {
    try {
      await base44.entities.Category.update(cat.id, { color: colorKey });
      loadData();
    } catch (e) {
      alert('Failed to update color: ' + (e.message || 'Unknown error'));
    }
  };

  const countFor = (name) => equipment.filter((e) => e.category === name).length;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} configured
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus size={16} /> Add Category
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-secondary border-t-primary rounded-full animate-spin" />
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Tags size={32} className="mb-3 opacity-40" />
            <p className="text-sm mb-3">No categories yet</p>
            <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
              <Plus size={14} /> Create your first category
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Sort Order</th>
                <th>Name</th>
                <th>Color</th>
                <th className="text-right">Equipment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id}>
                  <td className="font-mono text-xs text-muted-foreground">{cat.sort_order ?? 999}</td>
                  <td className="font-medium">{cat.name}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {CATEGORY_COLOR_OPTIONS.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => handleColorChange(cat, opt.key)}
                          className={`w-5 h-5 rounded-full ${opt.dot} transition-all duration-150 hover:scale-110 ${
                            (cat.color || 'stone') === opt.key ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'opacity-40 hover:opacity-80'
                          }`}
                          title={opt.label}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="text-right">{countFor(cat.name)}</td>
                  <td className="text-right">
                    <button onClick={() => setDeleteTarget(cat)} className="btn-danger !p-1.5">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Category"
        size="sm"
        footer={
          <>
            <button onClick={() => setShowAdd(false)} className="btn-ghost">Cancel</button>
            <button onClick={handleAdd} disabled={!newCat.name.trim()} className="btn-primary">Save</button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Category Name *
            </label>
            <input
              className="input-field"
              value={newCat.name}
              onChange={(e) => setNewCat((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Modifiers"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Sort Order
            </label>
            <input
              type="number"
              min="0"
              className="input-field"
              value={newCat.sort_order}
              onChange={(e) => setNewCat((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">Lower numbers appear first in equipment lists and PDFs</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setNewCat((prev) => ({ ...prev, color: opt.key }))}
                  className={`w-7 h-7 rounded-full ${opt.dot} transition-all duration-150 hover:scale-110 ${
                    (newCat.color || 'stone') === opt.key ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'opacity-40 hover:opacity-80'
                  }`}
                  title={opt.label}
                />
              ))}
            </div>
            <div className="mt-2">
              <span className={`badge ${getColorOption(newCat.color || 'stone').className}`}>
                {newCat.name || 'Preview'}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Category"
        size="sm"
        footer={
          <>
            <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Cancel</button>
            <button onClick={handleDelete} className="btn-primary !bg-destructive !text-destructive-foreground">Delete</button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>?
          {deleteTarget && countFor(deleteTarget.name) > 0 && (
            <span className="block mt-2">
              {countFor(deleteTarget.name)} equipment item{countFor(deleteTarget.name) !== 1 ? 's' : ''} will be reassigned to{' '}
              <span className="font-medium">Uncategorized</span>.
            </span>
          )}
        </p>
      </Modal>
    </div>
  );
}