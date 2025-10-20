// server/functions/post_usage_batch/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sha256Hex(s: string) {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const deviceKey = req.headers.get("x-device-key") ?? "";
  const body = await req.json().catch(() => ({}));
  const { device_id, day, apps = [], hours = [] } = body;

  if (!deviceKey || !device_id || !day) {
    return new Response(JSON.stringify({ error: "missing device_key/device_id/day" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const keyHash = await sha256Hex(deviceKey);
  const { data: dev, error: dErr } = await supabase
    .from("kid_devices").select("device_id, api_key_hash").eq("device_id", device_id).single();
  if (dErr || !dev || dev.api_key_hash !== keyHash) {
    return new Response(JSON.stringify({ error: "unauthorized device" }), { status: 401 });
  }

  // Upsert app_usage_daily
  if (apps.length) {
    const rows = apps.map((a: any) => ({
      device_id, day, app_id: a.app_id, category: a.category, minutes: a.minutes ?? 0, launches: a.launches ?? 0
    }));
    const { error } = await supabase.from("app_usage_daily").upsert(rows, { onConflict: "device_id,day,app_id" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Upsert hourly_buckets
  if (hours.length) {
    const rows = hours.map((h: any) => ({
      device_id, day, hour: h.hour, category: h.category, minutes: h.minutes ?? 0
    }));
    const { error } = await supabase.from("hourly_buckets").upsert(rows, { onConflict: "device_id,day,hour,category" });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
