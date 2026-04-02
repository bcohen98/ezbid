import { Card, CardContent } from '@/components/ui/card';
import type { ProposalTemplate } from '@/pages/NewProposal';

interface Props {
  selected: ProposalTemplate;
  brandColor: string;
  onSelect: (template: ProposalTemplate) => void;
}

export default function TemplateSelector({ selected, brandColor, onSelect }: Props) {
  const templates: { id: ProposalTemplate; name: string; description: string }[] = [
    { id: 'classic', name: 'Classic', description: 'Clean black header with logo, traditional layout' },
    { id: 'modern', name: 'Modern', description: 'Colored accent bar with bold section headers' },
    { id: 'minimal', name: 'Minimal', description: 'No color, all typography, ultra-clean' },
    { id: 'bold', name: 'Bold', description: 'Strong left border accent, large headings, high contrast' },
    { id: 'executive', name: 'Executive', description: 'Formal double-line border, elegant & professional' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Choose a template</h1>
      <p className="text-sm text-muted-foreground mb-8">Select a style for your proposal. You can always change it later.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((t) => (
          <Card
            key={t.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selected === t.id ? 'ring-2 ring-foreground' : ''
            }`}
            onClick={() => onSelect(t.id)}
          >
            <CardContent className="p-0">
              {/* Thumbnail preview */}
              <div className="aspect-[3/4] border-b relative overflow-hidden bg-background">
                <TemplateThumbnail template={t.id} brandColor={brandColor} />
              </div>
              <div className="p-5">
                <h3 className="text-base font-medium">{t.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TemplateThumbnail({ template, brandColor }: { template: ProposalTemplate; brandColor: string }) {
  if (template === 'classic') {
    return (
      <div className="p-4 h-full flex flex-col text-[6px]">
        <div className="bg-foreground text-primary-foreground p-2 rounded-sm mb-2">
          <div className="font-bold text-[8px]">COMPANY NAME</div>
          <div className="opacity-60">123 Main St · (555) 123-4567</div>
        </div>
        <div className="font-bold text-[8px] mb-1">PROPOSAL</div>
        <div className="text-muted-foreground mb-2">Client Name · PRO-0001</div>
        <div className="flex-1 space-y-1">
          <div className="h-1 bg-muted rounded w-full"></div>
          <div className="h-1 bg-muted rounded w-3/4"></div>
          <div className="h-1 bg-muted rounded w-5/6"></div>
        </div>
        <div className="border-t mt-2 pt-1">
          <div className="font-bold text-right">Total: $0.00</div>
        </div>
      </div>
    );
  }

  if (template === 'modern') {
    return (
      <div className="h-full flex flex-col text-[6px]">
        <div className="h-2" style={{ backgroundColor: brandColor }}></div>
        <div className="p-4 flex-1 flex flex-col">
          <div className="font-bold text-[8px] mb-0.5" style={{ color: brandColor }}>COMPANY NAME</div>
          <div className="text-muted-foreground mb-3">123 Main St · (555) 123-4567</div>
          <div className="font-bold text-[7px] mb-1 uppercase" style={{ color: brandColor }}>Scope of Work</div>
          <div className="flex-1 space-y-1">
            <div className="h-1 bg-muted rounded w-full"></div>
            <div className="h-1 bg-muted rounded w-2/3"></div>
          </div>
          <div className="border-t mt-2 pt-1">
            <div className="font-bold text-right">Total: $0.00</div>
          </div>
        </div>
      </div>
    );
  }

  if (template === 'bold') {
    return (
      <div className="h-full flex flex-col text-[6px]">
        <div className="p-4 flex-1 flex flex-col">
          <div className="border-l-[3px] pl-2 mb-3" style={{ borderColor: brandColor }}>
            <div className="font-bold text-[9px] uppercase tracking-wide">COMPANY NAME</div>
            <div className="text-muted-foreground">123 Main St</div>
          </div>
          <div className="text-[10px] font-black uppercase tracking-tighter mb-2" style={{ color: brandColor }}>Proposal</div>
          <div className="font-bold text-[7px] uppercase border-b pb-0.5 mb-1" style={{ borderColor: brandColor, color: brandColor }}>Scope of Work</div>
          <div className="flex-1 space-y-1">
            <div className="h-1 bg-muted rounded w-full"></div>
            <div className="h-1 bg-muted rounded w-3/4"></div>
          </div>
          <div className="border-t mt-2 pt-1">
            <div className="font-bold text-right">Total: $0.00</div>
          </div>
        </div>
      </div>
    );
  }

  if (template === 'executive') {
    return (
      <div className="p-4 h-full flex flex-col text-[6px]">
        <div className="flex justify-between items-start border-b-2 pb-2 mb-3" style={{ borderColor: brandColor }}>
          <div>
            <div className="font-semibold text-[8px]">Company Name</div>
            <div className="text-muted-foreground">123 Main St</div>
          </div>
          <div className="text-right">
            <div className="text-[5px] uppercase tracking-widest text-muted-foreground">Professional Proposal</div>
            <div className="text-muted-foreground">PRO-0001</div>
          </div>
        </div>
        <div className="text-[7px] font-semibold border-b pb-0.5 mb-1">Scope of Work</div>
        <div className="flex-1 space-y-1">
          <div className="h-1 bg-muted rounded w-full"></div>
          <div className="h-1 bg-muted rounded w-4/5"></div>
          <div className="h-1 bg-muted rounded w-2/3"></div>
        </div>
        <div className="border-t mt-2 pt-1">
          <div className="font-medium text-right text-[7px]">Total: $0.00</div>
        </div>
      </div>
    );
  }

  // Minimal
  return (
    <div className="p-4 h-full flex flex-col text-[6px]">
      <div className="font-bold text-[9px] tracking-tight mb-0.5">Company Name</div>
      <div className="text-muted-foreground mb-4">Proposal · PRO-0001</div>
      <div className="text-[7px] font-medium mb-1">Scope of Work</div>
      <div className="flex-1 space-y-1">
        <div className="h-1 bg-muted rounded w-full"></div>
        <div className="h-1 bg-muted rounded w-4/5"></div>
        <div className="h-1 bg-muted rounded w-2/3"></div>
      </div>
      <div className="border-t mt-2 pt-1">
        <div className="font-medium text-right text-[7px]">Total: $0.00</div>
      </div>
    </div>
  );
}
