
-- Create referral status enum
CREATE TYPE public.referral_status AS ENUM ('pending', 'signed_up', 'converted');

-- referral_codes table
CREATE TABLE public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral codes" ON public.referral_codes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own referral codes" ON public.referral_codes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all referral codes" ON public.referral_codes
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- referrals table
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL,
  referred_user_id uuid,
  referred_email text NOT NULL,
  status referral_status NOT NULL DEFAULT 'pending',
  stripe_subscription_id text,
  credit_applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  converted_at timestamptz
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_user_id);
CREATE POLICY "Users can insert own referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_user_id);
CREATE POLICY "Admins can view all referrals" ON public.referrals
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- referral_credits table
CREATE TABLE public.referral_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  referral_id uuid NOT NULL REFERENCES public.referrals(id),
  credit_months integer NOT NULL DEFAULT 1,
  applied_at timestamptz,
  stripe_invoice_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits" ON public.referral_credits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all credits" ON public.referral_credits
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
