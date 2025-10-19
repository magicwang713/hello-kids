import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { supabaseAdmin } from "../_shared/client.ts";

type RegisterBody = {
  pairing_code: string;
  device_id?: string;
  child_name?: string;
  tz?: string;
  locale?: string;
  model?: string;
  os_version?: string;
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const body = (await req.json().catch(() => null)) as RegisterBody | null;
  if (!body?.pairing_code) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { data: token, error: tokenError } = await supabaseAdmin
    .from("pairing_tokens")
    .select("code, parent_uid, child_id, device_id, expire_at")
    .eq("code", body.pairing_code)
    .maybeSingle();

  if (tokenError || !token) {
    return Response.json({ error: "pairing_not_found" }, { status: 404 });
  }
  if (new Date(token.expire_at).getTime() < Date.now()) {
    return Response.json({ error: "pairing_expired" }, { status: 410 });
  }

  let childId = token.child_id as string | null;
  if (!childId) {
    if (!body.child_name || !body.tz) {
      return Response.json({ error: "child_missing" }, { status: 400 });
    }
    const { data: child, error: childError } = await supabaseAdmin
      .from("child_profiles")
      .insert({
        parent_uid: token.parent_uid,
        child_name: body.child_name,
        tz: body.tz,
        locale: body.locale ?? "system",
      })
      .select("id")
      .single();
    if (childError || !child) {
      return Response.json({ error: "child_create_failed" }, { status: 500 });
    }
    childId = child.id;
  }

  const deviceId = body.device_id ?? crypto.randomUUID();

  const { data: existing } = await supabaseAdmin
    .from("kid_devices")
    .select("id, device_api_key")
    .eq("child_id", childId)
    .eq("device_id", deviceId)
    .maybeSingle();

  let deviceKey: string;
  if (existing) {
    deviceKey = existing.device_api_key;
  } else {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("kid_devices")
      .insert({
        child_id: childId,
        device_id: deviceId,
        model: body.model,
        os_version: body.os_version,
      })
      .select("device_api_key")
      .single();
    if (insertError || !inserted) {
      return Response.json({ error: "device_bind_failed" }, { status: 500 });
    }
    deviceKey = inserted.device_api_key;
  }

  await supabaseAdmin.from("pairing_tokens").delete().eq("code", body.pairing_code);

  return Response.json({ ok: true, device_id: deviceId, child_id: childId, device_key: deviceKey });
});
