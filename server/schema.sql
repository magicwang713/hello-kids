-- server/schema.sql
-- Extensions
create extension if not exists pgcrypto;

-- 家长下的孩子档案
create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_uid uuid not null,          -- supabase auth.user().id
  child_name text not null,
  tz text not null,
  locale text not null default 'system',
  created_at timestamptz not null default now()
);

-- 孩子设备
create table if not exists public.kid_devices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  device_id text not null,           -- 自定义安装ID（不要用 IMEI/IMSI 等硬件标识）
  model text,
  os_version text,
  api_key_hash text,                 -- 设备上报用的密钥哈希
  created_at timestamptz not null default now(),
  unique(child_id, device_id)
);

-- 绑定配对码（家长端或孩子端生成都可以）
create table if not exists public.pairing_tokens (
  code text primary key,             -- 短码/二维码
  device_hint text,                  -- 可选：显示给家长的设备备注
  child_id uuid,                     -- 若家长预先创建孩子，可带上；否则首次注册时创建
  expire_at timestamptz not null
);

-- 日聚合（按 app）
create table if not exists public.app_usage_daily (
  id bigserial primary key,
  device_id text not null,
  day date not null,
  app_id text not null,              -- 包名（Android）
  category text not null,            -- short_video/game/study/tool/other
  minutes integer not null default 0,
  launches integer not null default 0,
  created_at timestamptz not null default now(),
  unique(device_id, day, app_id)
);
create index if not exists idx_app_usage_daily_device_day on public.app_usage_daily (device_id, day);
create index if not exists idx_app_usage_daily_day_cat on public.app_usage_daily (day, category);

-- 小时桶（0-23）
create table if not exists public.hourly_buckets (
  id bigserial primary key,
  device_id text not null,
  day date not null,
  hour smallint not null check (hour between 0 and 23),
  category text not null,
  minutes integer not null default 0,
  created_at timestamptz not null default now(),
  unique(device_id, day, hour, category)
);
create index if not exists idx_hourly_buckets_device_day on public.hourly_buckets (device_id, day);

-- 异常事件
create table if not exists public.anomaly_events (
  id bigserial primary key,
  device_id text not null,
  event_type text not null,          -- perm_revoked|uninstall_attempt|heartbeat_timeout|dns_changed|boot|app_killed
  detail jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_anomaly_events_device on public.anomaly_events (device_id, created_at desc);

-- 家长推送 token（Expo）
create table if not exists public.parent_push_tokens (
  parent_uid uuid not null,
  expo_token text not null,
  created_at timestamptz not null default now(),
  unique(parent_uid, expo_token)
);

-- 可选：开启 RLS（我们走 Edge Functions 的 service role 访问，RLS 先开但不放通用策略）
alter table public.child_profiles enable row level security;
alter table public.kid_devices enable row level security;
alter table public.pairing_tokens enable row level security;
alter table public.app_usage_daily enable row level security;
alter table public.hourly_buckets enable row level security;
alter table public.anomaly_events enable row level security;
alter table public.parent_push_tokens enable row level security;
