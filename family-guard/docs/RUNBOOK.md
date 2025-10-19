# Family Guard Runbook

## Environments
- **Supabase project:** Stores Auth, Postgres, and Edge Functions. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` for local testing.
- **Parent app (Expo):** Runs with `npx expo start` using `.env` variables `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- **Kid Android app:** Built with Gradle (`./gradlew assembleDebug`). Requires usage access permission and optional device admin privileges.

## Provisioning
1. Deploy database schema: `supabase db push --file ./server/schema.sql`.
2. Deploy edge functions listed in `server/README.md`.
3. Configure Supabase Auth email templates for consent confirmation.
4. In Expo, set `app.config` with bundle identifiers and push notification credentials if used.

## Pairing Workflow
1. Parent app requests a pairing code (Edge Function to be called from parent session) and shares it with the child device.
2. Child device submits the code to `/register_device`. A device-scoped API key is issued and stored in secure storage.
3. Child app starts `HeartbeatService` and schedules `UsageCollectorService` + `UploadWorker`.

## Monitoring
- **Usage data:** `post_usage_batch` upserts daily and hourly aggregates. Verify ingestion via Supabase SQL: `select * from app_usage_daily order by created_at desc limit 20;`.
- **Heartbeat:** Failing requests enqueue `heartbeat_timeout` anomalies. Parent push tokens receive Expo notifications.
- **Realtime alerts:** Parent app listens to Supabase Realtime on `anomaly_events`.

## Incident Response
- If uploads stall, check device permissions (Usage Access, battery optimizations) and the `UploadWorker` job queue.
- For missing alerts, validate Expo tokens in `parent_push_tokens` and check Edge Function logs.
- Use `export_delete` function to service data subject requests. Export response includes raw aggregates; deletion removes all linked records.

## Maintenance
- Rotate `device_api_key` via Supabase SQL (`update kid_devices set device_api_key = encode(gen_random_bytes(16),'hex') where id = ...`).
- Update `category_map.json` in the Android assets for new app categorizations. Ship via app update or remote config service.
- Run lint/tests: `npx expo-doctor`, `./gradlew lint`, and integration tests for Edge Functions using Deno.

## Compliance Notes
- Document parental consent timestamps in `expo-secure-store` (parent app) and Supabase audit logs.
- Keep privacy notice synchronized with jurisdiction-specific requirements before release.
- Store incident reports and deletion confirmations for 24 months for regulatory inquiries.
