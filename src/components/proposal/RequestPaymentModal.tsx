import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: any;
  onRequested: () => void;
}

export default function RequestPaymentModal({ open, onOpenChange, proposal, onRequested }: Props) {
  const { toast } = useToast();
  const [paymentType, setPaymentType] = useState<'full_payment' | 'deposit'>('full_payment');
  const [amount, setAmount] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [description, setDescription] = useState('');
  const [personalMessage, setPersonalMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const total = Number(proposal?.total) || 0;
  const depositPaid = Number(proposal?.deposit_paid_amount) || 0;
  const balanceDue = total - depositPaid;
  const defaultDeposit = Number(proposal?.deposit_amount) || 0;

  useEffect(() => {
    if (!open || !proposal) return;
    setPaymentType('full_payment');
    setClientEmail(proposal.client_email || '');
    setDescription(`Payment for ${proposal.title || 'Proposal'}`);
    setPersonalMessage('');
    setAmount(balanceDue.toFixed(2));
  }, [open, proposal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    if (paymentType === 'deposit') {
      setAmount(defaultDeposit.toFixed(2));
    } else {
      setAmount(balanceDue.toFixed(2));
    }
  }, [paymentType]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter an amount greater than $0.', variant: 'destructive' });
      return;
    }
    if (!clientEmail.trim()) {
      toast({ title: 'Client email required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('create-payment-link', {
        body: {
          proposal_id: proposal.id,
          payment_type: paymentType,
          amount: amt,
          client_email: clientEmail.trim(),
          description: description.trim(),
          personal_message: personalMessage.trim(),
        },
      });
      if (error) throw error;
      toast({
        title: 'Payment link sent',
        description: `${clientEmail} will receive an email with a secure payment link.`,
      });
      onRequested();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Failed to request payment', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Payment</DialogTitle>
          <DialogDescription>
            Send {proposal?.client_name || 'your client'} a secure Stripe payment link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Payment type</Label>
            <RadioGroup
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as any)}
              className="grid grid-cols-2 gap-2"
            >
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="full_payment" />
                <span className="text-sm">Full payment</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="deposit" />
                <span className="text-sm">Deposit only</span>
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                className="pl-8"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-email">Client email</Label>
            <Input
              id="client-email"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message to client (optional)</Label>
            <Textarea
              id="message"
              rows={3}
              placeholder="Add a personal note..."
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            EZ-Bid charges 1% + Stripe fees (2.9% + 30¢). Funds transfer to your bank account.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
            Send Payment Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
