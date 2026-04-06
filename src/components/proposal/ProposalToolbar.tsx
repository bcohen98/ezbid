import { Button } from '@/components/ui/button';
import { Save, Eye, Copy, ArrowLeft } from 'lucide-react';

interface Props {
  proposalId?: string;
  onSave: () => void;
  onPreview: () => void;
  onDuplicate: () => void;
  onBack: () => void;
  isSaving?: boolean;
}

export default function ProposalToolbar({ onSave, onPreview, onDuplicate, onBack, isSaving }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-foreground text-background px-4 py-2 rounded-full shadow-lg border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
      <div className="w-px h-5 bg-background/20" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5"
        onClick={onSave}
        disabled={isSaving}
      >
        <Save className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5"
        onClick={onPreview}
      >
        <Eye className="h-4 w-4" /> Preview
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5"
        onClick={onDuplicate}
      >
        <Copy className="h-4 w-4" /> Duplicate
      </Button>
    </div>
  );
}
