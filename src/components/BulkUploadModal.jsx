import { Upload, Download, FileSpreadsheet, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

const HEADERS = [
  'name',
  'serial_number',
  'has_serial',
  'category',
  'price_per_day',
  'quantity',
  'purchase_price',
  'is_subrental',
  'subrental_cost_per_day',
  'condition',
];

function escapeCSV(value) {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadTemplate() {
  const exampleRows = [
    ['ARRI SkyPanel S60', 'ARS60-001', 'true', 'Lighting', '85', '1', '3200', 'false', '0', 'ok'],
    ['C-Stand 40"', '', 'false', 'Grip', '5', '20', '75', 'false', '0', 'ok'],
    ['RED Komodo 6K (Sub)', 'RK-002', 'true', 'Camera', '150', '1', '0', 'true', '90', 'ok'],
    ['Sandbag', '', 'false', 'Grip', '1', '50', '8', 'false', '0', 'ok'],
    ['Aputure 600d (Sub)', '', 'false', 'Lighting', '70', '3', '0', 'true', '45', 'ok'],
  ];

  const lines = [HEADERS.join(',')];
  // Insert comment row for guidance
  lines.push('# name(required) | serial_number | has_serial(true/false) | category | price_per_day(€) | quantity | purchase_price(€) | is_subrental(true/false) | subrental_cost_per_day(€) | condition(ok/broken/lost)');
  exampleRows.forEach((row) => {
    lines.push(row.map(escapeCSV).join(','));
  });

  const csv = lines.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'equipment_bulk_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const rows = [];
  let i = 0;
  let row = [];
  let cell = '';
  let inQuotes = false;
  const len = text.length;

  while (i < len) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      cell += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i++; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    cell += ch; i++;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 0 && !(r.length === 1 && r[0].trim() === ''));
}

function toBool(value) {
  const s = String(value).toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
}

function toNumber(value) {
  const n = Number(String(value).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function parseEquipmentCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { items: [], errors: ['File is empty or has no data rows'] };

  const headerRow = rows[0].map((h) => h.trim().toLowerCase());
  // Find data rows (skip comment rows starting with #)
  const dataRows = rows.slice(1).filter((r) => r[0] && !r[0].trim().startsWith('#'));

  const colMap = {};
  HEADERS.forEach((h) => {
    const idx = headerRow.indexOf(h);
    if (idx >= 0) colMap[h] = idx;
  });

  const errors = [];
  const items = [];

  dataRows.forEach((row, i) => {
    const get = (key) => (colMap[key] !== undefined ? row[colMap[key]]?.trim() : '');

    const name = get('name');
    if (!name) {
      errors.push(`Row ${i + 2}: missing name, skipped`);
      return;
    }

    const hasSerial = toBool(get('has_serial'));
    const isSubrental = toBool(get('is_subrental'));
    const condition = ['ok', 'broken', 'lost'].includes(get('condition').toLowerCase())
      ? get('condition').toLowerCase()
      : 'ok';

    items.push({
      name,
      serial_number: hasSerial ? get('serial_number') : '',
      has_serial: hasSerial,
      category: get('category') || 'Uncategorized',
      price_per_day: toNumber(get('price_per_day')),
      quantity: hasSerial ? 1 : Math.max(1, toNumber(get('quantity')) || 1),
      purchase_price: isSubrental ? 0 : toNumber(get('purchase_price')),
      is_subrental: isSubrental,
      subrental_cost_per_day: isSubrental ? toNumber(get('subrental_cost_per_day')) : 0,
      condition,
    });
  });

  return { items, errors };
}

export default function BulkUploadModal({ open, onClose, categories, onDone }) {
  const inputRef = useRef(null);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  if (!open) return null;

  const handleFile = async (file) => {
    if (!file) return;
    setParsing(true);
    setResult(null);
    try {
      const text = await file.text();
      const { items, errors } = parseEquipmentCSV(text);
      if (items.length === 0) {
        setResult({ success: 0, errors: errors.length ? errors : ['No valid items found in file'] });
        setParsing(false);
        return;
      }

      // Collect any new categories to create
      const existing = new Set(categories.map((c) => c.name.toLowerCase()));
      const newCats = [...new Set(items.map((i) => i.category))].filter(
        (c) => c && c !== 'Uncategorized' && !existing.has(c.toLowerCase())
      );
      if (newCats.length) {
        await Promise.all(newCats.map((c) => base44.entities.Category.create({ name: c, sort_order: 999 })));
      }

      // Bulk create equipment
      await base44.entities.Equipment.bulkCreate(items);
      setResult({ success: items.length, errors });
      onDone?.();
    } catch (e) {
      console.error(e);
      setResult({ success: 0, errors: ['Upload failed: ' + (e.message || 'Unknown error')] });
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ paddingTop: '5vh' }}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <FileSpreadsheet size={18} /> Bulk Upload Equipment
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {/* Template download */}
          <div className="flex items-start gap-3 bg-secondary/40 rounded-lg p-4">
            <Download size={20} className="text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Download template</p>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                CSV file with example rows showing how to fill equipment data, including sub-rental items.
              </p>
              <button onClick={downloadTemplate} className="btn-secondary text-sm">
                <Download size={14} /> Download CSV Template
              </button>
            </div>
          </div>

          {/* Upload area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload size={32} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">
              {parsing ? 'Processing…' : 'Drop CSV file here or click to browse'}
            </p>
            <p className="text-xs text-muted-foreground mb-3">Supports .csv files</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleInputChange}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={parsing}
              className="btn-primary text-sm"
            >
              {parsing ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload size={14} /> Choose File
                </>
              )}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-2">
              {result.success > 0 && (
                <div className="flex items-center gap-2 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg p-3 text-sm">
                  <FileSpreadsheet size={16} />
                  Successfully created {result.success} item{result.success !== 1 ? 's' : ''}
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-xs space-y-1">
                  <p className="font-semibold">Warnings / Errors:</p>
                  {result.errors.slice(0, 10).map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                  {result.errors.length > 10 && <p>…and {result.errors.length - 10} more</p>}
                </div>
              )}
              {result.success > 0 && (
                <button onClick={onClose} className="btn-primary w-full">Done</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}