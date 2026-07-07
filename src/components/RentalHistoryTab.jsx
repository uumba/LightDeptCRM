import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { History } from 'lucide-react';

export default function RentalHistoryTab({ rentalId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const records = await base44.entities.RentalHistory.filter(
          { rental_id: rentalId },
          '-created_date',
          100
        );
        if (!mounted) return;
        setHistory(records);
      } catch (e) {
        console.error(e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [rentalId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-secondary border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <History size={28} className="mb-3 opacity-40" />
        <p className="text-sm">No history recorded yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((record) => (
        <div key={record.id} className="border border-border rounded-lg p-3 bg-secondary/30">
          <div className="flex items-center justify-between mb-2">
            <span className={`badge ${record.action === 'created' ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-primary/15 text-primary dark:text-yellow-300'}`}>
              {record.action === 'created' ? 'Created' : 'Updated'}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(record.created_date).toLocaleString()}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            by {record.user_name || 'Unknown'}
          </div>
          {(record.changes || []).length > 0 && (
            <ul className="space-y-1">
              {record.changes.map((change, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">•</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}