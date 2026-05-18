
ALTER TABLE public.lifecycle_email_unsubs
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

-- Existing rows in this table all represent unsubscribed users (legacy semantics)
UPDATE public.lifecycle_email_unsubs
SET unsubscribed_at = COALESCE(unsubscribed_at, created_at, now())
WHERE unsubscribed_at IS NULL;

CREATE INDEX IF NOT EXISTS lifecycle_email_unsubs_token_idx
  ON public.lifecycle_email_unsubs(token);
