export const CATEGORY_COLOR_OPTIONS = [
  { key: 'amber',   label: 'Amber',   className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',     dot: 'bg-amber-500' },
  { key: 'purple',  label: 'Purple',  className: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',   dot: 'bg-purple-500' },
  { key: 'pink',    label: 'Pink',    className: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',         dot: 'bg-pink-500' },
  { key: 'orange',  label: 'Orange',  className: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',   dot: 'bg-orange-500' },
  { key: 'cyan',    label: 'Cyan',    className: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',         dot: 'bg-cyan-500' },
  { key: 'stone',   label: 'Stone',   className: 'bg-stone-500/15 text-stone-600 dark:text-stone-400',      dot: 'bg-stone-500' },
  { key: 'red',     label: 'Red',     className: 'bg-red-500/15 text-red-600 dark:text-red-400',           dot: 'bg-red-500' },
  { key: 'blue',    label: 'Blue',    className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',        dot: 'bg-blue-500' },
  { key: 'green',   label: 'Green',   className: 'bg-green-500/15 text-green-600 dark:text-green-400',      dot: 'bg-green-500' },
  { key: 'indigo',  label: 'Indigo',  className: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',   dot: 'bg-indigo-500' },
  { key: 'teal',    label: 'Teal',    className: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',         dot: 'bg-teal-500' },
  { key: 'rose',    label: 'Rose',    className: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',         dot: 'bg-rose-500' },
];

const FALLBACK_MAP = {
  'Lighting': 'amber',
  'DMX/CRMX': 'purple',
  'Modifiers': 'pink',
  'Frames': 'orange',
  'Stands': 'cyan',
  'Grip': 'stone',
  'Power distribution': 'red',
  'Accessories': 'blue',
};

export function getColorOption(key) {
  return CATEGORY_COLOR_OPTIONS.find((c) => c.key === key) || CATEGORY_COLOR_OPTIONS[0];
}

export function getCategoryColorKey(name, categories) {
  const cat = (categories || []).find((c) => c.name === name);
  if (cat?.color) return cat.color;
  return FALLBACK_MAP[name] || 'stone';
}

export function getCategoryColorClass(name, categories) {
  return getColorOption(getCategoryColorKey(name, categories)).className;
}