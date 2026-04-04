-- 1. Block INSERT on user_roles for all authenticated users (only service role can insert)
CREATE POLICY "No direct role inserts"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (false);

-- Block DELETE on user_roles for all authenticated users
CREATE POLICY "No direct role deletes"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);

-- 2. Make signatures bucket private
UPDATE storage.buckets SET public = false WHERE id = 'signatures';

-- 3. Add missing SELECT policy for proposal_exhibits
CREATE POLICY "Users can view own exhibits"
ON public.proposal_exhibits
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM proposals
  WHERE proposals.id = proposal_exhibits.proposal_id
    AND proposals.user_id = auth.uid()
));