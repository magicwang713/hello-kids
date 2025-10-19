import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // TODO: Receive message payload and call Expo push API
  return Response.json({ ok: true });
});
