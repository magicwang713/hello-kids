import { supabaseAdmin } from "./client.ts";

export async function validateDeviceKey(deviceId: string, apiKey: string) {
  const { data, error } = await supabaseAdmin
    .from("kid_devices")
    .select("id, child_id")
    .eq("device_id", deviceId)
    .eq("device_api_key", apiKey)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  return data;
}
