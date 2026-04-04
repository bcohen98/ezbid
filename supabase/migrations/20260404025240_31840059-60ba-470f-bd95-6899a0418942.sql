
ALTER TABLE public.proposals
ADD COLUMN contractor_signature_url text,
ADD COLUMN contractor_signed_at timestamptz;
