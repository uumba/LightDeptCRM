import { useState, useRef, useEffect } from 'react';
import { Search, Check, X } from 'lucide-react';

export default function EquipmentSelect({
  equipment,
  value,
  onChange,
  getAvailabilityLabel,
  excludeIds = [],
  placeholder = 'Select equipment…',
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const selected = equipment.find((e) => e.id === value);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Token-based search (word order independent)
  const q = search.toLowerCase().trim();
  const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

  const visible = equipment.filter((e) => !excludeIds.includes(e.id));

  const filtered = tokens.length === 0
    ? visible
    : visible.filter((e) => {
        const haystack = `${e.name || ''} ${e.serial_number || ''} ${e.category || ''}`.toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });

  // Group by category
  const grouped = filtered.reduce((acc, eq) => {
    const cat = eq.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(eq);
    return acc;
  }, {});

  const handleSelect = (id) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const showSearch = open || !selected;

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      {showSearch ? (
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            className="input-field !py-1.5 pl-8"
            placeholder={selected ? selected.name : placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setOpen(true)}
            autoFocus
          />
          {selected && (
            <button
              type="button"
              onClick={() => { onChange(''); setSearch(''); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="input-field !py-1.5 flex items-center justify-between cursor-pointer text-left"
          onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        >
          <span className="text-sm font-medium truncate">{selected.name}</span>
          <span className="text-xs text-muted-foreground ml-2 shrink-0">
            {getAvailabilityLabel?.(selected.id) || ''}
          </span>
        </button>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground text-center">No matches found</div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/40 sticky top-0">
                  {category}
                </div>
                {items.map((eq) => (
                  <button
                    key={eq.id}
                    type="button"
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-secondary/70 transition-colors text-left"
                    onClick={() => handleSelect(eq.id)}
                  >
                    <span className="truncate">
                      {eq.name}
                      {eq.has_serial && eq.serial_number && (
                        <span className="text-xs text-primary ml-1.5 font-mono">#{eq.serial_number}</span>
                      )}
                      <span className="text-xs text-muted-foreground ml-1.5">${eq.price_per_day}/d</span>
                      {eq.is_subrental && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 ml-1.5">
                          {eq.subrental_provider ? `from ${eq.subrental_provider}` : 'sub-rental'}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {getAvailabilityLabel?.(eq.id) && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {getAvailabilityLabel(eq.id)}
                        </span>
                      )}
                      {eq.id === value && <Check size={14} className="text-primary" />}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}