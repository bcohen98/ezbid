
-- Enable extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Lifecycle email send log
CREATE TABLE public.lifecycle_email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_type text NOT NULL,
  recipient_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lifecycle_email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view lifecycle email logs"
  ON public.lifecycle_email_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for checking if an email type was already sent to a user
CREATE INDEX idx_lifecycle_logs_user_type ON public.lifecycle_email_logs (user_id, email_type);

-- Lifecycle email unsubscribes
CREATE TABLE public.lifecycle_email_unsubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lifecycle_email_unsubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view lifecycle unsubs"
  ON public.lifecycle_email_unsubs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
