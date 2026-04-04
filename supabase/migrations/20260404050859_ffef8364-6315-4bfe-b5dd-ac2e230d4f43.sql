
-- 1. Remove blanket public SELECT on proposal_line_items
DROP POLICY IF EXISTS "Public can view line items for signing" ON public.proposal_line_items;

-- 2. Remove blanket public SELECT on proposal_exhibits
DROP POLICY IF EXISTS "Public can view exhibits" ON public.proposal_exhibits;

-- 3. Replace user_subscriptions INSERT policy with a restricted one
-- The handle_new_user trigger uses SECURITY DEFINER so it bypasses RLS.
-- Users should NOT be able to insert subscription rows directly.
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.user_subscriptions;

-- 4. Replace user_subscriptions UPDATE policy with a restricted one
-- Only allow updating proposals_used (the only field the client legitimately writes)
DROP POLICY IF EXISTS "Users can update own subscription" ON public.user_subscriptions;

CREATE POLICY "Users can update own proposals_used"
ON public.user_subscriptions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND plan IS NOT DISTINCT FROM (SELECT plan FROM public.user_subscriptions WHERE user_id = auth.uid())
  AND status IS NOT DISTINCT FROM (SELECT status FROM public.user_subscriptions WHERE user_id = auth.uid())
  AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM public.user_subscriptions WHERE user_id = auth.uid())
  AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM public.user_subscriptions WHERE user_id = auth.uid())
  AND current_period_end IS NOT DISTINCT FROM (SELECT current_period_end FROM public.user_subscriptions WHERE user_id = auth.uid())
  AND current_period_start IS NOT DISTINCT FROM (SELECT current_period_start FROM public.user_subscriptions WHERE user_id = auth.uid())
);
