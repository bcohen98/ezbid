
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE public.job_status AS ENUM ('lead', 'proposed', 'won', 'lost', 'in_progress', 'completed');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');
CREATE TYPE public.payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE public.subscription_plan AS ENUM ('starter', 'pro');

-- =============================================
-- CLIENTS TABLE
-- =============================================
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- JOBS TABLE
-- =============================================
CREATE TABLE public.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    trade_type public.trade_type,
    status public.job_status NOT NULL DEFAULT 'lead',
    job_site_address TEXT,
    start_date DATE,
    estimated_duration TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.jobs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own jobs" ON public.jobs FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- INVOICES TABLE (shell)
-- =============================================
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
    invoice_number SERIAL,
    status public.invoice_status NOT NULL DEFAULT 'draft',
    line_items JSONB DEFAULT '[]'::jsonb,
    subtotal NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    total NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    balance_due NUMERIC DEFAULT 0,
    due_date DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invoices" ON public.invoices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own invoices" ON public.invoices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own invoices" ON public.invoices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own invoices" ON public.invoices FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- PAYMENTS TABLE (shell)
-- =============================================
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT,
    stripe_payment_intent_id TEXT,
    status public.payment_status NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payments" ON public.payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payments" ON public.payments FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- MODIFY PROPOSALS — add client_id, job_id, sent_at
-- =============================================
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- =============================================
-- MODIFY USER_SUBSCRIPTIONS — add plan, current_period_start
-- =============================================
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS plan public.subscription_plan DEFAULT 'starter';
ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
