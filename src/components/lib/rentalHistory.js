import { base44 } from '@/api/base44Client';
import { buildRentalChangeLog } from '@/lib/calc';

// Records a history entry for a rental create/update (errors are swallowed)
export async function recordRentalHistory(oldRental, newRental, equipment, rentalId, action) {
  try {
    const me = await base44.auth.me();
    const userName = me?.full_name || me?.email || 'Unknown';

    if (action === 'updated') {
      const changes = buildRentalChangeLog(oldRental, newRental, equipment);
      if (changes.length === 0) return;
      await base44.entities.RentalHistory.create({
        rental_id: rentalId,
        action: 'updated',
        changes,
        user_name: userName,
      });
    } else {
      const eqName = (id) => equipment.find((e) => e.id === id)?.name || 'Unknown';
      const itemSummary = (newRental.items || []).map((i) => `${eqName(i.equipment_id)} (×${i.quantity})`);
      await base44.entities.RentalHistory.create({
        rental_id: rentalId,
        action: 'created',
        changes: [
          'Rental created',
          `Dates: ${new Date(newRental.start_date).toLocaleString()} → ${new Date(newRental.end_date).toLocaleString()}`,
          ...(itemSummary.length > 0 ? [`Equipment: ${itemSummary.join(', ')}`] : []),
        ],
        user_name: userName,
      });
    }
  } catch (e) {
    console.error('Failed to record rental history:', e);
  }
}