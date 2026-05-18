
-- 1. Drop the dangerous 2-arg sign_proposal overload (unused)
DROP FUNCTION IF EXISTS public.sign_proposal(uuid, text);

-- 2. Rewrite 3-arg sign_proposal to enforce ownership on the authenticated path
CREATE OR REPLACE FUNCTION public.sign_proposal(
  p_proposal_id uuid,
  p_signature_url text,
  p_signing_token uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_signing_token IS NOT NULL THEN
    UPDATE public.proposals
    SET
      client_signature_url = p_signature_url,
      client_signed_at = now(),
      status = 'signed'
    WHERE id = p_proposal_id
      AND signing_token = p_signing_token
      AND status = 'sent';
  ELSE
    -- Authenticated user signing — must own the proposal
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required';
    END IF;
    UPDATE public.proposals
    SET
      client_signature_url = p_signature_url,
      client_signed_at = now(),
      status = 'signed'
    WHERE id = p_proposal_id
      AND user_id = auth.uid()
      AND status = 'sent';
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found, invalid token, or not authorized';
  END IF;
END;
$function$;

-- 3. Rebuild get_proposal_for_signing to expose only safe fields
CREATE OR REPLACE FUNCTION public.get_proposal_for_signing(
  p_proposal_id uuid,
  p_signing_token uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
  proposal_row proposals%ROWTYPE;
BEGIN
  SELECT * INTO proposal_row
  FROM public.proposals
  WHERE id = p_proposal_id
    AND signing_token = p_signing_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposal not found or invalid token';
  END IF;

  SELECT json_build_object(
    'proposal', json_build_object(
      'id', p.id,
      'proposal_number', p.proposal_number,
      'template', p.template,
      'status', p.status,
      'client_name', p.client_name,
      'client_email', p.client_email,
      'client_phone', p.client_phone,
      'job_site_street', p.job_site_street,
      'job_site_city', p.job_site_city,
      'job_site_state', p.job_site_state,
      'job_site_zip', p.job_site_zip,
      'title', p.title,
      'job_description', p.job_description,
      'scope_of_work', p.scope_of_work,
      'materials_included', p.materials_included,
      'materials_excluded', p.materials_excluded,
      'estimated_start_date', p.estimated_start_date,
      'estimated_duration', p.estimated_duration,
      'subtotal', p.subtotal,
      'tax_rate', p.tax_rate,
      'tax_amount', p.tax_amount,
      'total', p.total,
      'deposit_mode', p.deposit_mode,
      'deposit_value', p.deposit_value,
      'deposit_amount', p.deposit_amount,
      'balance_due', p.balance_due,
      'payment_terms', p.payment_terms,
      'accepted_payment_methods', p.accepted_payment_methods,
      'warranty_terms', p.warranty_terms,
      'disclosures', p.disclosures,
      'special_conditions', p.special_conditions,
      'proposal_date', p.proposal_date,
      'valid_until', p.valid_until,
      'enhanced_job_description', p.enhanced_job_description,
      'enhanced_scope_of_work', p.enhanced_scope_of_work,
      'client_signature_url', p.client_signature_url,
      'client_signed_at', p.client_signed_at,
      'pdf_url', p.pdf_url,
      'logo_size', p.logo_size,
      'logo_position', p.logo_position,
      'contractor_signature_url', p.contractor_signature_url,
      'contractor_signed_at', p.contractor_signed_at,
      'signing_token', p.signing_token,
      'trade_type', p.trade_type,
      'font_style', p.font_style,
      'header_style', p.header_style,
      'payment_status', p.payment_status,
      'deposit_paid_at', p.deposit_paid_at,
      'deposit_paid_amount', p.deposit_paid_amount,
      'payment_paid_at', p.payment_paid_at,
      'payment_paid_amount', p.payment_paid_amount,
      'payment_requested_at', p.payment_requested_at,
      'hide_pricing_from_client', p.hide_pricing_from_client,
      'personal_message', p.personal_message,
      'job_zip', p.job_zip,
      'job_state', p.job_state,
      'show_materials', p.show_materials,
      'show_quantities', p.show_quantities,
      'show_pricing', p.show_pricing,
      'payment_link_url', p.payment_link_url,
      'custom_accent_color', p.custom_accent_color,
      'created_at', p.created_at,
      'updated_at', p.updated_at
    ),
    'line_items', COALESCE((
      SELECT json_agg(row_to_json(li) ORDER BY li.sort_order)
      FROM public.proposal_line_items li
      WHERE li.proposal_id = p_proposal_id
    ), '[]'::json),
    'company_profile', (
      SELECT json_build_object(
        'company_name', cp.company_name,
        'owner_name', cp.owner_name,
        'phone', cp.phone,
        'email', cp.email,
        'website', cp.website,
        'street_address', cp.street_address,
        'city', cp.city,
        'state', cp.state,
        'zip', cp.zip,
        'license_numbers', cp.license_numbers,
        'insurance_info', cp.insurance_info,
        'logo_url', cp.logo_url,
        'brand_color', cp.brand_color,
        'brand_font', cp.brand_font,
        'trade_type', cp.trade_type
      )
      FROM public.company_profiles cp
      WHERE cp.user_id = p.user_id
    ),
    'exhibits', COALESCE((
      SELECT json_agg(row_to_json(ex) ORDER BY ex.sort_order)
      FROM public.proposal_exhibits ex
      WHERE ex.proposal_id = p_proposal_id
    ), '[]'::json)
  ) INTO result
  FROM public.proposals p
  WHERE p.id = p_proposal_id;

  RETURN result;
END;
$function$;

-- 4. Tighten EXECUTE grants on SECURITY DEFINER helpers

-- Internal/server-only — revoke from anon & authenticated
REVOKE EXECUTE ON FUNCTION public.increment_proposals_used(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sign_proposal(uuid, text, uuid) FROM PUBLIC, anon;

-- Used in RLS policies — must remain callable; ensure only authenticated can call directly
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- get_next_proposal_number: client-callable only when authenticated
REVOKE EXECUTE ON FUNCTION public.get_next_proposal_number(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_next_proposal_number(uuid) TO authenticated;

-- get_proposal_for_signing: must remain callable by anon (signing page is public)
GRANT EXECUTE ON FUNCTION public.get_proposal_for_signing(uuid, uuid) TO anon, authenticated;

-- sign_proposal (3-arg): callable by authenticated (with ownership check) and anon (with token)
GRANT EXECUTE ON FUNCTION public.sign_proposal(uuid, text, uuid) TO anon, authenticated;
