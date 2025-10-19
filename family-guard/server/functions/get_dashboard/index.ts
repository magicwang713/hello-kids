import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.1";
import { supabaseAdmin } from "../_shared/client.ts";
import { calculateRiskScore, generateTips } from "../_shared/rules.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

serve(async (req) => {
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const childId = url.searchParams.get("child_id");
  const rangeParam = url.searchParams.get("range") ?? "7d";
  const rangeDays = rangeParam === "30d" ? 30 : 7;

  if (!childId) {
    return Response.json({ error: "missing_child" }, { status: 400 });
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
    .select("id, child_name")
    .eq("id", childId)
    .eq("parent_uid", user.user.id)
    .maybeSingle();

  if (childError || !child) {
    return Response.json({ error: "child_not_found" }, { status: 404 });
  }

  const { data: devices } = await supabaseAdmin
    .from("kid_devices")
    .select("device_id")
    .eq("child_id", childId);

  const deviceIds = devices?.map((d) => d.device_id) ?? [];
  if (deviceIds.length === 0) {
    return Response.json({
      summary: { total_minutes: 0, night_minutes: 0 },
      top_apps: [],
      by_day: [],
      night_series: [],
      risk_score: 0,
      top_signals: [],
      tips: generateTips(0, [], child.child_name),
    });
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - rangeDays + 1);

  const prevStart = new Date(startDate);
  prevStart.setDate(startDate.getDate() - rangeDays);
  const prevEnd = new Date(startDate);
  prevEnd.setDate(startDate.getDate() - 1);

  const { data: usageRows } = await supabaseAdmin
    .from("app_usage_daily")
    .select("device_id, day, app_id, category, minutes, launches")
    .in("device_id", deviceIds)
    .gte("day", startDate.toISOString().slice(0, 10))
    .lte("day", endDate.toISOString().slice(0, 10));

  const { data: hourlyRows } = await supabaseAdmin
    .from("hourly_buckets")
    .select("device_id, day, hour, category, minutes")
    .in("device_id", deviceIds)
    .gte("day", startDate.toISOString().slice(0, 10))
    .lte("day", endDate.toISOString().slice(0, 10));

  const { data: prevHourlyRows } = await supabaseAdmin
    .from("hourly_buckets")
    .select("device_id, day, hour, category, minutes")
    .in("device_id", deviceIds)
    .gte("day", prevStart.toISOString().slice(0, 10))
    .lte("day", prevEnd.toISOString().slice(0, 10));

  const { data: prevUsageRows } = await supabaseAdmin
    .from("app_usage_daily")
    .select("device_id, day, category, minutes")
    .in("device_id", deviceIds)
    .gte("day", prevStart.toISOString().slice(0, 10))
    .lte("day", prevEnd.toISOString().slice(0, 10));

  const totalMinutes = usageRows?.reduce((sum, row) => sum + row.minutes, 0) ?? 0;

  const byDayMap = new Map<string, number>();
  const appMap = new Map<string, { category: string; minutes: number; launches: number }>();
  usageRows?.forEach((row) => {
    byDayMap.set(row.day, (byDayMap.get(row.day) ?? 0) + row.minutes);
    const existing = appMap.get(row.app_id) ?? { category: row.category, minutes: 0, launches: 0 };
    existing.minutes += row.minutes;
    existing.launches += row.launches;
    appMap.set(row.app_id, existing);
  });

  const nightSeriesMap = new Map<string, { minutes_21_23: number; minutes_23_07: number }>();
  let nightMinutes = 0;
  hourlyRows?.forEach((row) => {
    const entry = nightSeriesMap.get(row.day) ?? { minutes_21_23: 0, minutes_23_07: 0 };
    if (row.hour >= 21) {
      entry.minutes_21_23 += row.minutes;
      nightMinutes += row.minutes;
    } else if (row.hour < 7) {
      entry.minutes_23_07 += row.minutes;
      nightMinutes += row.minutes;
    }
    nightSeriesMap.set(row.day, entry);
  });

  const shortVideoMinutes = usageRows?.filter((row) => row.category === "short_video").reduce((sum, row) => sum + row.minutes, 0) ?? 0;
  const prevShort = prevUsageRows?.filter((row) => row.category === "short_video").reduce((sum, row) => sum + row.minutes, 0) ?? 0;
  const prevTotal = prevUsageRows?.reduce((sum, row) => sum + row.minutes, 0) ?? 0;
  const currentShortRatio = totalMinutes > 0 ? shortVideoMinutes / totalMinutes : 0;
  const prevShortRatio = prevTotal > 0 ? prevShort / prevTotal : 0;
  const shortVideoRatioWoW = currentShortRatio - prevShortRatio;

  const lastThreeGame = usageRows
    ?.filter((row) => row.category === "game")
    .sort((a, b) => (a.day > b.day ? -1 : 1))
    .slice(0, 3)
    .reduce((sum, row) => sum + row.minutes, 0) ?? 0;
  const gameMinutesAvg = lastThreeGame / 3;

  const prevNightTotal = prevHourlyRows?.reduce((sum, row) => {
    if (row.hour >= 21 || row.hour < 7) {
      return sum + row.minutes;
    }
    return sum;
  }, 0) ?? 0;
  const nightDeltaPercent = prevNightTotal > 0 ? (nightMinutes - prevNightTotal) / prevNightTotal : 0;

  const risk = calculateRiskScore({
    total_minutes: totalMinutes,
    night_minutes: nightMinutes,
    short_video_ratio_wow: shortVideoRatioWoW,
    game_minutes_3days_avg: gameMinutesAvg,
    night_delta_percent: nightDeltaPercent,
  });

  const response = {
    summary: { total_minutes: totalMinutes, night_minutes: nightMinutes },
    top_apps: Array.from(appMap.entries())
      .sort((a, b) => b[1].minutes - a[1].minutes)
      .slice(0, 5)
      .map(([appId, stats]) => ({ app_id: appId, category: stats.category, minutes: stats.minutes, launches: stats.launches })),
    by_day: Array.from(byDayMap.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([day, minutes]) => ({ day, minutes })),
    night_series: Array.from(nightSeriesMap.entries())
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([day, values]) => ({ day, ...values })),
    risk_score: risk.score,
    top_signals: risk.signals,
    tips: generateTips(risk.score, risk.signals, child.child_name),
  };

  return Response.json(response);
});
