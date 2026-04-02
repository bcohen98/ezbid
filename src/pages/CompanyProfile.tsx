import { useState, useEffect } from 'react';
import { useCompanyProfile } from '@/hooks/useCompanyProfile';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Sparkles, Loader2, CreditCard } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import PhoneInput from '@/components/PhoneInput';
import { supabase as supabaseClient } from '@/integrations/supabase/client';

const tradeTypes = [
  { value: 'general_contractor', label: 'General Contractor' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'painting', label: 'Painting' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'other', label: 'Other' },
] as const;

export default function CompanyProfile() {
  const { user } = useAuth();
  const { profile, isLoading, updateProfile, isUpdating } = useCompanyProfile();
  const { toast } = useToast();

  const [form, setForm] = useState({
    company_name: '',
    owner_name: '',
    trade_type: '' as string,
    license_numbers: [''],
    street_address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
    insurance_info: '',
    default_payment_terms: '',
    default_deposit_percentage: '',
    default_warranty: '',
    default_disclosures: '',
    brand_color: '#000000',
    stripe_enabled: false,
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refining, setRefining] = useState(false);

  const handleRefineWithAI = async () => {
    const textFields = {
      insurance_info: form.insurance_info,
      default_payment_terms: form.default_payment_terms,
      default_warranty: form.default_warranty,
      default_disclosures: form.default_disclosures,
    };
    const hasContent = Object.values(textFields).some(v => v.trim());
    if (!hasContent) {
      toast({ title: 'Nothing to refine', description: 'Fill in some text fields first.' });
      return;
    }
    setRefining(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke('refine-text', {
        body: { fields: textFields },
      });
      if (error) throw error;
      if (data?.refined) {
        const r = data.refined;
        setForm(prev => ({
          ...prev,
          insurance_info: r.insurance_info || prev.insurance_info,
          default_payment_terms: r.default_payment_terms || prev.default_payment_terms,
          default_warranty: r.default_warranty || prev.default_warranty,
          default_disclosures: r.default_disclosures || prev.default_disclosures,
        }));
        toast({ title: 'Text refined!', description: 'Review the changes and save when ready.' });
      }
    } catch (err: any) {
      toast({ title: 'Refinement failed', description: err.message, variant: 'destructive' });
    } finally {
      setRefining(false);
    }
  };

  useEffect(() => {
    if (profile) {
      setForm({
        company_name: profile.company_name || '',
        owner_name: profile.owner_name || '',
        trade_type: profile.trade_type || '',
        license_numbers: profile.license_numbers?.length ? profile.license_numbers : [''],
        street_address: profile.street_address || '',
        city: profile.city || '',
        state: profile.state || '',
        zip: profile.zip || '',
        phone: profile.phone || '',
        email: profile.email || '',
        website: profile.website || '',
        insurance_info: profile.insurance_info || '',
        default_payment_terms: profile.default_payment_terms || '',
        default_deposit_percentage: profile.default_deposit_percentage?.toString() || '',
        default_warranty: profile.default_warranty || '',
        default_disclosures: profile.default_disclosures || '',
        brand_color: profile.brand_color || '#000000',
        stripe_enabled: (profile as any).stripe_enabled ?? false,
      });
      setLogoUrl(profile.logo_url);
    }
  }, [profile]);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLicenseChange = (index: number, value: string) => {
    const updated = [...form.license_numbers];
    updated[index] = value;
    setForm((prev) => ({ ...prev, license_numbers: updated }));
  };

  const addLicense = () => setForm((prev) => ({ ...prev, license_numbers: [...prev.license_numbers, ''] }));
  const removeLicense = (index: number) => {
    if (form.license_numbers.length <= 1) return;
    setForm((prev) => ({ ...prev, license_numbers: prev.license_numbers.filter((_, i) => i !== index) }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path);
      setLogoUrl(publicUrl);
      await updateProfile({ logo_url: publicUrl });
      toast({ title: 'Logo uploaded' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const licenses = form.license_numbers.filter(Boolean);
      await updateProfile({
        company_name: form.company_name || null,
        owner_name: form.owner_name || null,
        trade_type: (form.trade_type as any) || null,
        license_numbers: licenses.length ? licenses : [],
        street_address: form.street_address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        phone: form.phone || null,
        email: form.email || null,
        website: form.website || null,
        insurance_info: form.insurance_info || null,
        default_payment_terms: form.default_payment_terms || null,
        default_deposit_percentage: form.default_deposit_percentage ? parseFloat(form.default_deposit_percentage) : null,
        default_warranty: form.default_warranty || null,
        default_disclosures: form.default_disclosures || null,
        brand_color: form.brand_color,
      });
      toast({ title: 'Profile saved' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return <AppLayout><div className="container py-8"><p className="text-sm text-muted-foreground">Loading...</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="container max-w-2xl py-8 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-semibold">My Company</h1>
          <p className="text-sm text-muted-foreground mt-1">This information appears on your proposals.</p>
        </div>

        {/* Logo */}
        <Card>
          <CardHeader><CardTitle className="text-base">Logo</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img src={logoUrl} alt="Company logo" className="h-16 w-16 object-contain rounded border" />
              ) : (
                <div className="h-16 w-16 rounded border border-dashed flex items-center justify-center">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>{uploading ? 'Uploading...' : 'Upload logo'}</span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input value={form.company_name} onChange={(e) => handleChange('company_name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Owner / contact name</Label>
                <Input value={form.owner_name} onChange={(e) => handleChange('owner_name', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Trade type</Label>
                <Select value={form.trade_type} onValueChange={(v) => handleChange('trade_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                  <SelectContent>
                    {tradeTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Brand color</Label>
                <div className="flex gap-2">
                  <input type="color" value={form.brand_color} onChange={(e) => handleChange('brand_color', e.target.value)} className="h-9 w-9 rounded border cursor-pointer" />
                  <Input value={form.brand_color} onChange={(e) => handleChange('brand_color', e.target.value)} className="flex-1" />
                </div>
              </div>
            </div>
            
            {/* License numbers */}
            <div className="space-y-2">
              <Label>License number(s)</Label>
              {form.license_numbers.map((lic, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={lic} onChange={(e) => handleLicenseChange(i, e.target.value)} placeholder="License #" />
                  {form.license_numbers.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeLicense(i)}><X className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addLicense}>Add license</Button>
            </div>
          </CardContent>
        </Card>

        {/* Address & contact */}
        <Card>
          <CardHeader><CardTitle className="text-base">Address & Contact</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Street address</Label>
              <Input value={form.street_address} onChange={(e) => handleChange('street_address', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>City</Label><Input value={form.city} onChange={(e) => handleChange('city', e.target.value)} /></div>
              <div className="space-y-2"><Label>State</Label><Input value={form.state} onChange={(e) => handleChange('state', e.target.value)} /></div>
              <div className="space-y-2"><Label>ZIP</Label><Input value={form.zip} onChange={(e) => handleChange('zip', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Phone</Label><PhoneInput value={form.phone} onChange={(v) => setForm(prev => ({ ...prev, phone: v }))} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => handleChange('email', e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Website (optional)</Label><Input value={form.website} onChange={(e) => handleChange('website', e.target.value)} placeholder="https://" /></div>
            <div className="space-y-2">
              <Label>Insurance / liability info</Label>
              <Textarea value={form.insurance_info} onChange={(e) => handleChange('insurance_info', e.target.value)} placeholder="e.g. Fully insured, $1M liability" rows={2} />
            </div>
          </CardContent>
        </Card>

        {/* Defaults */}
        <Card>
          <CardHeader><CardTitle className="text-base">Default Proposal Terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Default payment terms</Label>
                <Input value={form.default_payment_terms} onChange={(e) => handleChange('default_payment_terms', e.target.value)} placeholder="e.g. Net 15" />
              </div>
              <div className="space-y-2">
                <Label>Default deposit %</Label>
                <Input type="number" value={form.default_deposit_percentage} onChange={(e) => handleChange('default_deposit_percentage', e.target.value)} placeholder="e.g. 50" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Default warranty language</Label>
              <Textarea value={form.default_warranty} onChange={(e) => handleChange('default_warranty', e.target.value)} placeholder="e.g. All work warranted for 1 year" rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Default disclosures</Label>
              <Textarea value={form.default_disclosures} onChange={(e) => handleChange('default_disclosures', e.target.value)} placeholder="Legal boilerplate included on every proposal" rows={4} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleRefineWithAI} disabled={refining} className="gap-2">
            {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {refining ? 'Refining...' : 'Refine with AI'}
          </Button>
          <Button onClick={handleSave} disabled={isUpdating}>
            {isUpdating ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
