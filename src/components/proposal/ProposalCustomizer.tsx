import { Check } from 'lucide-react';

export type FontStyle = 'modern' | 'classic' | 'bold';
export type HeaderStyle = 'dark' | 'light' | 'minimal';

const COLOR_PRESETS = [
  { label: 'Deep Red', value: '#c0392b' },
  { label: 'Navy', value: '#1a2332' },
  { label: 'Forest Green', value: '#2d4a1e' },
  { label: 'Charcoal', value: '#2c2c2c' },
  { label: 'Electric Yellow', value: '#f5c800' },
  { label: 'Sky Blue', value: '#5bc4f5' },
  { label: 'Slate', value: '#4a5568' },
  { label: 'Black', value: '#111111' },
];

const FONT_OPTIONS: { id: FontStyle; label: string; desc: string }[] = [
  { id: 'modern', label: 'Modern', desc: 'Clean sans-serif' },
  { id: 'classic', label: 'Classic', desc: 'Traditional serif' },
  { id: 'bold', label: 'Bold', desc: 'Heavy condensed' },
];

const HEADER_OPTIONS: { id: HeaderStyle; label: string; desc: string }[] = [
  { id: 'dark', label: 'Dark', desc: 'Dark bg, light text' },
  { id: 'light', label: 'Light', desc: 'White bg, accent border' },
  { id: 'minimal', label: 'Minimal', desc: 'No colored header' },
];

interface Props {
  accentColor: string;
  fontStyle: FontStyle;
  headerStyle: HeaderStyle;
  onAccentChange: (color: string) => void;
  onFontChange: (font: FontStyle) => void;
  onHeaderChange: (header: HeaderStyle) => void;
}

export default function ProposalCustomizer({ accentColor, fontStyle, headerStyle, onAccentChange, onFontChange, onHeaderChange }: Props) {
  return (
    <div className="border rounded-lg p-4 space-y-5">
      <h3 className="text-sm font-medium">Customize Style</h3>

      {/* Color swatches */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Accent Color</p>
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              title={c.label}
              className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform hover:scale-110"
              style={{
                backgroundColor: c.value,
                borderColor: accentColor === c.value ? '#fff' : 'transparent',
                boxShadow: accentColor === c.value ? `0 0 0 2px ${c.value}` : undefined,
              }}
              onClick={() => onAccentChange(c.value)}
            >
              {accentColor === c.value && <Check className="h-4 w-4 text-white drop-shadow" />}
            </button>
          ))}
        </div>
      </div>

      {/* Font style */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Font Style</p>
        <div className="grid grid-cols-3 gap-2">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              className={`rounded-md border px-2 py-2 text-center transition-colors ${
                fontStyle === f.id
                  ? 'border-foreground bg-secondary'
                  : 'border-border hover:bg-muted'
              }`}
              onClick={() => onFontChange(f.id)}
            >
              <span className="block text-xs font-medium">{f.label}</span>
              <span className="block text-[10px] text-muted-foreground">{f.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Header style */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Header Style</p>
        <div className="grid grid-cols-3 gap-2">
          {HEADER_OPTIONS.map((h) => {
            const selected = headerStyle === h.id;
            return (
              <button
                key={h.id}
                className={`rounded-md border overflow-hidden transition-colors ${
                  selected ? 'border-foreground ring-1 ring-foreground' : 'border-border hover:bg-muted'
                }`}
                onClick={() => onHeaderChange(h.id)}
              >
                {/* Mini thumbnail */}
                <div className="h-8 w-full" style={{
                  backgroundColor: h.id === 'dark' ? accentColor : h.id === 'light' ? '#fff' : '#fafafa',
                  borderTop: h.id === 'light' ? `3px solid ${accentColor}` : undefined,
                }}>
                  <div className="flex items-center gap-1 px-2 pt-1.5">
                    <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: h.id === 'dark' ? '#fff' : '#333' }} />
                    <div className="w-6 h-1 rounded-sm" style={{ backgroundColor: h.id === 'dark' ? 'rgba(255,255,255,0.5)' : '#ccc' }} />
                  </div>
                </div>
                <div className="px-2 py-1.5">
                  <span className="text-[10px] font-medium">{h.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
