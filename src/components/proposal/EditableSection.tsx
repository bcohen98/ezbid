import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface Props {
  field: string;
  value: string;
  onSave: (field: string, value: string) => void;
  children: React.ReactNode;
}

export default function EditableSection({ field, value, onSave, children }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isHovered, setIsHovered] = useState(false);

  const handleSave = () => {
    onSave(field, draft);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="relative rounded-md border border-primary/30 bg-primary/5 p-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="text-sm"
          autoFocus
        />
        <div className="flex gap-1 mt-2 justify-end">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="h-3 w-3" /> Save
          </button>
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-md transition-colors cursor-pointer group ${
        isHovered ? 'bg-blue-50 dark:bg-blue-950/30' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsEditing(true)}
    >
      {children}
      {isHovered && (
        <button
          className="absolute top-1 right-1 p-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface EditableLineItemProps {
  item: { id: string; description: string; quantity: number; unit: string | null; unit_price: number; subtotal: number };
  onSave: (id: string, updates: { description: string; quantity: number; unit: string; unit_price: number; subtotal: number }) => void;
}

export function EditableLineItemRow({ item, onSave }: EditableLineItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [desc, setDesc] = useState(item.description);
  const [qty, setQty] = useState(item.quantity);
  const [unit, setUnit] = useState(item.unit || 'ea');
  const [price, setPrice] = useState(item.unit_price);

  const subtotal = qty * price;
  const fmt = (n: number) => n.toFixed(2);

  const handleSave = () => {
    onSave(item.id, { description: desc, quantity: qty, unit, unit_price: price, subtotal });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDesc(item.description);
    setQty(item.quantity);
    setUnit(item.unit || 'ea');
    setPrice(item.unit_price);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <tr className="border-b bg-blue-50/50 dark:bg-blue-950/20">
        <td className="py-2 px-1">
          <Input value={desc} onChange={e => setDesc(e.target.value)} className="h-7 text-sm" />
        </td>
        <td className="py-2 px-1">
          <Input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} className="h-7 text-sm text-right w-16" min={0} step="any" />
        </td>
        <td className="py-2 px-1">
          <Input value={unit} onChange={e => setUnit(e.target.value)} className="h-7 text-sm text-right w-16" />
        </td>
        <td className="py-2 px-1">
          <Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="h-7 text-sm text-right w-24" min={0} step="0.01" />
        </td>
        <td className="py-2 px-1 text-right text-sm font-medium">${fmt(subtotal)}</td>
        <td className="py-2 px-1 text-right whitespace-nowrap">
          <button onClick={handleSave} className="inline-flex items-center p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 mr-1">
            <Check className="h-3 w-3" />
          </button>
          <button onClick={handleCancel} className="inline-flex items-center p-1 rounded border hover:bg-muted">
            <X className="h-3 w-3" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className={`border-b transition-colors cursor-pointer ${isHovered ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsEditing(true)}
    >
      <td className="py-2 relative">
        {item.description}
        {isHovered && <Pencil className="inline-block ml-2 h-3 w-3 text-blue-500" />}
      </td>
      <td className="text-right py-2">{item.quantity}</td>
      <td className="text-right py-2">{item.unit}</td>
      <td className="text-right py-2">${fmt(item.unit_price)}</td>
      <td className="text-right py-2">${fmt(item.subtotal)}</td>
    </tr>
  );
}

// Editable totals section (tax rate, deposit)
interface EditableTotalsProps {
  subtotal: number;
  taxRate: number;
  depositMode: string;
  depositValue: number;
  onSave: (updates: { tax_rate: number; deposit_mode: string; deposit_value: number }) => void;
}

export function EditableTotals({ subtotal, taxRate, depositMode, depositValue, onSave }: EditableTotalsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [draftTaxRate, setDraftTaxRate] = useState(taxRate);
  const [draftDepositMode, setDraftDepositMode] = useState(depositMode);
  const [draftDepositValue, setDraftDepositValue] = useState(depositValue);

  const taxAmount = subtotal * draftTaxRate / 100;
  const total = subtotal + taxAmount;
  const depositAmount = draftDepositMode === 'percentage' ? total * draftDepositValue / 100 : draftDepositValue;
  const balanceDue = total - depositAmount;
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleSave = () => {
    onSave({ tax_rate: draftTaxRate, deposit_mode: draftDepositMode, deposit_value: draftDepositValue });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraftTaxRate(taxRate);
    setDraftDepositMode(depositMode);
    setDraftDepositValue(depositValue);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="border-t pt-2 mt-0 space-y-2 text-sm bg-blue-50/50 dark:bg-blue-950/20 rounded-b-md p-3">
        <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${fmt(subtotal)}</span></div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Tax rate (%)</span>
          <Input type="number" value={draftTaxRate} onChange={e => setDraftTaxRate(Number(e.target.value))} className="h-7 text-sm text-right w-20" min={0} step="0.1" />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>Tax amount</span><span>${fmt(taxAmount)}</span></div>
        <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Total</span><span>${fmt(total)}</span></div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Deposit</span>
          <div className="flex items-center gap-1">
            <select
              value={draftDepositMode}
              onChange={e => setDraftDepositMode(e.target.value)}
              className="h-7 text-xs border rounded px-1 bg-background"
            >
              <option value="percentage">%</option>
              <option value="flat">$</option>
            </select>
            <Input type="number" value={draftDepositValue} onChange={e => setDraftDepositValue(Number(e.target.value))} className="h-7 text-sm text-right w-20" min={0} step="0.01" />
          </div>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground"><span>Deposit amount</span><span>${fmt(depositAmount)}</span></div>
        <div className="flex justify-between font-medium"><span>Balance due</span><span>${fmt(balanceDue)}</span></div>
        <div className="flex gap-1 justify-end pt-1">
          <button onClick={handleSave} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
            <Check className="h-3 w-3" /> Save
          </button>
          <button onClick={handleCancel} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted">
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border-t pt-2 mt-0 space-y-1 text-sm relative rounded-b-md transition-colors cursor-pointer ${isHovered ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsEditing(true)}
    >
      {isHovered && (
        <button
          className="absolute top-1 right-1 p-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 shadow-sm z-10"
          onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>${fmt(subtotal)}</span></div>
      {taxRate > 0 && (
        <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span>${fmt(subtotal * taxRate / 100)}</span></div>
      )}
      <div className="flex justify-between font-semibold text-base border-t pt-1"><span>Total</span><span>${fmt(subtotal + subtotal * taxRate / 100)}</span></div>
      {depositAmount > 0 && (
        <>
          <div className="flex justify-between text-muted-foreground"><span>Deposit required</span><span>${fmt(depositAmount)}</span></div>
          <div className="flex justify-between font-medium"><span>Balance due</span><span>${fmt(balanceDue)}</span></div>
        </>
      )}
    </div>
  );
}
