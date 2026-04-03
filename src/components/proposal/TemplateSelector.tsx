import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ProposalTemplate } from '@/pages/NewProposal';

interface Props {
  selected: ProposalTemplate;
  brandColor: string;
  onSelect: (template: ProposalTemplate) => void;
}

const templates: { id: ProposalTemplate; name: string; description: string }[] = [
  { id: 'classic', name: 'Classic', description: 'Clean black header with logo, traditional layout' },
  { id: 'modern', name: 'Modern', description: 'Colored accent bar with bold section headers' },
  { id: 'minimal', name: 'Minimal', description: 'No color, all typography, ultra-clean' },
  { id: 'bold', name: 'Bold', description: 'Strong left border accent, large headings, high contrast' },
  { id: 'executive', name: 'Executive', description: 'Formal double-line border, elegant & professional' },
  { id: 'contractor', name: 'Contractor', description: 'Work-order style with numbered sections, job-site ready' },
  { id: 'premium', name: 'Premium', description: 'Luxury feel with gold accents for high-end residential' },
  { id: 'clean', name: 'Clean', description: 'Simple two-column header, modern business layout' },
];

export default function TemplateSelector({ selected, brandColor, onSelect }: Props) {
  const [vibeInput, setVibeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<{
    recommended: ProposalTemplate;
    reason: string;
    ranked: ProposalTemplate[];
  } | null>(null);
  const { toast } = useToast();

  const handleRecommend = async () => {
    if (!vibeInput.trim()) return;
    setLoading(true);
    setRecommendation(null);

    try {
      const { data, error } = await supabase.functions.invoke('recommend-template', {
        body: { description: vibeInput.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRecommendation(data);
      onSelect(data.recommended);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Could not get recommendation', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // If we have a recommendation, reorder templates to match ranking
  const displayTemplates = recommendation
    ? recommendation.ranked.map((id) => templates.find((t) => t.id === id)!).filter(Boolean)
    : templates;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-2">Choose a template</h1>
      <p className="text-sm text-muted-foreground mb-6">Select a style for your proposal. You can always change it later.</p>

      {/* AI Vibe Input */}
      <div className="mb-8 rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Not sure? Describe the vibe you want</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder='e.g. "clean and professional for a high-end kitchen remodel"'
            value={vibeInput}
            onChange={(e) => setVibeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleRecommend();
              }
            }}
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleRecommend} disabled={loading || !vibeInput.trim()} size="sm" className="gap-2 shrink-0">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Thinking...' : 'Recommend'}
          </Button>
        </div>

        {recommendation && (
          <div className="mt-3 rounded-md bg-background border p-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="text-xs">Best match</Badge>
              <span className="text-sm font-semibold capitalize">{recommendation.recommended}</span>
            </div>
            <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayTemplates.map((t, i) => (
          <Card
            key={t.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selected === t.id ? 'ring-2 ring-foreground' : ''
            }`}
            onClick={() => onSelect(t.id)}
          >
            <CardContent className="p-0">
              <div className="aspect-[3/4] border-b relative overflow-hidden bg-background">
                {recommendation && i === 0 && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge className="text-[10px] gap-1">
                      <Sparkles className="h-3 w-3" />
                      Top pick
                    </Badge>
                  </div>
                )}
                <TemplateThumbnail template={t.id} brandColor={brandColor} />
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium">{t.name}</h3>
                  {recommendation && i < 3 && i > 0 && (
                    <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                  )}
                </div>
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
