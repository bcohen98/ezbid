
-- 1. Signature bucket: restrict reads to owner
DROP POLICY IF EXISTS "Signature images are publicly accessible" ON storage.objects;
CREATE POLICY "Users can view own signatures"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'signatures'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 2. Remove client-side UPDATE on user_subscriptions (use SECURITY DEFINER fn instead)
DROP POLICY IF EXISTS "Users can update own proposals_used" ON public.user_subscriptions;

-- 3. app_errors: require auth + length caps
DROP POLICY IF EXISTS "Anyone can insert errors" ON public.app_errors;
CREATE POLICY "Authenticated users can insert errors"
ON public.app_errors FOR INSERT
TO authenticated
WITH CHECK (true);

ALTER TABLE public.app_errors
  ADD CONSTRAINT error_message_max_len CHECK (char_length(error_message) <= 2000),
  ADD CONSTRAINT error_stack_max_len CHECK (error_stack IS NULL OR char_length(error_stack) <= 10000);
