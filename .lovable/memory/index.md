# Project Memory

## Core
EZ-Bid — contractor proposal generator. Clean minimal Notion-like design, no gradients.
Inter font, white bg, subtle gray borders. Primary is near-black #1a1a1a.
Supabase for auth/DB/storage. Tables: company_profiles, proposals, proposal_line_items, user_subscriptions, proposal_versions.
Free tier: 3 proposals, then $79/mo Stripe subscription.
Proposal statuses: draft, sent, signed, accepted, denied, work_pending, payment_pending, closed, expired.

## Memories
- [Design system](mem://design/tokens) — Clean minimal palette, Inter font, no gradients
- [DB schema](mem://features/database) — Tables, enums, auto-created profiles on signup
- [Proposal flow](mem://features/proposals) — Template selection → form → AI enhance → preview → send
- [AI revision](mem://features/ai-revision) — Conversation context, pricing/line-item edits, template switching
- [Clients page](mem://features/clients) — Proposals grouped by client with sorting
