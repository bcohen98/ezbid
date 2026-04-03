
-- Remove the overly permissive update policy
DROP POLICY IF EXISTS "Public can sign proposals" ON public.proposals;

-- Create a secure function for signing proposals
CREATE OR REPLACE FUNCTION public.sign_proposal(
  p_proposal_id uuid,
  p_signature_url text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.proposals
  SET 
    client_signature_url = p_signature_url,
    client_signed_at = now(),
    status = 'signed'
  WHERE id = p_proposal_id
    AND status = 'sent';
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found or not in sent status';
  END IF;
END;
$$;

-- Grant execute to anon so unauthenticated clients can call it
GRANT EXECUTE ON FUNCTION public.sign_proposal(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.sign_proposal(uuid, text) TO authenticated;
