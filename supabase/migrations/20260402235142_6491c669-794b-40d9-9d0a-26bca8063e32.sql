ALTER TABLE public.company_profiles
ADD COLUMN stripe_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN stripe_account_id text;