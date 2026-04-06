---
name: Lifecycle email sequence
description: 4 automated plain-text emails via Resend from brett@ezbid.pro
type: feature
---
## Emails
1. **Welcome** — instant on signup, triggered from AuthPage
2. **Day-1 nudge** — 24h after signup if 0 proposals, cron-triggered hourly
3. **Free limit hit** — instant when 3rd proposal created, triggered from NewProposal
4. **Day-10 inactive** — paid subscriber inactive 10d, cron-triggered hourly

## Edge Functions
- `send-lifecycle-email` — generic sender, checks unsubs + dedup, logs to lifecycle_email_logs
- `check-lifecycle-emails` — cron (hourly) for emails 2 & 4
- `handle-lifecycle-unsubscribe` — GET endpoint that marks user unsubscribed, returns HTML confirmation

## Tables
- `lifecycle_email_logs` — user_id, email_type, recipient_email, created_at
- `lifecycle_email_unsubs` — user_id (unique), token

## Rules
- All from brett@ezbid.pro display name "Brett"
- Plain text only, no HTML templates
- Each email type sent at most once per user
- Unsubscribed users skip all lifecycle emails
- Does NOT affect existing proposal emails (send-proposal-email)
