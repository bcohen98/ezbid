-- Add revision_history JSONB column to proposals for AI conversation context
ALTER TABLE public.proposals ADD COLUMN revision_history jsonb DEFAULT '[]'::jsonb;

-- Expand proposal_status enum with new values
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'denied';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'work_pending';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'payment_pending';
ALTER TYPE public.proposal_status ADD VALUE IF NOT EXISTS 'closed';

-- Create proposal_versions table for tracking changes to sent proposals
CREATE TABLE public.proposal_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL,
  change_summary text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(proposal_id, version_number)
);

ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposal versions"
ON public.proposal_versions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.proposals WHERE proposals.id = proposal_versions.proposal_id AND proposals.user_id = auth.uid()
));

CREATE POLICY "Users can create own proposal versions"
ON public.proposal_versions FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.proposals WHERE proposals.id = proposal_versions.proposal_id AND proposals.user_id = auth.uid()
));

CREATE POLICY "Users can delete own proposal versions"
ON public.proposal_versions FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.proposals WHERE proposals.id = proposal_versions.proposal_id AND proposals.user_id = auth.uid()
));