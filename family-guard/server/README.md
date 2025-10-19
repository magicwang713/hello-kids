# Server (Supabase)

This package contains the Supabase schema and Edge Functions for Family Guard.

## Structure

- `schema.sql` – database tables and indexes
- `functions/` – Supabase Edge Functions implemented with Deno

## Setup

1. Install the Supabase CLI and authenticate with your project.
2. Set environment variables for function execution (for local testing):
   ```bash
   export SUPABASE_URL="https://<project>.supabase.co"
   export SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
   export SUPABASE_ANON_KEY="<anon-key>"
   ```
3. Run the SQL schema:
   ```bash
   supabase db push --file ./server/schema.sql
   ```
4. Deploy functions (example):
   ```bash
   supabase functions deploy register_device
   supabase functions deploy post_usage_batch
   supabase functions deploy post_anomaly
   supabase functions deploy get_dashboard
   supabase functions deploy export_delete
   supabase functions deploy send_expo_push
   ```

Detailed configuration and environment variables will be added in subsequent commits.
