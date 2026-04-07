
CREATE TABLE public.guest_proposals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert guest proposals"
  ON public.guest_proposals FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Admins can view guest proposals"
  ON public.guest_proposals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No updates on guest proposals"
  ON public.guest_proposals FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "No deletes on guest proposals"
  ON public.guest_proposals FOR DELETE TO authenticated
  USING (false);

CREATE INDEX idx_guest_proposals_ip ON public.guest_proposals (ip_address, created_at DESC);
