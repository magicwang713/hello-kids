// server/functions/register_device/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sha256Hex(s: string) {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { pairing_code, device_id, model, os_version } = await req.json().catch(() => ({}));
  if (!pairing_code || !device_id) {
    return new Response(JSON.stringify({ error: "pairing_code & device_id required" }), { status: 400 });
  }

  // 查 pairing
  const { data: token, error: tErr } = await supabase
    .from("pairing_tokens").select("*").eq("code", pairing_code).single();

  if (tErr || !token) return new Response(JSON.stringify({ error: "invalid code" }), { status: 400 });
  if (new Date(token.expire_at).getTime() < Date.now()) {
    return new Response(JSON.stringify({ error: "code expired" }), { status: 400 });
  }
  const child_id = token.child_id;
  if (!child_id) return new Response(JSON.stringify({ error: "child_id missing in token" }), { status: 400 });

  // 生成设备 API key
  const apiKey = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const apiKeyHash = await sha256Hex(apiKey);

  // upsert 设备
  const { data: dev, error: dErr } = await supabase
    .from("kid_devices")
    .upsert({
      child_id, device_id, model: model ?? null, os_version: os_version ?? null, api_key_hash: apiKeyHash
    }, { onConflict: "child_id,device_id" })
    .select("id, child_id, device_id").single();

  if (dErr || !dev) return new Response(JSON.stringify({ error: dErr?.message ?? "upsert failed" }), { status: 500 });

  // 用完即删配对码
  await supabase.from("pairing_tokens").delete().eq("code", pairing_code);

  return new Response(JSON.stringify({ ok: true, device_id: dev.device_id, child_id, device_api_key: apiKey }), {
    headers: { "content-type": "application/json" }
  });
});
