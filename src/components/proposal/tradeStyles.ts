export interface TradeStyle {
  label: string;
  headerBg: string;
  headerText: string;
  accentColor: string;
  iconSvg: string; // inline SVG path for PDF
}

const TRADE_STYLES: Record<string, TradeStyle> = {
  roofing: {
    label: 'Roofing',
    headerBg: '#2D3436',
    headerText: '#FFFFFF',
    accentColor: '#2D3436',
    iconSvg: '<path d="M3 21l9-9 9 9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 21V12h6v9" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  landscaping: {
    label: 'Landscaping',
    headerBg: '#1B4332',
    headerText: '#FFFFFF',
    accentColor: '#1B4332',
    iconSvg: '<path d="M12 3c-1.5 3-4 6-4 9a4 4 0 008 0c0-3-2.5-6-4-9z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 21v-3" stroke="currentColor" stroke-width="2"/>',
  },
  hvac: {
    label: 'HVAC',
    headerBg: '#2C5F7C',
    headerText: '#FFFFFF',
    accentColor: '#2C5F7C',
    iconSvg: '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  },
  plumbing: {
    label: 'Plumbing',
    headerBg: '#1B2A4A',
    headerText: '#FFFFFF',
    accentColor: '#1B2A4A',
    iconSvg: '<path d="M12 2c-2 4-6 6-6 10a6 6 0 0012 0c0-4-4-6-6-10z" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  electrical: {
    label: 'Electrical',
    headerBg: '#92400E',
    headerText: '#FFFFFF',
    accentColor: '#92400E',
    iconSvg: '<path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  painting: {
    label: 'Painting',
    headerBg: '#57534E',
    headerText: '#FFFFFF',
    accentColor: '#57534E',
    iconSvg: '<path d="M18.37 2.63a1 1 0 00-1.41 0L9 10.59V14h3.41l7.96-7.96a1 1 0 000-1.41l-2-2z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M2 22h4l1-4H3l-1 4z" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  general_contractor: {
    label: 'General Contracting',
    headerBg: '#3E2723',
    headerText: '#FFFFFF',
    accentColor: '#3E2723',
    iconSvg: '<path d="M15 12l-8.5 8.5a2.12 2.12 0 01-3-3L12 9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M17.64 2.36a2.12 2.12 0 013 3L14 12l-3-3 6.64-6.64z" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  pressure_washing: {
    label: 'Pressure Washing',
    headerBg: '#475569',
    headerText: '#FFFFFF',
    accentColor: '#475569',
    iconSvg: '<path d="M12 2c-2 4-6 7-6 11a6 6 0 0012 0c0-4-4-7-6-11z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 14h8" stroke="currentColor" stroke-width="2"/>',
  },
  foundation: {
    label: 'Foundation',
    headerBg: '#6B7280',
    headerText: '#FFFFFF',
    accentColor: '#6B7280',
    iconSvg: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>',
  },
  flooring: {
    label: 'Flooring',
    headerBg: '#78350F',
    headerText: '#FFFFFF',
    accentColor: '#78350F',
    iconSvg: '<rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  cabinetry: {
    label: 'Cabinetry',
    headerBg: '#5D4037',
    headerText: '#FFFFFF',
    accentColor: '#5D4037',
    iconSvg: '<rect x="4" y="3" width="16" height="18" rx="1" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 12h16" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="7.5" r="1" fill="currentColor"/><circle cx="9" cy="16.5" r="1" fill="currentColor"/>',
  },
  carpentry: {
    label: 'Carpentry',
    headerBg: '#4E342E',
    headerText: '#FFFFFF',
    accentColor: '#4E342E',
    iconSvg: '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.8-3.8a3 3 0 00-4.2-4.2L14.7 3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M15.7 7.3L3 20l4 0 0-4L20.3 2.7" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  masonry: {
    label: 'Masonry',
    headerBg: '#795548',
    headerText: '#FFFFFF',
    accentColor: '#795548',
    iconSvg: '<rect x="2" y="4" width="9" height="5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="13" y="4" width="9" height="5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="6" y="11" width="9" height="5" stroke="currentColor" stroke-width="2" fill="none"/><rect x="2" y="18" width="9" height="5" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  asphalt: {
    label: 'Asphalt',
    headerBg: '#1F2937',
    headerText: '#FFFFFF',
    accentColor: '#1F2937',
    iconSvg: '<path d="M4 20h16M4 20l2-8h12l2 8M8 12l1-4h6l1 4" stroke="currentColor" stroke-width="2" fill="none"/>',
  },
  concrete: {
    label: 'Concrete',
    headerBg: '#4B5563',
    headerText: '#FFFFFF',
    accentColor: '#4B5563',
    iconSvg: '<rect x="3" y="8" width="18" height="12" rx="1" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 14h18M8 8v12M16 8v12" stroke="currentColor" stroke-width="1.5" opacity="0.5"/>',
  },
  other: {
    label: 'Other',
    headerBg: '#374151',
    headerText: '#FFFFFF',
    accentColor: '#374151',
    iconSvg: '',
  },
};

export function getTradeStyle(trade: string | null | undefined): TradeStyle {
  if (!trade) return TRADE_STYLES.other;
  return TRADE_STYLES[trade] || TRADE_STYLES.other;
}

export default TRADE_STYLES;
