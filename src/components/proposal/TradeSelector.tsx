import { cn } from '@/lib/utils';
import {
  Home, Droplets, Wind, TreePine, Zap, Paintbrush,
  Hammer, Waves, Building, Layers, MoreHorizontal, LucideIcon,
  DoorOpen, Wrench, Landmark, Construction, HardHat
} from 'lucide-react';

export type TradeType =
  | 'roofing' | 'plumbing' | 'hvac' | 'landscaping' | 'electrical'
  | 'painting' | 'general_contractor' | 'pressure_washing'
  | 'foundation' | 'flooring' | 'cabinetry' | 'carpentry' | 'masonry'
  | 'asphalt' | 'concrete' | 'other';

interface TradeOption {
  value: TradeType;
  label: string;
  icon: LucideIcon;
}

const trades: TradeOption[] = [
  { value: 'roofing', label: 'Roofing', icon: Home },
  { value: 'plumbing', label: 'Plumbing', icon: Droplets },
  { value: 'hvac', label: 'HVAC', icon: Wind },
  { value: 'landscaping', label: 'Landscaping', icon: TreePine },
  { value: 'electrical', label: 'Electrical', icon: Zap },
  { value: 'painting', label: 'Painting', icon: Paintbrush },
  { value: 'general_contractor', label: 'General Contracting', icon: Hammer },
  { value: 'pressure_washing', label: 'Pressure Washing', icon: Waves },
  { value: 'foundation', label: 'Foundation', icon: Building },
  { value: 'flooring', label: 'Flooring', icon: Layers },
  { value: 'cabinetry', label: 'Cabinetry', icon: DoorOpen },
  { value: 'carpentry', label: 'Carpentry', icon: Wrench },
  { value: 'masonry', label: 'Masonry', icon: Landmark },
  { value: 'asphalt', label: 'Asphalt', icon: Construction },
  { value: 'concrete', label: 'Concrete', icon: HardHat },
  { value: 'other', label: 'Other', icon: MoreHorizontal },
];

interface Props {
  selected: TradeType;
  onSelect: (trade: TradeType) => void;
}

export default function TradeSelector({ selected, onSelect }: Props) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground mb-3">What type of work?</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {trades.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all text-center min-h-[80px] justify-center',
              'hover:border-foreground/40 hover:bg-accent',
              selected === value
                ? 'border-foreground bg-accent shadow-sm'
                : 'border-border bg-background'
            )}
          >
            <Icon className={cn('h-6 w-6', selected === value ? 'text-foreground' : 'text-muted-foreground')} />
            <span className={cn('text-xs font-medium leading-tight', selected === value ? 'text-foreground' : 'text-muted-foreground')}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
