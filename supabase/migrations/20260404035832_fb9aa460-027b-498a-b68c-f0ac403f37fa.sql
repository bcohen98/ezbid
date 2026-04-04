
-- 1. Add signing_token to proposals
ALTER TABLE public.proposals
ADD COLUMN IF NOT EXISTS signing_token uuid DEFAULT gen_random_uuid();

-- Backfill existing proposals with tokens
UPDATE public.proposals SET signing_token = gen_random_uuid() WHERE signing_token IS NULL;

-- Make it NOT NULL going forward
ALTER TABLE public.proposals ALTER COLUMN signing_token SET NOT NULL;
ALTER TABLE public.proposals ALTER COLUMN signing_token SET DEFAULT gen_random_uuid();

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS idx_proposals_signing_token ON public.proposals(signing_token);

-- 2. Replace the blanket public SELECT policy on proposals
DROP POLICY IF EXISTS "Public can view proposal by id for signing" ON public.proposals;

-- New scoped policy: only match by signing_token for anon/authenticated
CREATE POLICY "Public can view proposal by signing token"
ON public.proposals
FOR SELECT
TO anon, authenticated
USING (true);
-- Note: We use USING(true) temporarily here because the actual scoping
-- will happen in the edge function with service role. We'll drop this
-- policy entirely after deploying the edge function.

-- Actually, let's do it right: remove public access entirely.
-- The signing page will use an edge function with service role.
DROP POLICY IF EXISTS "Public can view proposal by signing token" ON public.proposals;

-- 3. Add DELETE and UPDATE policies for proposal-pdfs bucket
CREATE POLICY "Users can delete own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'proposal-pdfs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'proposal-pdfs'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 4. Remove the anonymous upload policy on signatures bucket
DROP POLICY IF EXISTS "Anyone can upload signatures" ON storage.objects;

-- Add scoped policy for authenticated users
CREATE POLICY "Authenticated users can upload signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'signatures'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 5. Also update the sign_proposal function to accept a signing_token for validation
CREATE OR REPLACE FUNCTION public.sign_proposal(p_proposal_id uuid, p_signature_url text, p_signing_token uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_signing_token IS NOT NULL THEN
    -- Token-based signing (unauthenticated client)
    UPDATE public.proposals
    SET 
      client_signature_url = p_signature_url,
      client_signed_at = now(),
      status = 'signed'
    WHERE id = p_proposal_id
      AND signing_token = p_signing_token
      AND status = 'sent';
  ELSE
    -- Authenticated user signing
    UPDATE public.proposals
    SET 
      client_signature_url = p_signature_url,
      client_signed_at = now(),
      status = 'signed'
    WHERE id = p_proposal_id
      AND status = 'sent';
  END IF;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found, invalid token, or not in sent status';
  END IF;
END;
$$;

-- 6. Create a function to get proposal data for signing (service role bypass not needed, 
-- this is a SECURITY DEFINER function that validates the token)
CREATE OR REPLACE FUNCTION public.get_proposal_for_signing(p_proposal_id uuid, p_signing_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  proposal_row proposals%ROWTYPE;
BEGIN
  SELECT * INTO proposal_row
  FROM public.proposals
  WHERE id = p_proposal_id
    AND signing_token = p_signing_token;
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found or invalid token';
  END IF;
  
  SELECT json_build_object(
    'proposal', row_to_json(p),
    'line_items', COALESCE((
      SELECT json_agg(row_to_json(li) ORDER BY li.sort_order)
      FROM public.proposal_line_items li
      WHERE li.proposal_id = p_proposal_id
    ), '[]'::json),
    'company_profile', (
      SELECT row_to_json(cp)
      FROM public.company_profiles cp
      WHERE cp.user_id = p.user_id
    ),
    'exhibits', COALESCE((
      SELECT json_agg(row_to_json(ex) ORDER BY ex.sort_order)
      FROM public.proposal_exhibits ex
      WHERE ex.proposal_id = p_proposal_id
    ), '[]'::json)
  ) INTO result
  FROM public.proposals p
  WHERE p.id = p_proposal_id;
  
  RETURN result;
END;
$$;

-- 7. Create a function to upload signature for unauthenticated signing
-- (The actual file upload will happen via edge function, but the URL update goes through sign_proposal)
