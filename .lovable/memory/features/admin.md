---
name: Admin Dashboard
description: Protected /admin route with Overview, Users, Proposals, Revenue pages
type: feature
---

- Route: /admin, /admin/users, /admin/proposals, /admin/revenue
- Access: user_roles table with app_role enum (admin, user) and has_role() security definer function
- Data: All fetched server-side via admin-data edge function using service role key
- AdminLayout checks admin role on every page load, redirects non-admins to /dashboard
- MRR calculated as active subscribers × $39
