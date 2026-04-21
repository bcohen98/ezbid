
CREATE TABLE IF NOT EXISTS public.ambassador_profiles (
  user_id uuid PRIMARY KEY,
  initials text NOT NULL,
  total_codes_generated integer NOT NULL DEFAULT 0,
  total_conversions integer NOT NULL DEFAULT 0,
  total_approved_payouts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ambassador_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own profile" ON public.ambassador_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all ambassador profiles" ON public.ambassador_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage ambassador profiles" ON public.ambassador_profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.ambassador_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL,
  prospect_name text NOT NULL,
  prospect_phone text,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 days'),
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  converted_user_id uuid,
  payout_approved boolean NOT NULL DEFAULT false,
  notes text
);
CREATE INDEX IF NOT EXISTS idx_amb_prospects_amb ON public.ambassador_prospects(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_amb_prospects_code ON public.ambassador_prospects(code);
ALTER TABLE public.ambassador_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own prospects" ON public.ambassador_prospects
  FOR SELECT TO authenticated USING (auth.uid() = ambassador_id);
CREATE POLICY "Ambassadors insert own prospects" ON public.ambassador_prospects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = ambassador_id AND public.has_role(auth.uid(), 'ambassador'));
CREATE POLICY "Admins view all prospects" ON public.ambassador_prospects
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update prospects" ON public.ambassador_prospects
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.ambassador_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id uuid NOT NULL,
  recipient_user_id uuid NOT NULL,
  amount integer NOT NULL CHECK (amount BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_amb_grants_recipient ON public.ambassador_grants(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_amb_grants_amb ON public.ambassador_grants(ambassador_id);
ALTER TABLE public.ambassador_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors view own grants" ON public.ambassador_grants
  FOR SELECT TO authenticated USING (auth.uid() = ambassador_id);
CREATE POLICY "Admins view all grants" ON public.ambassador_grants
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.company_profiles ADD COLUMN IF NOT EXISTS prospect_phone text;

CREATE TRIGGER update_ambassador_profiles_updated_at
  BEFORE UPDATE ON public.ambassador_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
