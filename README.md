# Family Guard Monorepo

Family Guard enables caregivers to monitor aggregated app usage on a child’s Android device while respecting privacy-by-design constraints. The monorepo contains three primary surfaces:

- `parent-app/` – Expo (React Native + TypeScript) parent companion.
- `kid-android/` – Native Kotlin child agent with heartbeat, usage collection, and anomaly detection.
- `server/` – Supabase schema and Edge Functions for pairing, ingestion, analytics, and data subject tooling.
- `docs/` – Privacy policy templates, architecture notes, and the operational runbook.

## 1. Environment Variables

Create a `.env` file for the parent app (Expo) with the Supabase project credentials:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

For local Edge Function testing, export the following before running `supabase functions serve`:

```bash
export SUPABASE_URL=https://<project>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
export SUPABASE_ANON_KEY=<anon-key>
```

Android build-time configuration lives in `kid-android/app/build.gradle` (`BuildConfig.BASE_URL`, etc.). Update these constants with your deployed Supabase Function base URL.

## 2. Initialization

1. Install dependencies:
   ```bash
   cd family-guard/parent-app && npm install
   ```
2. Bootstrap Supabase schema and functions:
   ```bash
   cd ../server
   supabase db push --file ./server/schema.sql
   supabase functions deploy register_device
   supabase functions deploy post_usage_batch
   supabase functions deploy post_anomaly
   supabase functions deploy get_dashboard
   supabase functions deploy export_delete
   supabase functions deploy send_expo_push
   ```
3. Configure Supabase Auth email templates for parental consent confirmation.

## 3. Running the Parent App (Expo)

```bash
cd family-guard/parent-app
npx expo start
```

Use the Expo dev client or simulator to log in with Supabase Auth. After authentication you can pair child devices, view dashboards, and manage settings.

## 4. Building & Installing the Kid Android Agent

```bash
cd family-guard/kid-android
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
```

On first launch:
1. Grant Usage Access permission when prompted.
2. (Optional) Enable Device Admin to harden against uninstall.
3. Enter the pairing code provided in the parent app and tap **Bind to parent**.
4. Tap **Start Protection** to begin the heartbeat and usage collectors.

## 5. Supabase Edge Functions

- `register_device`: validates pairing codes, binds devices to child profiles, and issues device-scoped API keys.
- `post_usage_batch`: upserts daily/hourly aggregates using idempotent `onConflict` keys.
- `post_anomaly`: records anomalies and dispatches Expo push notifications to guardians.
- `get_dashboard`: aggregates usage, calculates risk signals, and generates multilingual AI guidance.
- `export_delete`: supports GDPR/PIPL export and hard deletion workflows.
- `send_expo_push`: reserved for dedicated Expo push relays (optional).

All functions expect JSON payloads and return structured responses documented in the server README.

## 6. First-Time Verification Checklist

1. **Pairing flow:** Parent logs in → requests pairing code → child enters code → Supabase `kid_devices` contains new device with API key.
2. **Usage ingestion:** After ~10 minutes, run `select * from app_usage_daily order by created_at desc limit 5;` to confirm data arrival. Dashboard should display total time, night chart, and risk insights.
3. **Offline resilience:** Disable network on child device for 30 minutes; when back online the `UploadWorker` retries and fills gaps.
4. **Permission revocation alert:** Remove Usage Access; within ~10 seconds the parent app shows a realtime anomaly and (if configured) receives an Expo push.
5. **Uninstall attempt:** Long-press and attempt to uninstall the child agent; Device Admin blocks removal and logs an `uninstall_attempt` anomaly.
6. **Night usage simulation:** Change device clock to night hours and open apps; night chart and risk score update accordingly.
7. **Data subject controls:** From the parent settings screen, trigger export/delete and verify the Edge Function responses.
8. **Localization:** Switch device language between English and Simplified Chinese to confirm i18n coverage across screens.

For a detailed operations guide, see `family-guard/docs/RUNBOOK.md`.

## 7. Testing & QA

- **Parent app:** `npx expo-doctor`, `npm run lint`, and manual smoke tests for Auth, pairing, dashboard, settings, and realtime anomalies.
- **Android agent:** `./gradlew lint test` (unit tests can be added around repositories/services). Validate services stay alive under battery optimization rules.
- **Edge Functions:** Use `supabase functions serve <name>` with curl/postman requests covering success and failure paths.

## 8. Privacy & Compliance

Privacy notice templates (English & Simplified Chinese) are available under `family-guard/docs/privacy/`. Update contact details, retention periods, and jurisdiction-specific clauses before production launch. The system is designed to avoid sensitive content capture and excludes advertising identifiers.
