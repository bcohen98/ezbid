# EZ-Bid — Professional Contractor Proposals

Generate AI-powered professional proposals for contractors.

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 Measurement ID (e.g. `G-XXXXXXXXXX`) |

### Vercel Deployment

Add all variables above in **Vercel → Project Settings → Environment Variables**.

`VITE_GA_MEASUREMENT_ID` enables Google Analytics 4 with full conversion tracking (page views, sign-ups, logins, proposal events, subscriptions).
