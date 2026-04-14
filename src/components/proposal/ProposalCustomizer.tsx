import { Check } from 'lucide-react';

export type FontStyle = 'modern' | 'classic' | 'bold';
export type HeaderStyle = 'dark' | 'light' | 'minimal';

export type PaletteId = 'iron' | 'grove' | 'blueprint' | 'studio' | 'forge' | 'current';

const PALETTE_PRESETS: { id: PaletteId; label: string; primary: string; accent: string }[] = [
  { id: 'iron',      label: 'Iron',      primary: '#1a1a1a', accent: '#c0392b' },
  { id: 'grove',     label: 'Grove',     primary: '#2d4a1e', accent: '#c8e6a0' },
  { id: 'blueprint', label: 'Blueprint', primary: '#1a2332', accent: '#38bdf8' },
  { id: 'studio',    label: 'Studio',    primary: '#2c2c2c', accent: '#e8c547' },
  { id: 'forge',     label: 'Forge',     primary: '#111111', accent: '#f5c800' },
  { id: 'current',   label: 'Current',   primary: '#1e3a5f', accent: '#5bc4f5' },
];

export const TRADE_PALETTE_MAP: Record<string, PaletteId> = {
  roofing: 'iron', landscaping: 'grove', hvac: 'blueprint',
  painting: 'studio', electrical: 'forge', plumbing: 'current',
};

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
  onPaletteChange?: (palette: PaletteId) => void;
  activePalette?: PaletteId | null;
}

export default function ProposalCustomizer({ accentColor, fontStyle, headerStyle, onAccentChange, onFontChange, onHeaderChange, onPaletteChange, activePalette }: Props) {
  return (
    <div className="border rounded-lg p-4 space-y-5">
      <h3 className="text-sm font-medium">Customize Style</h3>

      {/* Palette swatches */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Color Palette</p>
        <div className="grid grid-cols-3 gap-2">
          {PALETTE_PRESETS.map((p) => {
            const isActive = activePalette === p.id || (!activePalette && accentColor === p.accent);
            return (
              <button
                key={p.id}
                title={p.label}
                className={`rounded-md border px-2 py-2 text-center transition-colors ${
                  isActive
                    ? 'border-foreground bg-secondary'
                    : 'border-border hover:bg-muted'
                }`}
                onClick={() => {
                  onAccentChange(p.accent);
                  onPaletteChange?.(p.id);
                }}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: p.primary }} />
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: p.accent }} />
                </div>
                <span className="block text-[10px] font-medium">{p.label}</span>
              </button>
            );
          })}
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
