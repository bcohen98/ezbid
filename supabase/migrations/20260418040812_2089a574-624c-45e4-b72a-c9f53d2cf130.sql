ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS job_zip text,
  ADD COLUMN IF NOT EXISTS job_state text,
  ADD COLUMN IF NOT EXISTS materials_context_count integer DEFAULT 0;