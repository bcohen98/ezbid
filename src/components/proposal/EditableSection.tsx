import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  field: string;
  value: string;
  onSave: (field: string, value: string) => void;
  children: React.ReactNode;
}

export default function EditableSection({ field, value, onSave, children }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [isHovered, setIsHovered] = useState(false);

  const handleSave = () => {
    onSave(field, draft);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="relative rounded-md border border-primary/30 bg-primary/5 p-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="text-sm"
          autoFocus
        />
        <div className="flex gap-1 mt-2 justify-end">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="h-3 w-3" /> Save
          </button>
          <button
            onClick={handleCancel}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border hover:bg-muted"
          >
            <X className="h-3 w-3" /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-md transition-colors cursor-pointer group ${
        isHovered ? 'bg-blue-50 dark:bg-blue-950/30' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setIsEditing(true)}
    >
      {children}
      {isHovered && (
        <button
          className="absolute top-1 right-1 p-1 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
