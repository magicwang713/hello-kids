// server/functions/get_dashboard/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function scoreAndTips(summary: any) {
  // 简单示例：仅根据夜间分钟和短视频占比打分
  let score = 0;
  const signals: string[] = [];
  if ((summary?.night_minutes ?? 0) >= 30) { score += 25; signals.push("夜间≥30分钟"); }
  if ((summary?.short_video_ratio ?? 0) >= 0.35) { score += 20; signals.push(`短视频占比 ${(summary.short_video_ratio*100).toFixed(0)}%`); }
  const tips = {
    strong: "今晚按约定时间准时收机，如需延时先完成指定离屏任务。",
    neutral: "和孩子聊聊今天看的内容，约定明天的时段与时长。",
    gentle: "先肯定今天的自控，再一起选个离屏活动替代睡前刷屏。",
    why: signals.join("，")
  };
  return { risk_score: Math.min(100, score), top_signals: signals, tips };
}

serve(async (req) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const url = new URL(req.url);
  const child_id = url.searchParams.get("child_id");
  const range = url.searchParams.get("range") ?? "7d";
  if (!child_id) return new Response(JSON.stringify({ error: "child_id required" }), { status: 400 });

  // 这里用 service role 简化，前端必须带上家长登录态才能拿 child_id
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const days = range === "30d" ? 30 : 7;

  // 找到该 child 的设备列表
  const { data: devs, error: dErr } = await supabase
    .from("kid_devices").select("device_id").eq("child_id", child_id);
  if (dErr) return new Response(JSON.stringify({ error: dErr.message }), { status: 500 });
  const deviceIds = (devs ?? []).map(d => d.device_id);
  if (!deviceIds.length) return new Response(JSON.stringify({
    summary: { total_minutes: 0, night_minutes: 0, short_video_ratio: 0 },
    top_apps: [], by_day: [], night_series: [], ...scoreAndTips({ night_minutes: 0, short_video_ratio: 0 })
  }), { headers: { "content-type": "application/json" } });

  // 近 N 天汇总
  const { data: byDay } = await supabase.rpc("get_usage_by_day", { device_ids: deviceIds, days });
  // 如果没有 RPC，你也可以直接用 select 聚合。为简化，这里直接用 select：
  const since = new Date(Date.now() - days*24*3600*1000);
  const sinceDay = since.toISOString().slice(0,10);

  const { data: daily } = await supabase
    .from("app_usage_daily")
    .select("day, minutes, category, app_id")
    .in("device_id", deviceIds)
    .gte("day", sinceDay);

  const { data: hourly } = await supabase
    .from("hourly_buckets")
    .select("day, hour, minutes, category")
    .in("device_id", deviceIds)
    .gte("day", sinceDay);

  // 聚合
  const mapDayTotal = new Map<string, number>();
  const mapApp = new Map<string, { minutes: number, launches: number, category: string }>();
  let total = 0, shortVideo = 0, night = 0;

  for (const r of daily ?? []) {
    total += r.minutes;
    if (r.category === "short_video") shortVideo += r.minutes;
    const k = r.app_id;
    const cur = mapApp.get(k) ?? { minutes: 0, launches: 0, category: r.category };
    cur.minutes += r.minutes;
    mapApp.set(k, cur);
    mapDayTotal.set(r.day, (mapDayTotal.get(r.day) ?? 0) + r.minutes);
  }
  for (const h of hourly ?? []) {
    if (h.hour >= 21 || h.hour < 7) night += h.minutes;
  }

  const by_day = Array.from(mapDayTotal.entries()).sort((a,b)=>a[0]>b[0]?1:-1)
      .map(([day, minutes]) => ({ day, minutes }));
  const top_apps = Array.from(mapApp.entries())
      .sort((a,b)=>b[1].minutes - a[1].minutes)
      .slice(0,5)
      .map(([app_id, v]) => ({ app_id, category: v.category, minutes: v.minutes }));

  const summary = {
    total_minutes: total,
    night_minutes: night,
    short_video_ratio: total ? (shortVideo/total) : 0
  };
  const night_series = []; // 可按需补：把 hourly 聚成 21-23 / 23-07 两段

  const scored = scoreAndTips(summary);
  return new Response(JSON.stringify({
    summary, top_apps, by_day, night_series, ...scored
  }), { headers: { "content-type": "application/json" } });
});
