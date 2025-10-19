-- Supabase schema for Family Guard

-- 用户采用 Supabase Auth (parents)，children 不单独登录，通过配对码绑定设备

create extension if not exists "pgcrypto";

create table if not exists public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  parent_uid uuid not null,
  child_name text not null,
  tz text not null,
  locale text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.kid_devices (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  device_id text not null,
  device_api_key text not null default encode(gen_random_bytes(16), 'hex'),
  model text,
  os_version text,
  created_at timestamptz not null default now(),
  unique(child_id, device_id)
);

create table if not exists public.pairing_tokens (
  code text primary key,
  parent_uid uuid not null,
  device_id text,
  child_id uuid references public.child_profiles(id) on delete cascade,
  expire_at timestamptz not null
);

create table if not exists public.app_usage_daily (
  id bigserial primary key,
  device_id text not null,
  day date not null,
  app_id text not null,
  category text not null,
  minutes integer not null default 0,
  launches integer not null default 0,
  created_at timestamptz not null default now(),
  unique(device_id, day, app_id)
);
create index if not exists app_usage_daily_device_day_idx on public.app_usage_daily (device_id, day);
create index if not exists app_usage_daily_day_category_idx on public.app_usage_daily (day, category);

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
create index if not exists hourly_buckets_device_day_idx on public.hourly_buckets (device_id, day);

create table if not exists public.anomaly_events (
  id bigserial primary key,
  device_id text not null,
  event_type text not null,
  detail jsonb,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists anomaly_events_device_created_idx on public.anomaly_events (device_id, created_at);

create table if not exists public.parent_push_tokens (
  parent_uid uuid not null,
  expo_token text not null,
  created_at timestamptz not null default now(),
  unique(parent_uid, expo_token)
);
