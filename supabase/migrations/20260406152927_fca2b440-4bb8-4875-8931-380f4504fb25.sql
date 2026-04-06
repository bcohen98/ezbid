CREATE OR REPLACE FUNCTION public.increment_proposals_used(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.user_subscriptions
  SET proposals_used = proposals_used + 1,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;