-- Create site_analytics table
CREATE TABLE public.site_analytics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL,
  page_url text NOT NULL,
  session_id text,
  visitor_id text,
  is_logged_in boolean NOT NULL DEFAULT false,
  user_id uuid,
  is_guest_proposal_start boolean NOT NULL DEFAULT false,
  is_guest_proposal_complete boolean NOT NULL DEFAULT false,
  visited_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;

-- Admin read access
CREATE POLICY "Admins can view site analytics"
  ON public.site_analytics
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Public insert (edge function uses service role, but allow anon inserts too)
CREATE POLICY "Anyone can insert site analytics"
  ON public.site_analytics
  FOR INSERT
  TO public
  WITH CHECK (true);

-- No updates
CREATE POLICY "No updates on site analytics"
  ON public.site_analytics
  FOR UPDATE
  TO authenticated
  USING (false);

-- No deletes
CREATE POLICY "No deletes on site analytics"
  ON public.site_analytics
  FOR DELETE
  TO authenticated
  USING (false);

-- Index for efficient date range queries
CREATE INDEX idx_site_analytics_visited_at ON public.site_analytics (visited_at DESC);
CREATE INDEX idx_site_analytics_ip ON public.site_analytics (ip_address);
CREATE INDEX idx_site_analytics_visitor_id ON public.site_analytics (visitor_id);