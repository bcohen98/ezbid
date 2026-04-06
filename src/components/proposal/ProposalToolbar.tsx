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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg md:w-auto md:max-w-none flex items-center gap-2 bg-foreground text-background px-4 py-2.5 rounded-full shadow-lg border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Back</span>
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
        <Save className="h-4 w-4" /> <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5"
        onClick={onPreview}
      >
        <Eye className="h-4 w-4" /> <span className="hidden sm:inline">Preview</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-background hover:text-background/80 hover:bg-background/10 gap-1.5"
        onClick={onDuplicate}
      >
        <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Duplicate</span>
      </Button>
    </div>
  );
}
