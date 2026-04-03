---
name: Database schema
description: Full table structure, enums, relationships, and new tables for growth
type: feature
---
## Tables
- **company_profiles** — contractor profile (company_name, owner_name, trade_type, license_numbers, address, phone, email, website, insurance, defaults, logo_url, brand_color, stripe fields)
- **clients** (NEW) — name, email, phone, address, notes. Owned by contractor via user_id.
- **jobs** (NEW) — title, trade_type, job_status, job_site_address, start_date, estimated_duration, notes. Links to client.
- **proposals** — now has client_id, job_id, sent_at columns added. Keeps proposal_line_items as separate table.
- **proposal_line_items** — separate normalized table for line items
- **proposal_versions** — snapshot history
- **invoices** (NEW shell) — invoice_number, status, line_items jsonb, subtotal, tax, total, amount_paid, balance_due, due_date
- **payments** (NEW shell) — amount, payment_method, stripe_payment_intent_id, status
- **user_subscriptions** — now has plan (starter/pro) and current_period_start columns
- **user_roles** — admin role via has_role() security definer function

## Enums
- trade_type, proposal_status, proposal_template, deposit_mode (existing)
- job_status, invoice_status, payment_status, subscription_plan, app_role (new)

## All tables have RLS: users can only CRUD their own records
