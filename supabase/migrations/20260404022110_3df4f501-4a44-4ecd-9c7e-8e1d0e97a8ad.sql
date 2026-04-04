
-- Create proposal_exhibits table
CREATE TABLE public.proposal_exhibits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proposal_exhibits ENABLE ROW LEVEL SECURITY;

-- Public can view (for signing page)
CREATE POLICY "Public can view exhibits"
ON public.proposal_exhibits FOR SELECT
TO anon, authenticated
USING (true);

-- Owner can insert
CREATE POLICY "Users can insert own exhibits"
ON public.proposal_exhibits FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.proposals
  WHERE proposals.id = proposal_exhibits.proposal_id
    AND proposals.user_id = auth.uid()
));

-- Owner can update
CREATE POLICY "Users can update own exhibits"
ON public.proposal_exhibits FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proposals
  WHERE proposals.id = proposal_exhibits.proposal_id
    AND proposals.user_id = auth.uid()
));

-- Owner can delete
CREATE POLICY "Users can delete own exhibits"
ON public.proposal_exhibits FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.proposals
  WHERE proposals.id = proposal_exhibits.proposal_id
    AND proposals.user_id = auth.uid()
));

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-exhibits', 'proposal-exhibits', true);

-- Storage policies
CREATE POLICY "Exhibit files are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'proposal-exhibits');

CREATE POLICY "Authenticated users can upload exhibits"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proposal-exhibits' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own exhibit files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'proposal-exhibits' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own exhibit files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'proposal-exhibits' AND auth.uid()::text = (storage.foldername(name))[1]);
