
CREATE TABLE public.user_intelligence_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  trade_type text,
  computed_stats jsonb,
  intelligence_profile jsonb,
  proposal_count_at_computation integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_intelligence_cache ENABLE ROW LEVEL SECURITY;

-- Users can only read their own cache
CREATE POLICY "Users can view own intelligence cache"
ON public.user_intelligence_cache
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all cache rows
CREATE POLICY "Admins can view all intelligence cache"
ON public.user_intelligence_cache
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- No client-side writes - only service role can write
CREATE POLICY "No client inserts on intelligence cache"
ON public.user_intelligence_cache
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "No client updates on intelligence cache"
ON public.user_intelligence_cache
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "No client deletes on intelligence cache"
ON public.user_intelligence_cache
FOR DELETE
TO authenticated
USING (false);

-- Index for performance
CREATE INDEX idx_user_intelligence_cache_user_id ON public.user_intelligence_cache(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_intelligence_cache_updated_at
BEFORE UPDATE ON public.user_intelligence_cache
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
