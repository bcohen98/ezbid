-- Add Stripe Connect columns to company_profiles
ALTER TABLE public.company_profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id text,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled boolean NOT NULL DEFAULT false;

-- Add payment tracking columns to proposals
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS stripe_deposit_intent_id text,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_paid_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_paid_amount numeric,
  ADD COLUMN IF NOT EXISTS payment_requested_at timestamptz;

-- Create payment_transactions table
CREATE TABLE public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  stripe_payment_intent_id text,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  client_name text,
  client_email text,
  stripe_fee numeric,
  platform_fee numeric,
  net_amount numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own payment transactions
CREATE POLICY "Users can view own payment transactions"
  ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No client inserts/updates/deletes - service role only
CREATE POLICY "No client inserts on payment transactions"
  ON public.payment_transactions FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "No client updates on payment transactions"
  ON public.payment_transactions FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No client deletes on payment transactions"
  ON public.payment_transactions FOR DELETE
  TO authenticated
  USING (false);

-- Admin can view all
CREATE POLICY "Admins can view all payment transactions"
  ON public.payment_transactions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for performance
CREATE INDEX idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_proposal_id ON public.payment_transactions(proposal_id);
CREATE INDEX idx_payment_transactions_status ON public.payment_transactions(status);

-- Trigger for updated_at
CREATE TRIGGER update_payment_transactions_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();