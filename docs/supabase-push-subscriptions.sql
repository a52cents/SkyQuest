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
  last_test_notification_sent_at timestamptz,

  reminder_at timestamptz,
  reminder_window_starts_at timestamptz,
  reminder_window_ends_at timestamptz,
  reminder_target text,
  reminder_score smallint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint push_subscriptions_topics_array_check
    check (jsonb_typeof(topics) = 'array'),
  constraint push_subscriptions_latitude_check
    check (latitude_rounded is null or latitude_rounded between -90 and 90),
  constraint push_subscriptions_longitude_check
    check (longitude_rounded is null or longitude_rounded between -180 and 180),
  constraint push_subscriptions_reminder_score_check
    check (reminder_score is null or reminder_score between 0 and 100)
);

-- Safe to run again on an existing installation.
alter table public.push_subscriptions
  add column if not exists reminder_at timestamptz,
  add column if not exists reminder_window_starts_at timestamptz,
  add column if not exists reminder_window_ends_at timestamptz,
  add column if not exists reminder_target text,
  add column if not exists reminder_score smallint,
  add column if not exists last_test_notification_sent_at timestamptz;

alter table public.push_subscriptions enable row level security;

-- No anon/authenticated policy is intentionally created. The browser never accesses this table.
revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to service_role;

create table if not exists public.push_notification_claims (
  subscription_id uuid not null
    references public.push_subscriptions(id)
    on delete cascade,
  dedupe_key text not null,
  claimed_at timestamptz not null default now(),

  primary key (subscription_id, dedupe_key),
  constraint push_notification_claims_dedupe_key_length_check
    check (char_length(dedupe_key) between 1 and 200)
);

alter table public.push_notification_claims enable row level security;
revoke all on table public.push_notification_claims from public, anon, authenticated;
grant select, insert, update, delete on table public.push_notification_claims to service_role;

create index if not exists push_subscriptions_enabled_idx
  on public.push_subscriptions (enabled);

create index if not exists push_subscriptions_last_notification_idx
  on public.push_subscriptions (last_notification_sent_at);

create index if not exists push_subscriptions_location_idx
  on public.push_subscriptions (latitude_rounded, longitude_rounded);

create index if not exists push_subscriptions_reminder_idx
  on public.push_subscriptions (reminder_at)
  where enabled = true and reminder_at is not null;

create index if not exists push_notification_claims_claimed_at_idx
  on public.push_notification_claims (claimed_at);

-- Remove the old hourly boolean overload before installing the explicit 12-hour claim result.
drop function if exists public.claim_push_notification_slot(text, timestamptz);

