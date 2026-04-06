-- Create page_views table for tracking site visits
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  user_id uuid,
  session_id text,
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous + authenticated visitors)
CREATE POLICY "Anyone can insert page views"
  ON public.page_views FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can read page views
CREATE POLICY "Admins can view page views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- No updates or deletes
CREATE POLICY "No updates on page views"
  ON public.page_views FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No deletes on page views"
  ON public.page_views FOR DELETE
  TO authenticated
  USING (false);

-- Index for time-series queries
CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_path ON public.page_views (path);

-- Create app_errors table for tracking client-side errors
CREATE TABLE public.app_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_message text NOT NULL,
  error_stack text,
  path text,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert errors"
  ON public.app_errors FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Admins can view errors"
  ON public.app_errors FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No updates on errors"
  ON public.app_errors FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No deletes on errors"
  ON public.app_errors FOR DELETE
  TO authenticated
  USING (false);

CREATE INDEX idx_app_errors_created_at ON public.app_errors (created_at DESC);