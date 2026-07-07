import { base44 } from '@/api/base44Client';

// Records a global audit log entry (errors are swallowed — never blocks the operation)
export async function logAudit({ action, entityType, entityId, entityName, changes }) {
  try {
    const me = await base44.auth.me();
    const userName = me?.full_name || me?.email || 'Unknown';
    await base44.entities.AuditLog.create({
      action,
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName || '',
      changes: changes || [],
      user_name: userName,
    });
  } catch (e) {
    console.error('Failed to log audit:', e);
  }
}

// Compares old and new equipment data, returns human-readable change descriptions
export function buildEquipmentChangeLog(oldEq, newEq) {
  const changes = [];
  const fields = [
    { key: 'price_per_day', label: 'Price/Day' },
    { key: 'purchase_price', label: 'Purchase Price' },
    { key: 'subrental_cost_per_day', label: 'Subrental Cost/Day' },
    { key: 'subrental_provider', label: 'Sub-Rental Provider' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'condition', label: 'Condition' },
    { key: 'is_subrental', label: 'Sub-rental' },
  ];
  fields.forEach(({ key, label }) => {
    const oldVal = oldEq?.[key];
    const newVal = newEq?.[key];
    if (String(oldVal) !== String(newVal)) {
      changes.push(`${label}: ${oldVal ?? '—'} → ${newVal ?? '—'}`);
    }
  });
  return changes;
}