
CREATE TABLE public.conversion_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  event_name text NOT NULL,
  user_id uuid,
  session_id text,
  visitor_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  page_path text
);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view conversion events"
  ON public.conversion_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert conversion events"
  ON public.conversion_events FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "No updates on conversion events"
  ON public.conversion_events FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No deletes on conversion events"
  ON public.conversion_events FOR DELETE
  TO authenticated
  USING (false);

CREATE INDEX idx_conversion_events_created_at ON public.conversion_events (created_at DESC);
CREATE INDEX idx_conversion_events_event_name ON public.conversion_events (event_name);
