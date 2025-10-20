// server/functions/create_pairing_token/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { child_id, device_hint } = await req.json().catch(() => ({}));
  if (!child_id) return new Response(JSON.stringify({ error: "child_id required" }), { status: 400 });

  const code = crypto.randomUUID().slice(0, 8).replace(/-/g, "");
  const expire_at = new Date(Date.now() + 1000 * 60 * 15).toISOString(); // 15 min

  const { error } = await supabase.from("pairing_tokens").insert({
    code, child_id, device_hint: device_hint ?? null, expire_at,
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  return new Response(JSON.stringify({ ok: true, code, expire_at }), { headers: { "content-type": "application/json" } });
});
