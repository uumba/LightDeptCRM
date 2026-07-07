import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function ClientForm({ client, onSaved, onCancel }) {
  const [form, setForm] = useState({ name: '', contact: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        name: client.name || '',
        contact: client.contact || '',
        notes: client.notes || '',
      });
    }
  }, [client]);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (client) {
        await base44.entities.Client.update(client.id, form);
      } else {
        await base44.entities.Client.create(form);
      }
      onSaved?.();
    } catch (err) {
      console.error(err);
      alert('Failed to save client: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Client Name *
        </label>
        <input
          className="input-field"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Pixel Productions"
          autoFocus
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Contact (Email or Phone)
        </label>
        <input
          className="input-field"
          value={form.contact}
          onChange={(e) => update('contact', e.target.value)}
          placeholder="info@pixel.com or 555-0142"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
          Notes
        </label>
        <textarea
          className="input-field min-h-[80px] resize-y"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Working preferences, special requirements, billing details…"
        />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-ghost">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : client ? 'Update Client' : 'Add Client'}
        </button>
      </div>
    </form>
  );
}