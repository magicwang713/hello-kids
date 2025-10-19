import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { supabaseAdmin } from "../_shared/client.ts";
import { validateDeviceKey } from "../_shared/auth.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = req.headers.get("X-Device-Key");
  const payload = (await req.json().catch(() => null)) as {
    device_id: string;
    event_type: string;
    detail?: Record<string, unknown>;
    occurred_at?: string;
  } | null;

  if (!payload?.device_id || !payload.event_type || !apiKey) {
    return Response.json({ error: "invalid_payload" }, { status: 400 });
  }

  const device = await validateDeviceKey(payload.device_id, apiKey);
  if (!device) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const detail = payload.detail ?? {};
  const occurredAt = payload.occurred_at ?? new Date().toISOString();

  const { error } = await supabaseAdmin.from("anomaly_events").insert({
    device_id: payload.device_id,
    event_type: payload.event_type,
    detail,
    occurred_at: occurredAt,
  });

  if (error) {
    return Response.json({ error: "insert_failed" }, { status: 500 });
  }

  // Push notification fan-out (best-effort)
  const { data: childRow } = await supabaseAdmin
    .from("kid_devices")
    .select("child_id, child_profiles!inner(parent_uid, child_name)")
    .eq("device_id", payload.device_id)
    .maybeSingle();

  if (childRow?.child_profiles?.parent_uid) {
    const parentUid = childRow.child_profiles.parent_uid;
    const { data: tokens } = await supabaseAdmin
      .from("parent_push_tokens")
      .select("expo_token")
      .eq("parent_uid", parentUid);

    if (tokens && tokens.length > 0) {
      await Promise.allSettled(
        tokens.map((token) =>
          fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: token.expo_token,
              title: "Family Guard Alert",
              body: `${payload.event_type} detected`,
              data: { device_id: payload.device_id, event_type: payload.event_type },
            }),
          })
        ),
      );
    }
  }

  return Response.json({ ok: true });
});
