-- SkyQuest Web Push persistence
-- Run this file once in the Supabase SQL Editor.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),

  endpoint text not null unique,
  p256dh text not null,
  auth text not null,

  enabled boolean not null default true,
  topics jsonb not null default '["clear_sky_evening", "moon_visible", "planet_visible", "celestial_event"]'::jsonb,

  timezone text,
  latitude_rounded numeric(5, 1),
  longitude_rounded numeric(5, 1),

  user_agent_hash text,

  last_seen_at timestamptz not null default now(),
  last_notification_sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_subscriptions_topics_array_check
    check (jsonb_typeof(topics) = 'array'),
  constraint push_subscriptions_latitude_check
    check (latitude_rounded is null or latitude_rounded between -90 and 90),
  constraint push_subscriptions_longitude_check
    check (longitude_rounded is null or longitude_rounded between -180 and 180)
);

alter table public.push_subscriptions enable row level security;

-- No anon/authenticated policy is intentionally created. The browser never accesses this table.
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

create index if not exists push_subscriptions_enabled_idx
  on public.push_subscriptions (enabled);

create index if not exists push_subscriptions_last_notification_idx
  on public.push_subscriptions (last_notification_sent_at);

create index if not exists push_subscriptions_location_idx
  on public.push_subscriptions (latitude_rounded, longitude_rounded);

-- Atomically reserves the current UTC hour. This prevents overlapping cron runs
-- from sending two notifications to the same subscription during the same hour.
create or replace function public.claim_push_notification_slot(
  p_endpoint text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed boolean;
begin
  update public.push_subscriptions
  set
    last_notification_sent_at = p_now,
    updated_at = p_now
  where endpoint = p_endpoint
    and enabled = true
    and (
      last_notification_sent_at is null
      or last_notification_sent_at < date_trunc('hour', p_now)
    )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_push_notification_slot(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_push_notification_slot(text, timestamptz)
  to service_role;

comment on table public.push_subscriptions is
  'Server-only SkyQuest Web Push subscriptions. Accessed with the Supabase service role.';
