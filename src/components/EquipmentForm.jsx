import { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { logAudit, buildEquipmentChangeLog } from '@/lib/auditLog';

export default function EquipmentForm({ equipment, cloneFrom, categories, onSaved, onCancel }) {
  const serialRef = useRef(null);
  const [form, setForm] = useState({
    name: '',
    serial_number: '',
    has_serial: false,
    category: 'Uncategorized',
    price_per_day: 0,
    quantity: 1,
    purchase_price: 0,
    is_subrental: false,
    subrental_cost_per_day: 0,
    subrental_provider: '',
    condition: 'ok',
  });
  const [newCategory, setNewCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (cloneFrom) {
      setForm({
        name: `${cloneFrom.name} (copy)`,
        serial_number: '',
        has_serial: cloneFrom.has_serial || false,
        category: cloneFrom.category || 'Uncategorized',
        price_per_day: cloneFrom.price_per_day || 0,
        quantity: 1,
        purchase_price: cloneFrom.purchase_price || 0,
        is_subrental: cloneFrom.is_subrental || false,
        subrental_cost_per_day: cloneFrom.subrental_cost_per_day || 0,
        subrental_provider: cloneFrom.subrental_provider || '',
        condition: 'ok',
      });
      if (cloneFrom.has_serial) {
        setTimeout(() => serialRef.current?.focus(), 100);
      }
    } else if (equipment) {
      setForm({
        name: equipment.name || '',
        serial_number: equipment.serial_number || '',
        has_serial: equipment.has_serial || false,
        category: equipment.category || 'Uncategorized',
        price_per_day: equipment.price_per_day || 0,
        quantity: equipment.quantity || 1,
        purchase_price: equipment.purchase_price || 0,
        is_subrental: equipment.is_subrental || false,
        subrental_cost_per_day: equipment.subrental_cost_per_day || 0,
        subrental_provider: equipment.subrental_provider || '',
        condition: equipment.condition || 'ok',
      });
    }
  }, [cloneFrom, equipment]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleAddCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    try {
      await base44.entities.Category.create({ name, sort_order: 999 });
      setForm((prev) => ({ ...prev, category: name }));
      setNewCategory('');
      setShowNewCategory(false);
      onSaved?.({ refreshCategories: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        price_per_day: Number(form.price_per_day) || 0,
        quantity: Number(form.quantity) || 1,
        purchase_price: Number(form.purchase_price) || 0,
        serial_number: form.has_serial ? form.serial_number : '',
        quantity: form.has_serial ? 1 : (Number(form.quantity) || 1),
        is_subrental: form.is_subrental,
        subrental_cost_per_day: Number(form.subrental_cost_per_day) || 0,
        subrental_provider: form.subrental_provider || '',
      };
      if (equipment) {
        await base44.entities.Equipment.update(equipment.id, payload);
        const changes = buildEquipmentChangeLog(equipment, payload);
        if (changes.length > 0) {
          await logAudit({ action: 'updated', entityType: 'Equipment', entityId: equipment.id, entityName: payload.name, changes });
        }
      } else {
        const created = await base44.entities.Equipment.create(payload);
        await logAudit({ action: 'created', entityType: 'Equipment', entityId: created.id, entityName: payload.name, changes: [`Created: ${payload.name}`] });
      }
      onSaved?.({ refreshCategories: true });
    } catch (err) {
      console.error(err);
      alert('Failed to save equipment: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Equipment Name *
        </label>
        <input
          className="input-field"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. ARRI SkyPanel S60"
          autoFocus
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Category
        </label>
        {!showNewCategory ? (
          <div className="flex gap-2">
            <select
              className="input-field flex-1"
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
            >
              <option value="Uncategorized">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => setShowNewCategory(true)} className="btn-secondary !px-3">
              + New
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Category name"
              autoFocus
            />
            <button type="button" onClick={handleAddCategory} className="btn-primary !px-3">
              Save
            </button>
            <button type="button" onClick={() => { setShowNewCategory(false); setNewCategory(''); }} className="btn-ghost !px-3">
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => update('has_serial', !form.has_serial)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.has_serial ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.has_serial ? 'translate-x-5' : ''}`}
          />
        </button>
        <span className="text-sm text-foreground">
          Unique item with serial number
          <span className="block text-xs text-muted-foreground">
            {form.has_serial ? 'Single unit tracked by serial number (e.g. cameras, lights)' : 'Bulk quantity-based item (e.g. clamps, sandbags)'}
          </span>
        </span>
      </div>

      {form.has_serial && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Serial Number
          </label>
          <input
            ref={serialRef}
            className="input-field"
            value={form.serial_number}
            onChange={(e) => update('serial_number', e.target.value)}
            placeholder="e.g. ARS60-001"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Price / Day (€)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-field"
            value={form.price_per_day}
            onChange={(e) => update('price_per_day', e.target.value)}
          />
        </div>
        {!form.has_serial && (
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Quantity in Stock
            </label>
            <input
              type="number"
              min="1"
              className="input-field"
              value={form.quantity}
              onChange={(e) => update('quantity', e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Sub-Rental Toggle */}
      <div className="flex items-center gap-3 py-2 border-t border-border pt-4">
        <button
          type="button"
          onClick={() => update('is_subrental', !form.is_subrental)}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${form.is_subrental ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.is_subrental ? 'translate-x-5' : ''}`}
          />
        </button>
        <span className="text-sm text-foreground">
          Sub-rented from another rental
          <span className="block text-xs text-muted-foreground">
            {form.is_subrental ? 'Excluded from general revenue. Track demand to decide what to buy.' : 'Equipment you own outright'}
          </span>
        </span>
      </div>

      {form.is_subrental && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Sub-Rental Cost / Day (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-field"
              value={form.subrental_cost_per_day}
              onChange={(e) => update('subrental_cost_per_day', e.target.value)}
              placeholder="How much you pay per day"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Sub-Rental Provider
            </label>
            <input
              className="input-field"
              value={form.subrental_provider}
              onChange={(e) => update('subrental_provider', e.target.value)}
              placeholder="e.g. John Smith (optional)"
            />
            <p className="text-xs text-muted-foreground mt-1">Leave empty if source is not specified</p>
          </div>
        </div>
      )}

      {!form.is_subrental && (
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Purchase Price (€)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-field"
            value={form.purchase_price}
            onChange={(e) => update('purchase_price', e.target.value)}
          />
        </div>
      )}

      {/* Condition */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Condition
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'ok', label: 'OK', color: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30' },
            { value: 'broken', label: 'Broken', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30' },
            { value: 'lost', label: 'Lost', color: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('condition', opt.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                form.condition === opt.value
                  ? `${opt.color} ring-2 ring-primary/30`
                  : 'bg-secondary text-secondary-foreground border-border hover:bg-secondary/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : equipment ? 'Update Equipment' : 'Add Equipment'}
        </button>
      </div>
    </form>
  );
}