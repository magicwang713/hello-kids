// server/functions/post_anomaly/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sha256Hex(s: string) {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sendExpoPush(token: string, title: string, body: string) {
  const payload = { to: token, title, body, sound: "default", priority: "high" };
  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const deviceKey = req.headers.get("x-device-key") ?? "";
  const { device_id, event_type, detail, occurred_at } = await req.json().catch(() => ({}));
  if (!deviceKey || !device_id || !event_type || !occurred_at) {
    return new Response(JSON.stringify({ error: "missing fields" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const keyHash = await sha256Hex(deviceKey);
  const { data: dev, error: dErr } = await supabase
    .from("kid_devices").select("device_id, child_id, api_key_hash").eq("device_id", device_id).single();
  if (dErr || !dev || dev.api_key_hash !== keyHash) {
    return new Response(JSON.stringify({ error: "unauthorized device" }), { status: 401 });
  }

  // 写入事件
  const { error } = await supabase.from("anomaly_events").insert({
    device_id, event_type, detail, occurred_at
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  // 查询家长推送 token 并推送（可选）
  const { data: child } = await supabase.from("child_profiles").select("parent_uid").eq("id", dev.child_id).single();
  if (child?.parent_uid) {
    const { data: tokens } = await supabase
      .from("parent_push_tokens").select("expo_token").eq("parent_uid", child.parent_uid);
    for (const t of tokens ?? []) {
      // 基本推送文案
      await sendExpoPush(t.expo_token, "设备异常", `检测到 ${event_type}`);
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
