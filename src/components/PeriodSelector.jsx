import { getPeriodRange } from '@/lib/calc';

const PRESETS = [
  { value: 'week', label: 'Week' },
  { value: '30d', label: '30 Days' },
  { value: '60d', label: '60 Days' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

export default function PeriodSelector({ period, onChange }) {
  const update = (field, value) => onChange({ ...period, [field]: value });

  return (
    <div className="bg-card rounded-xl border border-border p-4 mb-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => update('preset', p.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                period.preset === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/70'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period.preset === 'custom' && (
          <div className="flex items-end gap-3 ml-auto">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">From</label>
              <input
                type="date"
                className="input-field"
                value={period.start}
                onChange={(e) => update('start', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">To</label>
              <input
                type="date"
                className="input-field"
                value={period.end}
                onChange={(e) => update('end', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { PRESETS, getPeriodRange };