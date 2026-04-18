
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS show_materials boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_quantities boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_pricing boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pricing_audit jsonb DEFAULT '[]'::jsonb;
