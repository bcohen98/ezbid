import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import PhoneInput from '@/components/PhoneInput';
import ProposalToolbar from '@/components/proposal/ProposalToolbar';
import type { ProposalFormData, ProposalTemplate, LineItemData } from '@/pages/NewProposal';
import type { Database } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/formatCurrency';

type CompanyProfile = Database['public']['Tables']['company_profiles']['Row'];

interface Props {
  template: ProposalTemplate;
  profile: CompanyProfile | null | undefined;
  onSubmit: (data: ProposalFormData) => void;
  isSubmitting: boolean;
  onBack: () => void;
}

const paymentMethods = ['Cash', 'Check', 'Zelle', 'Venmo', 'Credit Card', 'Bank Transfer'];

const today = new Date().toISOString().split('T')[0];
const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export default function ProposalForm({ template, profile, onSubmit, isSubmitting, onBack }: Props) {
  const [form, setForm] = useState<ProposalFormData>({
    template,
    client_name: '',
    client_email: '',
    client_phone: '',
    job_site_street: '',
    job_site_city: '',
    job_site_state: '',
    job_site_zip: '',
    title: '',
    job_description: '',
    scope_of_work: '',
    materials_included: '',
    materials_excluded: '',
    estimated_start_date: '',
    estimated_duration: '',
    line_items: [{ description: '', quantity: 1, unit: 'ea', unit_price: 0 }],
    tax_rate: 0,
    deposit_mode: 'percentage',
    deposit_value: profile?.default_deposit_percentage ?? 0,
    payment_terms: profile?.default_payment_terms ?? '',
    accepted_payment_methods: [],
    warranty_terms: profile?.default_warranty ?? '',
    disclosures: profile?.default_disclosures ?? '',
    special_conditions: '',
    proposal_date: today,
    valid_until: thirtyDays,
    delivery_method: 'email_self',
  });

  const handleChange = (field: keyof ProposalFormData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLineItem = (index: number, field: keyof LineItemData, value: any) => {
    const items = [...form.line_items];
    items[index] = { ...items[index], [field]: value };
    handleChange('line_items', items);
  };

  const addLineItem = () => {
    handleChange('line_items', [...form.line_items, { description: '', quantity: 1, unit: 'ea', unit_price: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (form.line_items.length <= 1) return;
    handleChange('line_items', form.line_items.filter((_, i) => i !== index));
  };

  const togglePaymentMethod = (method: string) => {
    const methods = form.accepted_payment_methods.includes(method)
      ? form.accepted_payment_methods.filter((m) => m !== method)
      : [...form.accepted_payment_methods, method];
    handleChange('accepted_payment_methods', methods);
  };

  const subtotal = useMemo(() => form.line_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0), [form.line_items]);
  const taxAmount = subtotal * (form.tax_rate / 100);
  const total = subtotal + taxAmount;
  const depositAmount = form.deposit_mode === 'percentage' ? total * (form.deposit_value / 100) : form.deposit_value;
  const balanceDue = total - depositAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-semibold">New Proposal</h1>
      </div>

      <ProposalToolbar
        onBack={onBack}
        onSave={() => onSubmit(form)}
        onPreview={() => onSubmit(form)}
        onDuplicate={() => {}}
        isSaving={isSubmitting}
      />

      {/* Client Info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Client Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Client name *</Label>
              <Input value={form.client_name} onChange={(e) => handleChange('client_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Client email *</Label>
              <Input type="email" value={form.client_email} onChange={(e) => handleChange('client_email', e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Client phone</Label>
            <PhoneInput value={form.client_phone} onChange={(v) => handleChange('client_phone', v)} />
          </div>
          <div className="space-y-2"><Label>Job site address</Label></div>
          <Input placeholder="Street" value={form.job_site_street} onChange={(e) => handleChange('job_site_street', e.target.value)} />
          <div className="grid grid-cols-3 gap-4">
            <Input placeholder="City" value={form.job_site_city} onChange={(e) => handleChange('job_site_city', e.target.value)} />
            <Input placeholder="State" value={form.job_site_state} onChange={(e) => handleChange('job_site_state', e.target.value)} />
            <Input placeholder="ZIP" value={form.job_site_zip} onChange={(e) => handleChange('job_site_zip', e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Job Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Job Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Proposal title *</Label>
            <Input value={form.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="e.g. Roof Replacement — 123 Main St" required />
          </div>
          <div className="space-y-2">
            <Label>Job description</Label>
            <Textarea value={form.job_description} onChange={(e) => handleChange('job_description', e.target.value)} placeholder="Brief description of the job" rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Scope of work</Label>
            <Textarea value={form.scope_of_work} onChange={(e) => handleChange('scope_of_work', e.target.value)} placeholder="Detailed line-by-line scope" rows={5} />
          </div>
          <div className="space-y-2">
            <Label>Materials included</Label>
            <Textarea value={form.materials_included} onChange={(e) => handleChange('materials_included', e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Materials excluded (optional)</Label>
            <Textarea value={form.materials_excluded} onChange={(e) => handleChange('materials_excluded', e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estimated start date</Label>
              <Input type="date" value={form.estimated_start_date} onChange={(e) => handleChange('estimated_start_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Duration / timeline</Label>
              <Input value={form.estimated_duration} onChange={(e) => handleChange('estimated_duration', e.target.value)} placeholder="e.g. 3–5 business days" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Line Items & Pricing */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Line items</Label>
            <div className="border rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_80px_60px_100px_40px] gap-2 px-3 py-2 bg-muted text-xs font-medium text-muted-foreground">
                <span>Description</span><span>Qty</span><span>Unit</span><span>Unit Price</span><span></span>
              </div>
              {form.line_items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_60px_100px_40px] gap-2 px-3 py-2 border-t items-center">
                  <Input value={item.description} onChange={(e) => updateLineItem(i, 'description', e.target.value)} placeholder="Description" className="h-8 text-sm" />
                  <Input type="number" value={item.quantity} onChange={(e) => updateLineItem(i, 'quantity', parseFloat(e.target.value) || 0)} className="h-8 text-sm" min={0} />
                  <Input value={item.unit} onChange={(e) => updateLineItem(i, 'unit', e.target.value)} className="h-8 text-sm" />
                  <Input type="number" value={item.unit_price} onChange={(e) => updateLineItem(i, 'unit_price', parseFloat(e.target.value) || 0)} className="h-8 text-sm" min={0} step="0.01" />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLineItem(i)} disabled={form.line_items.length <= 1}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLineItem} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Add line item
            </Button>
          </div>

          {/* Totals */}
          <div className="border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-medium">${formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                Tax rate
                <Input type="number" value={form.tax_rate} onChange={(e) => handleChange('tax_rate', parseFloat(e.target.value) || 0)} className="h-7 w-16 text-sm" min={0} step="0.1" />%
              </span>
              <span className="font-medium">${formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2"><span className="font-medium">Total</span><span className="font-semibold text-base">${formatCurrency(total)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                Deposit
                <select
                  value={form.deposit_mode}
                  onChange={(e) => handleChange('deposit_mode', e.target.value)}
                  className="h-7 rounded border bg-background px-1 text-sm"
                >
                  <option value="percentage">%</option>
                  <option value="flat">$</option>
                </select>
                <Input type="number" value={form.deposit_value} onChange={(e) => handleChange('deposit_value', parseFloat(e.target.value) || 0)} className="h-7 w-20 text-sm" min={0} step="0.01" />
              </span>
              <span className="font-medium">${formatCurrency(depositAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2"><span className="font-medium">Balance due</span><span className="font-semibold">${formatCurrency(balanceDue)}</span></div>
          </div>

          <div className="space-y-2">
            <Label>Payment terms</Label>
            <Input value={form.payment_terms} onChange={(e) => handleChange('payment_terms', e.target.value)} placeholder="e.g. Net 15, Due on completion" />
          </div>
          <div className="space-y-2">
            <Label>Accepted payment methods</Label>
            <div className="flex flex-wrap gap-3">
              {paymentMethods.map((method) => (
                <label key={method} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.accepted_payment_methods.includes(method)}
                    onCheckedChange={() => togglePaymentMethod(method)}
                  />
                  {method}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Terms */}
      <Card>
        <CardHeader><CardTitle className="text-base">Terms</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Warranty terms</Label>
            <Textarea value={form.warranty_terms} onChange={(e) => handleChange('warranty_terms', e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Disclosures</Label>
            <Textarea value={form.disclosures} onChange={(e) => handleChange('disclosures', e.target.value)} rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Special conditions / notes (optional)</Label>
            <Textarea value={form.special_conditions} onChange={(e) => handleChange('special_conditions', e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Delivery */}
      <Card>
        <CardHeader><CardTitle className="text-base">Delivery</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Proposal date</Label>
              <Input type="date" value={form.proposal_date} onChange={(e) => handleChange('proposal_date', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Valid until</Label>
              <Input type="date" value={form.valid_until} onChange={(e) => handleChange('valid_until', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Delivery method</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={form.delivery_method === 'email_self' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleChange('delivery_method', 'email_self')}
              >
                Send to my email
              </Button>
              <Button
                type="button"
                variant={form.delivery_method === 'email_client' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleChange('delivery_method', 'email_client')}
              >
                Send to client for e-signature
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Proposal & Preview'}
        </Button>
      </div>
    </form>
  );
}
