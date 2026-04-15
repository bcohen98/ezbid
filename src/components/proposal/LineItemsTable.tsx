import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import UnitCombobox from './UnitCombobox';
import type { TradeType } from './TradeSelector';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  aiSuggested?: boolean;
}

const tradeDefaults: Record<TradeType, { description: string; unit: string }[]> = {
  roofing: [
    { description: 'Tear Off', unit: 'sq' },
    { description: 'Underlayment', unit: 'sq' },
    { description: 'Shingles', unit: 'sq' },
    { description: 'Flashing', unit: 'lf' },
    { description: 'Ridge Cap', unit: 'lf' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Dump Fee', unit: 'ea' },
  ],
  landscaping: [
    { description: 'Sod', unit: 'sq ft' },
    { description: 'Mulch', unit: 'cu yd' },
    { description: 'Plants', unit: 'ea' },
    { description: 'Irrigation', unit: 'ea' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Cleanup', unit: 'ea' },
  ],
  hvac: [
    { description: 'Equipment', unit: 'ea' },
    { description: 'Refrigerant', unit: 'lb' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Permit', unit: 'ea' },
  ],
  plumbing: [
    { description: 'Parts', unit: 'ea' },
    { description: 'Fixtures', unit: 'ea' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Permit', unit: 'ea' },
  ],
  electrical: [
    { description: 'Materials', unit: 'ea' },
    { description: 'Fixtures', unit: 'ea' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Permit', unit: 'ea' },
  ],
  painting: [
    { description: 'Primer', unit: 'gal' },
    { description: 'Paint', unit: 'gal' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Surface Prep', unit: 'hr' },
  ],
  general_contractor: [
    { description: 'Materials', unit: 'ea' },
    { description: 'Subcontractors', unit: 'ea' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Permit', unit: 'ea' },
  ],
  pressure_washing: [
    { description: 'Equipment', unit: 'ea' },
    { description: 'Cleaning Agents', unit: 'ea' },
    { description: 'Labor', unit: 'hr' },
  ],
  foundation: [
    { description: 'Excavation', unit: 'cu yd' },
    { description: 'Concrete', unit: 'cu yd' },
    { description: 'Rebar', unit: 'lf' },
    { description: 'Waterproofing', unit: 'sq ft' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Permit', unit: 'ea' },
  ],
  flooring: [
    { description: 'Flooring Material', unit: 'sq ft' },
    { description: 'Underlayment', unit: 'sq ft' },
    { description: 'Adhesive', unit: 'ea' },
    { description: 'Trim and Transitions', unit: 'lf' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Removal and Disposal', unit: 'ea' },
  ],
  cabinetry: [
    { description: 'Cabinets', unit: 'ea' },
    { description: 'Hardware', unit: 'ea' },
    { description: 'Countertop', unit: 'lf' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Removal and Disposal', unit: 'ea' },
  ],
  carpentry: [
    { description: 'Lumber', unit: 'bf' },
    { description: 'Fasteners and Hardware', unit: 'ea' },
    { description: 'Finish Materials', unit: 'ea' },
    { description: 'Labor', unit: 'hr' },
  ],
  masonry: [
    { description: 'Brick / Block', unit: 'ea' },
    { description: 'Mortar', unit: 'bag' },
    { description: 'Rebar', unit: 'lf' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Scaffolding', unit: 'ea' },
  ],
  asphalt: [
    { description: 'Asphalt (Hot Mix)', unit: 'ton' },
    { description: 'Gravel Base', unit: 'ton' },
    { description: 'Sealcoat', unit: 'sq ft' },
    { description: 'Striping', unit: 'lf' },
    { description: 'Labor', unit: 'hr' },
    { description: 'Equipment', unit: 'ea' },
  ],
  concrete: [
    { description: 'Concrete', unit: 'cu yd' },
    { description: 'Rebar / Wire Mesh', unit: 'lf' },
    { description: 'Forms', unit: 'lf' },
    { description: 'Gravel Base', unit: 'ton' },
    { description: 'Finishing', unit: 'sq ft' },
    { description: 'Labor', unit: 'hr' },
  ],
  other: [],
};

let idCounter = 0;
const newId = () => `li_${Date.now()}_${++idCounter}`;

function makeDefaults(trade: TradeType): LineItem[] {
  return tradeDefaults[trade].map(d => ({
    id: newId(),
    description: d.description,
    quantity: 1,
    unit: d.unit,
    unit_price: 0,
  }));
}

interface Props {
  trade: TradeType;
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  taxEnabled: boolean;
  taxRate: number;
  discountEnabled: boolean;
  discountMode: 'flat' | 'percentage';
  discountValue: number;
  depositEnabled: boolean;
  depositMode: 'flat' | 'percentage';
  depositValue: number;
  onTaxToggle: (v: boolean) => void;
  onTaxRateChange: (v: number) => void;
  onDiscountToggle: (v: boolean) => void;
  onDiscountModeChange: (v: 'flat' | 'percentage') => void;
  onDiscountValueChange: (v: number) => void;
  onDepositToggle: (v: boolean) => void;
  onDepositModeChange: (v: 'flat' | 'percentage') => void;
  onDepositValueChange: (v: number) => void;
}

export default function LineItemsTable({
  trade, items, onChange,
  taxEnabled, taxRate, discountEnabled, discountMode, discountValue,
  depositEnabled, depositMode, depositValue,
  onTaxToggle, onTaxRateChange, onDiscountToggle, onDiscountModeChange, onDiscountValueChange,
  onDepositToggle, onDepositModeChange, onDepositValueChange,
}: Props) {
  const [lastTrade, setLastTrade] = useState(trade);
  useEffect(() => {
    if (trade !== lastTrade) {
      setLastTrade(trade);
      onChange(makeDefaults(trade));
    }
  }, [trade]);

  const updateItem = (id: string, field: keyof LineItem, value: string | number) => {
    onChange(items.map(item => {
      if (item.id !== id) return item;
      // Clear aiSuggested flag when user edits
      return { ...item, [field]: value, aiSuggested: false };
    }));
  };

  const removeItem = (id: string) => onChange(items.filter(i => i.id !== id));
  const addItem = () => onChange([...items, { id: newId(), description: '', quantity: 1, unit: 'ea', unit_price: 0 }]);

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unit_price, 0), [items]);
  const taxAmount = taxEnabled ? subtotal * (taxRate / 100) : 0;
  const discountAmount = discountEnabled
    ? discountMode === 'percentage' ? subtotal * (discountValue / 100) : discountValue
    : 0;
  const grandTotal = subtotal + taxAmount - discountAmount;
  const depositAmount = depositEnabled
    ? depositMode === 'percentage' ? grandTotal * (depositValue / 100) : depositValue
    : 0;
  const balanceDue = grandTotal - depositAmount;

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-3">Quote</h2>

      {/* Desktop table */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium text-muted-foreground">Description</th>
              <th className="text-center p-3 font-medium text-muted-foreground w-20">Qty</th>
              <th className="text-center p-3 font-medium text-muted-foreground w-24">Unit</th>
              <th className="text-right p-3 font-medium text-muted-foreground w-28">Unit Price</th>
              <th className="text-right p-3 font-medium text-muted-foreground w-28">Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={cn('border-t', item.aiSuggested && 'bg-blue-50/60')}>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={item.description}
                      onChange={e => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Item description"
                      className="border-0 bg-transparent shadow-none focus-visible:ring-1 h-10"
                    />
                    {item.aiSuggested && (
                      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">AI</span>
                    )}
                  </div>
                </td>
                <td className="p-2">
                  <Input
                    type="number"
                    min={0}
                    value={item.quantity || ''}
                    onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                    className="border-0 bg-transparent shadow-none focus-visible:ring-1 text-center h-10"
                  />
                </td>
                <td className="p-2">
                  <UnitCombobox
                    value={item.unit}
                    onChange={v => updateItem(item.id, 'unit', v)}
                    className="border-0 bg-transparent shadow-none focus-visible:ring-1 text-center h-10"
                  />
                </td>
                <td className="p-2">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unit_price || ''}
                      onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="border-0 bg-transparent shadow-none focus-visible:ring-1 text-right h-10 pl-5"
                    />
                  </div>
                </td>
                <td className="p-2 text-right font-medium pr-3">{fmt(item.quantity * item.unit_price)}</td>
                <td className="p-2">
                  <button type="button" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map(item => (
          <div key={item.id} className={cn('border rounded-lg p-3 space-y-2 bg-background', item.aiSuggested && 'border-blue-200 bg-blue-50/40')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 mr-2">
                <Input
                  value={item.description}
                  onChange={e => updateItem(item.id, 'description', e.target.value)}
                  placeholder="Description"
                  className="h-11"
                />
                {item.aiSuggested && (
                  <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">AI</span>
                )}
              </div>
              <button type="button" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive p-2">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Qty</label>
                <Input
                  type="number"
                  min={0}
                  value={item.quantity || ''}
                  onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Unit</label>
                <UnitCombobox
                  value={item.unit}
                  onChange={v => updateItem(item.id, 'unit', v)}
                  className="h-11"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Price</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.unit_price || ''}
                    onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="h-11 pl-5"
                />
              </div>
            </div>
            <div className="text-right font-medium text-sm">{fmt(item.quantity * item.unit_price)}</div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-3 h-11">
        <Plus className="h-4 w-4 mr-1" /> Add Line Item
      </Button>

      {/* Totals */}
      <div className="mt-6 border rounded-lg p-4 space-y-3 max-w-sm ml-auto">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{fmt(subtotal)}</span>
        </div>

        {/* Tax toggle */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Switch checked={taxEnabled} onCheckedChange={onTaxToggle} />
            <span className="text-muted-foreground">Tax</span>
          </div>
          {taxEnabled && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={taxRate || ''}
                onChange={e => onTaxRateChange(parseFloat(e.target.value) || 0)}
                className="w-16 h-8 text-right text-sm"
              />
              <span className="text-muted-foreground">%</span>
              <span className="ml-2 font-medium">{fmt(taxAmount)}</span>
            </div>
          )}
        </div>

        {/* Discount toggle */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Switch checked={discountEnabled} onCheckedChange={onDiscountToggle} />
            <span className="text-muted-foreground">Discount</span>
          </div>
          {discountEnabled && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={discountValue || ''}
                onChange={e => onDiscountValueChange(parseFloat(e.target.value) || 0)}
                className="w-16 h-8 text-right text-sm"
              />
              <button
                type="button"
                onClick={() => onDiscountModeChange(discountMode === 'flat' ? 'percentage' : 'flat')}
                className="text-xs px-2 py-1 rounded border hover:bg-accent"
              >
                {discountMode === 'flat' ? '$' : '%'}
              </button>
              <span className="ml-1 font-medium text-destructive">-{fmt(discountAmount)}</span>
            </div>
          )}
        </div>

        <div className="border-t pt-3 flex justify-between">
          <span className="font-semibold">Grand Total</span>
          <span className="font-bold text-lg">{fmt(grandTotal)}</span>
        </div>

        {/* Deposit toggle */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Switch checked={depositEnabled} onCheckedChange={onDepositToggle} />
            <span className="text-muted-foreground">Deposit</span>
          </div>
          {depositEnabled && (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={depositValue || ''}
                onChange={e => onDepositValueChange(parseFloat(e.target.value) || 0)}
                className="w-16 h-8 text-right text-sm"
              />
              <button
                type="button"
                onClick={() => onDepositModeChange(depositMode === 'flat' ? 'percentage' : 'flat')}
                className="text-xs px-2 py-1 rounded border hover:bg-accent"
              >
                {depositMode === 'flat' ? '$' : '%'}
              </button>
              <span className="ml-1 font-medium">{fmt(depositAmount)}</span>
            </div>
          )}
        </div>

        {depositEnabled && (
          <div className="space-y-1 text-sm border-t pt-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit Due Upon Signing</span>
              <span className="font-medium">{fmt(depositAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Balance Due Upon Completion</span>
              <span className="font-medium">{fmt(balanceDue)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { makeDefaults };