-- Atomically enforces both the editorial cooldown and per-opportunity deduplication.
create or replace function public.claim_push_notification_slot(
  p_endpoint text,
  p_dedupe_key text,
  p_now timestamptz default now()
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_subscription_id uuid;
  v_last_notification_sent_at timestamptz;
begin
  if p_dedupe_key is null or char_length(p_dedupe_key) not between 1 and 200 then
    raise exception 'Invalid push dedupe key';
  end if;

  select id, last_notification_sent_at
  into v_subscription_id, v_last_notification_sent_at
  from public.push_subscriptions
  where endpoint = p_endpoint
    and enabled = true
  for update;

  if not found then
    return 'disabled';
  end if;

  if v_last_notification_sent_at is not null
    and v_last_notification_sent_at > p_now - interval '12 hours' then
    return 'cooldown';
  end if;

  if exists (
    select 1
    from public.push_notification_claims
    where subscription_id = v_subscription_id
      and dedupe_key = p_dedupe_key
  ) then
    return 'duplicate';
  end if;

  insert into public.push_notification_claims (subscription_id, dedupe_key, claimed_at)
  values (v_subscription_id, p_dedupe_key, p_now);

  update public.push_subscriptions
  set last_notification_sent_at = p_now,
      updated_at = p_now
  where id = v_subscription_id;

  return 'claimed';
end;
$$;

revoke all on function public.claim_push_notification_slot(text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_push_notification_slot(text, text, timestamptz)
  to service_role;

-- Test notifications have a separate one-hour limiter and never consume editorial cooldown.
create or replace function public.claim_push_test_slot(
  p_endpoint text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_claimed boolean;
begin
  update public.push_subscriptions
  set last_test_notification_sent_at = p_now,
      updated_at = p_now
  where endpoint = p_endpoint
    and enabled = true
    and (
      last_test_notification_sent_at is null
      or last_test_notification_sent_at <= p_now - interval '1 hour'
    )
  returning true into v_claimed;

  return coalesce(v_claimed, false);
end;
$$;

revoke all on function public.claim_push_test_slot(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_push_test_slot(text, timestamptz)
  to service_role;

-- Claims and clears one intentional reminder atomically. Clearing it here makes
-- reminders one-shot even when two scheduler invocations overlap.
create or replace function public.claim_due_sky_window_reminder(
  p_endpoint text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_subscription_id uuid;
  v_window_starts_at timestamptz;
  v_dedupe_key text;
  v_inserted integer;
begin
  select id, reminder_window_starts_at
  into v_subscription_id, v_window_starts_at
  from public.push_subscriptions
  where endpoint = p_endpoint
    and enabled = true
    and reminder_at is not null
    and reminder_at <= p_now
    and reminder_window_ends_at >= p_now
  for update;

  if not found then
    return false;
  end if;

  v_dedupe_key := 'reminder:' || coalesce(
    to_char(v_window_starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'unknown'
  );

  insert into public.push_notification_claims (subscription_id, dedupe_key, claimed_at)
  values (v_subscription_id, v_dedupe_key, p_now)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  update public.push_subscriptions
  set
    reminder_at = null,
    reminder_window_starts_at = null,
    reminder_window_ends_at = null,
    reminder_target = null,
    reminder_score = null,
    last_notification_sent_at = case when v_inserted = 1 then p_now else last_notification_sent_at end,
    updated_at = p_now
  where id = v_subscription_id;

  return v_inserted = 1;
end;
$$;

revoke all on function public.claim_due_sky_window_reminder(text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_due_sky_window_reminder(text, timestamptz)
  to service_role;

create or replace function public.cleanup_expired_sky_window_reminders(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cleaned integer;
begin
  update public.push_subscriptions
  set reminder_at = null,
      reminder_window_starts_at = null,
      reminder_window_ends_at = null,
      reminder_target = null,
      reminder_score = null,
      updated_at = p_now
  where reminder_window_ends_at < p_now
    or (reminder_at is not null and reminder_window_ends_at is null);

  get diagnostics v_cleaned = row_count;
  return v_cleaned;
end;
$$;

revoke all on function public.cleanup_expired_sky_window_reminders(timestamptz)
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_sky_window_reminders(timestamptz)
  to service_role;

comment on table public.push_subscriptions is
  'Server-only SkyQuest Web Push subscriptions. Accessed with the Supabase service role.';

-- One-shot reminders explicitly requested for one known target. No journal or atlas
-- state is stored here: only the chosen target and the subscription's existing coarse area.
create table if not exists public.push_target_watches (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  target text not null,
  target_type text not null,
  reason text not null,
  minimum_score smallint not null default 60,
  expires_at timestamptz not null,
  enabled boolean not null default true,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint push_target_watches_target_length_check check (char_length(target) between 1 and 100),
  constraint push_target_watches_target_type_length_check check (char_length(target_type) between 1 and 40),
  constraint push_target_watches_reason_check check (reason in ('missed_retry', 'collection_gap')),
  constraint push_target_watches_minimum_score_check check (minimum_score between 50 and 100),
  constraint push_target_watches_expiration_check check (expires_at > created_at)
);

alter table public.push_target_watches enable row level security;
revoke all on table public.push_target_watches from public, anon, authenticated;
grant select, insert, update, delete on table public.push_target_watches to service_role;

create index if not exists push_target_watches_active_idx
  on public.push_target_watches (expires_at, subscription_id)
  where enabled = true;

create unique index if not exists push_target_watches_one_active_target_idx
  on public.push_target_watches (subscription_id, target)
  where enabled = true;

create or replace function public.create_target_watch(
  p_endpoint text,
  p_target text,
  p_target_type text,
  p_reason text,
  p_minimum_score smallint default 60,
  p_now timestamptz default now()
)
returns setof public.push_target_watches
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_subscription_id uuid;
begin
  if p_reason not in ('missed_retry', 'collection_gap')
    or char_length(p_target) not between 1 and 100
    or char_length(p_target_type) not between 1 and 40
    or p_minimum_score not between 50 and 100 then
    raise exception 'invalid_target_watch';
  end if;

  select id into v_subscription_id
  from public.push_subscriptions
  where endpoint = p_endpoint
    and enabled = true
    and latitude_rounded is not null
    and longitude_rounded is not null
  for update;

  if not found then
    raise exception 'target_watch_subscription_unavailable';
  end if;

  update public.push_target_watches
  set enabled = false
  where subscription_id = v_subscription_id
    and enabled = true
    and expires_at <= p_now;

  return query
  select *
  from public.push_target_watches
  where subscription_id = v_subscription_id
    and lower(target) = lower(p_target)
    and enabled = true
    and expires_at > p_now
  limit 1;
  if found then
    return;
  end if;

  if (
    select count(*)
    from public.push_target_watches
    where subscription_id = v_subscription_id
      and enabled = true
      and expires_at > p_now
  ) >= 3 then
    raise exception 'target_watch_limit';
  end if;

  return query
  insert into public.push_target_watches (
    subscription_id, target, target_type, reason, minimum_score, expires_at
  ) values (
    v_subscription_id,
    p_target,
    p_target_type,
    p_reason,
    p_minimum_score,
    p_now + interval '14 days'
  )
  returning *;
end;
$$;

revoke all on function public.create_target_watch(text, text, text, text, smallint, timestamptz)
  from public, anon, authenticated;
grant execute on function public.create_target_watch(text, text, text, text, smallint, timestamptz)
  to service_role;

create or replace function public.claim_target_watch(
  p_watch_id uuid,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_subscription_id uuid;
  v_inserted integer;
begin
  select subscription_id into v_subscription_id
  from public.push_target_watches
  where id = p_watch_id
    and enabled = true
    and claimed_at is null
    and expires_at > p_now
  for update;

  if not found then
    return false;
  end if;

  insert into public.push_notification_claims (subscription_id, dedupe_key, claimed_at)
  values (v_subscription_id, 'target_watch:' || p_watch_id::text, p_now)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return false;
  end if;

  update public.push_target_watches
  set enabled = false, claimed_at = p_now
  where id = p_watch_id;

  return true;
end;
$$;

revoke all on function public.claim_target_watch(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_target_watch(uuid, timestamptz) to service_role;

create or replace function public.cleanup_expired_target_watches(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cleaned integer;
begin
  update public.push_target_watches
  set enabled = false
  where enabled = true and expires_at <= p_now;
  get diagnostics v_cleaned = row_count;
  return v_cleaned;
end;
$$;

revoke all on function public.cleanup_expired_target_watches(timestamptz)
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_target_watches(timestamptz) to service_role;

comment on table public.push_target_watches is
  'One-shot target reminders explicitly requested by a device; contains no journal or progression data.';
