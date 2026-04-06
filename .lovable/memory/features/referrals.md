---
name: Referral program
description: Full referral system — codes, invite emails, Stripe credit on conversion, admin dashboard
type: feature
---
## Tables
- **referral_codes** — user_id, code (unique). Auto-generated on first dashboard load.
- **referrals** — referrer_user_id, referred_email, status (pending/signed_up/converted), stripe_subscription_id, credit_applied
- **referral_credits** — user_id, referral_id, credit_months, applied_at, stripe_invoice_id

## Flow
1. User gets auto-generated code (e.g. BRETT42) on first load
2. Share via copy link or email invites (send-referral-invite edge function via Resend)
3. Signup page captures ?ref= param, stores in localStorage
4. On signup, link-referral edge function links the referral (status → signed_up)
5. On Stripe checkout.session.completed, stripe-webhook checks referrals table → marks converted → creates credit → applies $39 Stripe customer balance credit → sends congrats email

## Pages
- /referrals — Refer & Earn page with stats, link copy, email invites, referral table
- /admin/referrals — Admin view with all referrals, top referrers leaderboard, credit stats

## Components
- ReferralPromoCard — reusable promo card, supports compact/dismissible modes
