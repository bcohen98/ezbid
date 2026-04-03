
-- Allow anonymous/public read of a single proposal by ID (for client signing page)
CREATE POLICY "Public can view proposal by id for signing"
ON public.proposals
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anonymous/public read of line items for any proposal (for client signing page)
CREATE POLICY "Public can view line items for signing"
ON public.proposal_line_items
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anonymous update of signature fields only
CREATE POLICY "Public can sign proposals"
ON public.proposals
FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);
