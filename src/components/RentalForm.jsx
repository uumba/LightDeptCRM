import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Package, AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { daysBetween, calculateRentalPrice, formatCurrency, getReservedQuantity } from '@/lib/calc';
import { recordRentalHistory } from '@/lib/rentalHistory';
import EquipmentSelect from './EquipmentSelect';

function toLocalDateTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function defaultEndDate(startDateStr) {
  if (!startDateStr) return '';
  const start = new Date(startDateStr);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return toLocalDateTime(end);
}

export default function RentalForm({ rental, duplicateFrom, clients, equipment, categories = [], rentals = [], onSaved, onCancel, onClientCreated }) {
  const [form, setForm] = useState({
    client_id: '',
    start_date: toLocalDateTime(new Date()),
    end_date: '',
    status: 'active',
    discount: 0,
    notes: '',
    is_paid: false,
    items: [],
  });
  const [saving, setSaving] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', contact: '' });
  const [savingClient, setSavingClient] = useState(false);

  useEffect(() => {
    if (duplicateFrom) {
      const now = toLocalDateTime(new Date());
      setForm({
        client_id: duplicateFrom.client_id || '',
        start_date: now,
        end_date: defaultEndDate(now),
        status: 'active',
        discount: duplicateFrom.discount || 0,
        notes: duplicateFrom.notes || '',
        is_paid: false,
        items: (duplicateFrom.items || []).map((i) => ({ ...i })),
      });
    } else if (rental) {
      setForm({
        client_id: rental.client_id || '',
        start_date: toLocalDateTime(rental.start_date) || toLocalDateTime(new Date()),
        end_date: toLocalDateTime(rental.end_date) || '',
        status: rental.status || 'active',
        discount: rental.discount || 0,
        notes: rental.notes || '',
        is_paid: rental.is_paid || false,
        items: (rental.items || []).map((i) => ({ ...i })),
      });
    } else {
      const now = toLocalDateTime(new Date());
      setForm((prev) => ({
        ...prev,
        start_date: now,
        end_date: defaultEndDate(now),
      }));
    }
  }, [rental, duplicateFrom]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleStartDateChange = (val) => {
    setForm((prev) => ({
      ...prev,
      start_date: val,
      end_date: defaultEndDate(val),
    }));
  };

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) return;
    setSavingClient(true);
    try {
      const created = await base44.entities.Client.create({
        name: newClient.name.trim(),
        contact: newClient.contact.trim(),
      });
      onClientCreated?.(created);
      update('client_id', created.id);
      setShowNewClient(false);
      setNewClient({ name: '', contact: '' });
    } catch (e) {
      alert('Failed to create client: ' + (e.message || 'Unknown error'));
    } finally {
      setSavingClient(false);
    }
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { equipment_id: '', quantity: 1, price_per_day: 0 }],
    }));
  };

  const updateItem = (index, field, value) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'equipment_id') {
        const eq = equipment.find((e) => e.id === value);
        if (eq) {
          items[index].price_per_day = eq.price_per_day;
        }
      }
      if (field === 'quantity') {
        items[index].quantity = Math.max(1, Number(value) || 1);
      }
      return { ...prev, items };
    });
  };

  const removeItem = (index) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Serial items already used in other rows → hide from search
  const getExcludeIds = (itemIndex) => {
    return form.items
      .filter((_, i) => i !== itemIndex)
      .filter((it) => {
        const eq = equipment.find((e) => e.id === it.equipment_id);
        return eq?.has_serial;
      })
      .map((it) => it.equipment_id);
  };

  // Equipment available for selection — excludes broken/lost items,
  // but keeps items already in this rental (so editing still works)
  const availableEquipment = useMemo(() => {
    const selectedItemIds = new Set(form.items.map((i) => i.equipment_id).filter(Boolean));
    return equipment.filter((e) => {
      if (e.condition === 'broken' || e.condition === 'lost') {
        return selectedItemIds.has(e.id);
      }
      return true;
    });
  }, [equipment, form.items]);

  const availabilityMap = useMemo(() => {
    const map = {};
    if (!form.start_date || !form.end_date) return map;
    equipment.forEach((eq) => {
      const total = Number(eq.quantity) || 1;
      const reserved = getReservedQuantity(eq.id, form.start_date, form.end_date, rentals, rental?.id);
      map[eq.id] = Math.max(0, total - reserved);
    });
    return map;
  }, [equipment, form.start_date, form.end_date, rentals, rental]);

  const getAvailableForItem = (equipmentId, itemIndex) => {
    const external = availabilityMap[equipmentId];
    if (external === undefined) return null;
    const internalReserved = form.items
      .filter((_, i) => i !== itemIndex)
      .filter((it) => it.equipment_id === equipmentId)
      .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    return Math.max(0, external - internalReserved);
  };

  const days = useMemo(() => daysBetween(form.start_date, form.end_date), [form.start_date, form.end_date]);

  const { basePrice, discountAmount, finalPrice } = useMemo(
    () => calculateRentalPrice(form.items, days, form.discount),
    [form.items, days, form.discount]
  );

  const subrentalBreakdown = useMemo(() => {
    const byProvider = {};
    form.items.forEach((item) => {
      if (!item.equipment_id) return;
      const eq = equipment.find((e) => e.id === item.equipment_id);
      if (!eq?.is_subrental) return;
      const costPerDay = Number(eq.subrental_cost_per_day) || 0;
      const qty = Number(item.quantity) || 1;
      const cost = costPerDay * qty * days;
      const provider = eq.subrental_provider?.trim() || 'Unspecified';
      if (!byProvider[provider]) byProvider[provider] = { amount: 0, items: [] };
      byProvider[provider].amount += cost;
      byProvider[provider].items.push(`${eq.name} ×${qty}`);
    });
    const providers = Object.entries(byProvider)
      .map(([name, { amount, items }]) => ({ name, amount, items }))
      .sort((a, b) => b.amount - a.amount);
    const total = providers.reduce((sum, p) => sum + p.amount, 0);
    return { providers, total };
  }, [form.items, equipment, days]);

  const hasConflicts = useMemo(() => {
    return form.items.some((item, idx) => {
      if (!item.equipment_id) return false;
      const external = availabilityMap[item.equipment_id];
      if (external === undefined) return false;
      const internalReserved = form.items
        .filter((_, i) => i !== idx)
        .filter((it) => it.equipment_id === item.equipment_id)
        .reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const available = Math.max(0, external - internalReserved);
      return (Number(item.quantity) || 0) > available;
    });
  }, [form.items, availabilityMap]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_id) {
      alert('Please select a client');
      return;
    }
    if (!form.start_date || !form.end_date) {
      alert('Please set start and end dates');
      return;
    }
    // Block broken/lost equipment in new rentals
    if (!rental) {
      const brokenItems = form.items
        .filter((i) => i.equipment_id)
        .map((i) => equipment.find((e) => e.id === i.equipment_id))
        .filter((e) => e && (e.condition === 'broken' || e.condition === 'lost'));
      if (brokenItems.length > 0) {
        alert('Cannot add broken or lost equipment to a new rental:\n\n' + brokenItems.map((e) => e.name).join('\n'));
        return;
      }
    }
    // Availability check
    const conflicts = [];
    form.items.filter((i) => i.equipment_id).forEach((item, idx) => {
      const available = getAvailableForItem(item.equipment_id, idx);
      if (available !== null && (Number(item.quantity) || 0) > available) {
        const eq = equipment.find((e) => e.id === item.equipment_id);
        conflicts.push(`${eq?.name || 'Equipment'}: requested ${item.quantity}, only ${available} available for these dates`);
      }
    });
    if (conflicts.length > 0) {
      alert('Availability conflict:\n\n' + conflicts.join('\n'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        client_id: form.client_id,
        start_date: new Date(form.start_date).toISOString(),
        end_date: new Date(form.end_date).toISOString(),
        status: form.status,
        discount: Number(form.discount) || 0,
        notes: form.notes || '',
        is_paid: form.is_paid,
        items: form.items.filter((i) => i.equipment_id).map((i) => ({
          equipment_id: i.equipment_id,
          quantity: Number(i.quantity) || 1,
          price_per_day: Number(i.price_per_day) || 0,
        })),
      };
      if (rental) {
        await base44.entities.Rental.update(rental.id, payload);
        await recordRentalHistory(rental, payload, equipment, rental.id, 'updated');
      } else {
        const created = await base44.entities.Rental.create(payload);
        await recordRentalHistory(null, payload, equipment, created.id, 'created');
      }
      onSaved?.();
    } catch (err) {
      console.error(err);
      alert('Failed to save rental: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Client + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client *</label>
            <button
              type="button"
              onClick={() => setShowNewClient(!showNewClient)}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <UserPlus size={12} /> {showNewClient ? 'Cancel' : 'New'}
            </button>
          </div>
          {showNewClient ? (
            <div className="space-y-2">
              <input
                className="input-field"
                placeholder="Client name"
                value={newClient.name}
                onChange={(e) => setNewClient((prev) => ({ ...prev, name: e.target.value }))}
                autoFocus
              />
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Contact (email/phone)"
                  value={newClient.contact}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, contact: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={handleCreateClient}
                  disabled={savingClient || !newClient.name.trim()}
                  className="btn-primary !py-2"
                >
                  {savingClient ? '…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <select
              className="input-field"
              value={form.client_id}
              onChange={(e) => update('client_id', e.target.value)}
              required
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Status
          </label>
          <select
            className="input-field"
            value={form.status}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="reserved">Reserved</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Start Date & Time
          </label>
          <input
            type="datetime-local"
            className="input-field"
            value={form.start_date}
            onChange={(e) => handleStartDateChange(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            End Date & Time
          </label>
          <input
            type="datetime-local"
            className="input-field"
            value={form.end_date}
            onChange={(e) => update('end_date', e.target.value)}
            required
          />
        </div>
      </div>

      {/* Equipment Items */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Equipment
        </label>

        {form.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 border border-dashed border-border rounded-lg text-muted-foreground">
            <Package size={24} className="mb-2 opacity-40" />
            <span className="text-xs">No equipment added yet</span>
            <button type="button" onClick={addItem} className="btn-ghost mt-2 text-xs">
              <Plus size={14} /> Add Item
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {form.items.map((item, idx) => {
              const available = item.equipment_id ? getAvailableForItem(item.equipment_id, idx) : null;
              const eq = equipment.find((e) => e.id === item.equipment_id);
              const isOver = available !== null && (Number(item.quantity) || 0) > available;
              return (
                <div key={idx} className="bg-secondary/50 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <EquipmentSelect
                      equipment={availableEquipment}
                      value={item.equipment_id}
                      onChange={(id) => updateItem(idx, 'equipment_id', id)}
                      excludeIds={getExcludeIds(idx)}
                      getAvailabilityLabel={(eqId) => {
                        const avail = availabilityMap[eqId];
                        const hasDates = form.start_date && form.end_date;
                        return hasDates && avail !== undefined ? `${avail} avail.` : '';
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      className="input-field w-20 !py-1.5 text-center"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-field w-20 !py-1.5 text-center"
                      value={item.price_per_day}
                      onChange={(e) => updateItem(idx, 'price_per_day', e.target.value)}
                      title="Price per day"
                    />
                    <button type="button" onClick={() => removeItem(idx)} className="btn-danger !p-1.5">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {item.equipment_id && (
                    <div className="flex items-center gap-2 mt-1.5 px-1 text-xs">
                      {eq?.category && (
                        <span className="badge bg-primary/10 text-primary">{eq.category}</span>
                      )}
                      {eq?.is_subrental && (
                        <span className="badge bg-blue-500/15 text-blue-600 dark:text-blue-400">
                          Sub{eq.subrental_provider ? ` · ${eq.subrental_provider}` : ''}
                        </span>
                      )}
                      {available !== null && (
                        <span className={`flex items-center gap-1 ${isOver ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {isOver
                            ? <AlertTriangle size={12} />
                            : <CheckCircle2 size={12} className="text-green-500" />}
                          {isOver
                            ? `Only ${available} available (requested ${item.quantity})`
                            : `${available} of ${Number(eq?.quantity) || 1} avail.`}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {/* Add item button at bottom, left-aligned */}
            <button type="button" onClick={addItem} className="btn-ghost text-xs">
              <Plus size={14} /> Add Item
            </button>
          </div>
        )}
      </div>

      {/* Price Summary */}
      <div className="bg-secondary/40 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Rental Days</span>
          <span className="text-sm font-semibold">{days} day{days !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Base Price</span>
          <span className="text-sm font-semibold">{formatCurrency(basePrice)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Discount (%)</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            className="input-field w-24 !py-1 text-right"
            value={form.discount}
            onChange={(e) => update('discount', e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Discount Amount</span>
          <span className="text-sm font-semibold text-destructive">−{formatCurrency(discountAmount)}</span>
        </div>
        <div className="h-px bg-border my-1" />
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">Final Price</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(finalPrice)}</span>
        </div>
        {subrentalBreakdown.providers.length > 0 && (
          <>
            <div className="h-px bg-border my-1" />
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-1 pb-0.5">
              Sub-Rental Costs (you owe)
            </div>
            {subrentalBreakdown.providers.map((p) => (
              <div key={p.name} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="block text-[10px] text-muted-foreground/70 truncate">{p.items.join(', ')}</span>
                </div>
                <span className="font-medium text-blue-600 dark:text-blue-400 shrink-0 ml-2">{formatCurrency(p.amount)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-sm pt-1 border-t border-border/50">
              <span className="text-muted-foreground font-medium">Total You Owe</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">{formatCurrency(subrentalBreakdown.total)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net Margin</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(finalPrice - subrentalBreakdown.total)}</span>
                </div>
          </>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Notes
        </label>
        <textarea
          className="input-field min-h-[80px] resize-y"
          placeholder="Optional notes for this rental…"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_paid}
            onChange={(e) => update('is_paid', e.target.checked)}
            className="w-4 h-4 rounded border-input"
          />
          Paid
        </label>
        <div className="flex flex-col items-end gap-1.5">
          {hasConflicts && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle size={12} /> Resolve availability conflicts before saving
            </p>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={saving || hasConflicts} className="btn-primary">
              {saving ? 'Saving…' : rental ? 'Update Rental' : 'Create Rental'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}