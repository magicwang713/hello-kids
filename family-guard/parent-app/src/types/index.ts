export type ChildProfile = {
  id: string;
  child_name: string;
  tz: string;
  locale: string;
};

export type DashboardSummary = {
  total_minutes: number;
  night_minutes: number;
};

export type DashboardTopApp = {
  app_id: string;
  category: string;
  minutes: number;
  launches: number;
};

export type DashboardDay = {
  day: string;
  minutes: number;
};

export type DashboardNightPoint = {
  day: string;
  minutes_21_23: number;
  minutes_23_07: number;
};

export type TipsPayload = {
  strong: string;
  neutral: string;
  gentle: string;
  why: string;
};

export type DashboardData = {
  summary: DashboardSummary;
  top_apps: DashboardTopApp[];
  by_day: DashboardDay[];
  night_series: DashboardNightPoint[];
  risk_score: number;
  top_signals: string[];
  tips: TipsPayload;
};

export type AnomalyEvent = {
  id: number;
  device_id: string;
  event_type: string;
  detail: Record<string, unknown> | null;
  occurred_at: string;
};

export type RangeOption = "7d" | "30d";
