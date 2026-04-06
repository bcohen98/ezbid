import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Palette, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TemplateId = 'modern' | 'classic' | 'bold' | 'minimal';

interface TemplateSwitcherProps {
  current: TemplateId;
  accentColor: string;
  onSelect: (template: TemplateId) => void;
}

const TEMPLATES: { id: TemplateId; label: string; description: string }[] = [
  { id: 'modern', label: 'Modern', description: 'Clean layout, bold section headers, minimal color accents' },
  { id: 'classic', label: 'Classic', description: 'Traditional business document, formal and structured' },
  { id: 'bold', label: 'Bold', description: 'Full color header, strong typography, high contrast' },
  { id: 'minimal', label: 'Minimal', description: 'Ultra clean, generous white space, subtle accents' },
];

export default function TemplateSwitcher({ current, accentColor, onSelect }: TemplateSwitcherProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => setOpen(true)}
      >
        <Palette className="h-4 w-4" /> Try Another Template
      </Button>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Palette className="h-4 w-4" /> Choose Template
        </h3>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:underline">Close</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {TEMPLATES.map((t) => {
          const isActive = t.id === current;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={cn(
                'relative rounded-lg border-2 p-3 text-left transition-all hover:shadow-sm',
                isActive ? 'border-current shadow-sm' : 'border-border hover:border-muted-foreground/40'
              )}
              style={isActive ? { borderColor: accentColor } : undefined}
            >
              {/* Mini preview thumbnail */}
              <TemplateThumbnail template={t.id} accentColor={accentColor} />
              <div className="mt-2">
                <div className="text-xs font-semibold">{t.label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.description}</div>
              </div>
              {isActive && (
                <div className="absolute top-1.5 right-1.5 rounded-full p-0.5" style={{ backgroundColor: accentColor }}>
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TemplateThumbnail({ template, accentColor }: { template: TemplateId; accentColor: string }) {
  const bar = { backgroundColor: accentColor };
  const lightBar = { backgroundColor: accentColor, opacity: 0.15 };

  if (template === 'modern') {
    return (
      <div className="h-16 bg-white border rounded-sm p-1.5 flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-sm" style={bar} />
          <div className="flex-1 h-1.5 rounded-full bg-gray-200" />
        </div>
        <div className="h-1 rounded-full bg-gray-100 w-3/4" />
        <div className="flex-1 flex gap-0.5">
          <div className="flex-1 h-full rounded-sm" style={lightBar} />
        </div>
        <div className="h-2 rounded-sm" style={bar} />
      </div>
    );
  }

  if (template === 'classic') {
    return (
      <div className="h-16 bg-white border rounded-sm p-1.5 flex flex-col gap-1">
        <div className="h-0.5" style={bar} />
        <div className="flex justify-between">
          <div className="h-1 w-8 rounded-full bg-gray-300" />
          <div className="h-1 w-6 rounded-full bg-gray-200" />
        </div>
        <div className="h-px bg-gray-200 mt-0.5" />
        <div className="flex-1 flex flex-col gap-0.5">
          <div className="h-1 rounded-full bg-gray-100 w-full" />
          <div className="h-1 rounded-full bg-gray-100 w-2/3" />
        </div>
        <div className="h-0.5" style={bar} />
      </div>
    );
  }

  if (template === 'bold') {
    return (
      <div className="h-16 bg-white border rounded-sm flex flex-col">
        <div className="h-5 rounded-t-sm flex items-center px-1.5" style={bar}>
          <div className="h-1 w-6 rounded-full bg-white/60" />
        </div>
        <div className="flex-1 p-1.5 flex flex-col gap-0.5">
          <div className="h-1 rounded-full bg-gray-200 w-full" />
          <div className="h-1 rounded-full bg-gray-100 w-3/4" />
        </div>
        <div className="h-2 mx-1.5 mb-1 rounded-sm" style={bar} />
      </div>
    );
  }

  // minimal
  return (
    <div className="h-16 bg-white border rounded-sm p-2 flex flex-col justify-between">
      <div className="h-1 w-10 rounded-full bg-gray-200" />
      <div className="space-y-0.5">
        <div className="h-0.5 rounded-full bg-gray-100 w-full" />
        <div className="h-0.5 rounded-full bg-gray-100 w-2/3" />
      </div>
      <div className="flex justify-end">
        <div className="h-1.5 w-8 rounded-full" style={{ ...bar, opacity: 0.5 }} />
      </div>
    </div>
  );
}
