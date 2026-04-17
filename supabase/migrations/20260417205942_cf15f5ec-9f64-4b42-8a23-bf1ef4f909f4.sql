ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS hide_pricing_from_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS personal_message text;