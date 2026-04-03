import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/PhoneInput';

interface ClientData {
  client_name: string;
  client_email: string;
  client_phone: string;
  job_site_street: string;
  job_site_city: string;
  job_site_state: string;
  job_site_zip: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: ClientData;
  onSave: (data: ClientData) => Promise<void>;
}

export default function EditClientDialog({ open, onOpenChange, initialData, onSave }: Props) {
  const [form, setForm] = useState<ClientData>(initialData);
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (field: keyof ClientData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Client Info</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.client_name} onChange={e => handleChange('client_name', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={form.client_email} onChange={e => handleChange('client_email', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <PhoneInput value={form.client_phone} onChange={v => handleChange('client_phone', v)} />
          </div>
          <div className="space-y-1.5">
            <Label>Street Address</Label>
            <Input value={form.job_site_street} onChange={e => handleChange('job_site_street', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input value={form.job_site_city} onChange={e => handleChange('job_site_city', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>State</Label>
              <Input value={form.job_site_state} onChange={e => handleChange('job_site_state', e.target.value)} maxLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Zip</Label>
              <Input value={form.job_site_zip} onChange={e => handleChange('job_site_zip', e.target.value)} maxLength={10} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
