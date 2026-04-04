import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlus, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ProposalExhibit } from '@/hooks/useProposalExhibits';

interface Props {
  exhibits: ProposalExhibit[];
  isAdding: boolean;
  onAdd: (params: { file: File; caption?: string }) => Promise<any>;
  onUpdateCaption: (params: { id: string; caption: string }) => Promise<any>;
  onRemove: (id: string) => Promise<any>;
}

export default function ExhibitsUpload({ exhibits, isAdding, onAdd, onUpdateCaption, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        toast({ title: 'Invalid file type', description: 'Please upload images or PDFs only.', variant: 'destructive' });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Max file size is 10MB.', variant: 'destructive' });
        continue;
      }
      try {
        await onAdd({ file });
      } catch (err: any) {
        toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await onRemove(id);
      toast({ title: 'Exhibit removed' });
    } catch (err: any) {
      toast({ title: 'Remove failed', description: err.message, variant: 'destructive' });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <ImagePlus className="h-4 w-4" /> Exhibits & Attachments
      </h3>
      <p className="text-xs text-muted-foreground">
        Upload photos, diagrams, or documents to appear as a second page.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={() => fileInputRef.current?.click()}
        disabled={isAdding}
      >
        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        {isAdding ? 'Uploading...' : 'Add exhibit'}
      </Button>

      {exhibits.length > 0 && (
        <div className="space-y-2">
          {exhibits.map((exhibit) => (
            <div key={exhibit.id} className="flex items-start gap-2 border rounded p-2">
              <img
                src={exhibit.file_url}
                alt={exhibit.caption || 'Exhibit'}
                className="h-16 w-16 object-cover rounded flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <Input
                  placeholder="Add caption..."
                  defaultValue={exhibit.caption || ''}
                  className="h-7 text-xs"
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== (exhibit.caption || '')) {
                      onUpdateCaption({ id: exhibit.id, caption: val });
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => handleRemove(exhibit.id)}
                disabled={removingId === exhibit.id}
              >
                {removingId === exhibit.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
