import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const UNIT_OPTIONS = [
  'Each', 'Hour', 'Day', 'Sq Ft', 'Linear Ft',
  'Bundle', 'Bag', 'Gallon', 'Ton', 'Load', 'Job',
];

interface UnitComboboxProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function UnitCombobox({ value, onChange, className }: UnitComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setSearch(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = UNIT_OPTIONS.filter(u =>
    u.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={ref} className="relative">
      <Input
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={className}
        placeholder="Unit"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-auto">
          {filtered.map(u => (
            <button
              key={u}
              type="button"
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm hover:bg-accent cursor-pointer',
                u.toLowerCase() === value.toLowerCase() && 'bg-accent font-medium'
              )}
              onMouseDown={e => {
                e.preventDefault();
                onChange(u);
                setSearch(u);
                setOpen(false);
              }}
            >
              {u}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
