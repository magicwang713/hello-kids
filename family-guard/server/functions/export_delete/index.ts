import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import { supabaseAdmin } from "../_shared/client.ts";

type Payload = {
  child_id: string;
  action: "export" | "delete";
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const payload = (await req.json().catch(() => null)) as Payload | null;
  if (!payload?.child_id || !payload.action) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: user, error: userError } = await supabase.auth.getUser();
  if (userError || !user.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: child, error: childError } = await supabaseAdmin
    .from("child_profiles")
    .select("id")
    .eq("id", payload.child_id)
    .eq("parent_uid", user.user.id)
    .maybeSingle();

  if (childError || !child) {
    return Response.json({ error: "child_not_found" }, { status: 404 });
  }

  const { data: devices } = await supabaseAdmin
    .from("kid_devices")
    .select("device_id")
    .eq("child_id", payload.child_id);

  const deviceIds = devices?.map((d) => d.device_id) ?? [];

  if (payload.action === "export") {
    if (deviceIds.length === 0) {
      return Response.json({ export: { app_usage_daily: [], hourly_buckets: [], anomaly_events: [] } });
    }
    const [{ data: daily }, { data: hourly }, { data: anomalies }] = await Promise.all([
      supabaseAdmin
        .from("app_usage_daily")
        .select("device_id, day, app_id, category, minutes, launches")
        .in("device_id", deviceIds),
      supabaseAdmin
        .from("hourly_buckets")
        .select("device_id, day, hour, category, minutes")
        .in("device_id", deviceIds),
      supabaseAdmin
        .from("anomaly_events")
        .select("device_id, event_type, detail, occurred_at")
        .in("device_id", deviceIds),
    ]);
    return Response.json({
      export: {
        app_usage_daily: daily ?? [],
        hourly_buckets: hourly ?? [],
        anomaly_events: anomalies ?? [],
      },
    });
  }

  if (payload.action === "delete") {
    if (deviceIds.length > 0) {
      await Promise.all([
        supabaseAdmin.from("app_usage_daily").delete().in("device_id", deviceIds),
        supabaseAdmin.from("hourly_buckets").delete().in("device_id", deviceIds),
        supabaseAdmin.from("anomaly_events").delete().in("device_id", deviceIds),
      ]);
    }
    return Response.json({ ok: true, deleted: true });
  }

  return Response.json({ error: "unsupported" }, { status: 400 });
});
