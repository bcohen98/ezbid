
-- Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trade type enum
CREATE TYPE public.trade_type AS ENUM (
  'general_contractor', 'roofing', 'plumbing', 'hvac', 
  'electrical', 'landscaping', 'painting', 'flooring', 'other'
);

-- Proposal status enum
CREATE TYPE public.proposal_status AS ENUM (
  'draft', 'sent', 'signed', 'expired'
);

-- Proposal template enum
CREATE TYPE public.proposal_template AS ENUM (
  'classic', 'modern', 'minimal'
);

-- Deposit mode enum
CREATE TYPE public.deposit_mode AS ENUM ('percentage', 'flat');

-- Company profiles table
CREATE TABLE public.company_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  company_name TEXT,
  owner_name TEXT,
  trade_type public.trade_type,
  license_numbers TEXT[] DEFAULT '{}',
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  insurance_info TEXT,
  default_payment_terms TEXT,
  default_deposit_percentage NUMERIC(5,2),
  default_warranty TEXT,
  default_disclosures TEXT,
  logo_url TEXT,
  brand_color TEXT DEFAULT '#000000',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.company_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.company_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.company_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User subscriptions table
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT NOT NULL DEFAULT 'free',
  proposals_used INTEGER NOT NULL DEFAULT 0,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Proposals table
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proposal_number INTEGER NOT NULL,
  template public.proposal_template NOT NULL DEFAULT 'classic',
  status public.proposal_status NOT NULL DEFAULT 'draft',
  
  -- Client info
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  job_site_street TEXT,
  job_site_city TEXT,
  job_site_state TEXT,
  job_site_zip TEXT,
  
  -- Job details
  title TEXT,
  job_description TEXT,
  scope_of_work TEXT,
  materials_included TEXT,
  materials_excluded TEXT,
  estimated_start_date DATE,
  estimated_duration TEXT,
  
  -- Pricing
  subtotal NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  deposit_mode public.deposit_mode DEFAULT 'percentage',
  deposit_value NUMERIC(12,2) DEFAULT 0,
  deposit_amount NUMERIC(12,2) DEFAULT 0,
  balance_due NUMERIC(12,2) DEFAULT 0,
  payment_terms TEXT,
  accepted_payment_methods TEXT[] DEFAULT '{}',
  
  -- Terms
  warranty_terms TEXT,
  disclosures TEXT,
  special_conditions TEXT,
  
  -- Delivery
  proposal_date DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  delivery_method TEXT DEFAULT 'email_self',
  
  -- AI enhanced fields
  enhanced_job_description TEXT,
  enhanced_scope_of_work TEXT,
  
  -- Signature
  client_signature_url TEXT,
  client_signed_at TIMESTAMP WITH TIME ZONE,
  
  -- PDF
  pdf_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proposals" ON public.proposals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own proposals" ON public.proposals
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proposals" ON public.proposals
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own proposals" ON public.proposals
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_proposals_updated_at
  BEFORE UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-increment proposal number per user
CREATE OR REPLACE FUNCTION public.get_next_proposal_number(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(proposal_number), 0) + 1 INTO next_num
  FROM public.proposals WHERE user_id = p_user_id;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Proposal line items table
CREATE TABLE public.proposal_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'ea',
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.proposal_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own line items" ON public.proposal_line_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_line_items.proposal_id AND proposals.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own line items" ON public.proposal_line_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_line_items.proposal_id AND proposals.user_id = auth.uid())
  );
CREATE POLICY "Users can update own line items" ON public.proposal_line_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_line_items.proposal_id AND proposals.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own line items" ON public.proposal_line_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.proposals WHERE proposals.id = proposal_line_items.proposal_id AND proposals.user_id = auth.uid())
  );

-- Auto-create profile and subscription on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.company_profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  INSERT INTO public.user_subscriptions (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Logo storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Logo images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'logos');
CREATE POLICY "Users can upload their own logo" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own logo" ON storage.objects
  FOR UPDATE USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own logo" ON storage.objects
  FOR DELETE USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Signatures storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true);

CREATE POLICY "Signature images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'signatures');
CREATE POLICY "Anyone can upload signatures" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'signatures');

-- PDFs storage bucket  
INSERT INTO storage.buckets (id, name, public) VALUES ('proposal-pdfs', 'proposal-pdfs', false);

CREATE POLICY "Users can view own PDFs" ON storage.objects
  FOR SELECT USING (bucket_id = 'proposal-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own PDFs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'proposal-pdfs' AND auth.uid()::text = (storage.foldername(name))[1]);
