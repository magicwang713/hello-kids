import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { supabaseAdmin } from "../_shared/client.ts";
import { validateDeviceKey } from "../_shared/auth.ts";

type UsagePayload = {
  device_id: string;
  day: string;
  apps: { app_id: string; category: string; minutes: number; launches: number }[];
  hours: { hour: number; category: string; minutes: number }[];
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = req.headers.get("X-Device-Key");
  const payload = (await req.json().catch(() => null)) as UsagePayload | null;
  if (!payload || !payload.device_id || !apiKey) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const device = await validateDeviceKey(payload.device_id, apiKey);
  if (!device) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!Array.isArray(payload.apps) || !Array.isArray(payload.hours)) {
    return Response.json({ error: "invalid_format" }, { status: 400 });
  }

  const { error: dailyError } = await supabaseAdmin
    .from("app_usage_daily")
    .upsert(
      payload.apps.map((app) => ({
        device_id: payload.device_id,
        day: payload.day,
        app_id: app.app_id,
        category: app.category,
        minutes: app.minutes,
        launches: app.launches,
      })),
      { onConflict: "device_id,day,app_id" },
    );

  if (dailyError) {
    return Response.json({ error: "daily_upsert_failed" }, { status: 500 });
  }

  const { error: hourlyError } = await supabaseAdmin
    .from("hourly_buckets")
    .upsert(
      payload.hours.map((h) => ({
        device_id: payload.device_id,
        day: payload.day,
        hour: h.hour,
        category: h.category,
        minutes: h.minutes,
      })),
      { onConflict: "device_id,day,hour,category" },
    );

  if (hourlyError) {
    return Response.json({ error: "hourly_upsert_failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
});
