// Classify a line item as "material" or "labor" using its `type` field, then fall back to unit-based heuristics.
// price_source MUST NOT be used — a material can be estimated if HD search failed.

const MATERIAL_UNITS = new Set([
  'gal', 'gallon', 'gallons',
  'roll', 'rolls',
  'ea', 'each',
  'sheet', 'sheets',
  'piece', 'pieces', 'pc', 'pcs',
  'bag', 'bags',
  'box', 'boxes',
  'lb', 'lbs',
  'ft', 'lf', 'linear ft', 'linear feet',
  'bundle', 'bundles',
  'square', 'sq',
  'ton', 'tons',
  'yard', 'yards', 'yd',
  'lot',
  'pallet', 'pallets',
]);

export type LineItemKind = 'material' | 'labor';

export function classifyLineItem(item: { type?: string | null; unit?: string | null }): LineItemKind {
  const t = (item.type || '').toLowerCase().trim();
  if (t === 'material') return 'material';
  if (t === 'labor') return 'labor';
  const u = (item.unit || '').toLowerCase().trim();
  return MATERIAL_UNITS.has(u) ? 'material' : 'labor';
}
