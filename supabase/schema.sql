-- Tech Club Events schema. Safe to rerun; this script does not drop existing data.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  short_description text,
  category text not null default 'Community',
  starts_at timestamptz,
  ends_at timestamptz,
  venue text,
  image_url text,
  image_position text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  registration_open boolean not null default true,
  registration_limit integer check (registration_limit is null or registration_limit > 0),
  submissions_open boolean not null default false,
  submission_deadline timestamptz,
  max_team_size smallint not null default 6 check (max_team_size between 1 and 6),
  submission_rules jsonb not null default '[]'::jsonb,
  google_sheet_id text,
  created_at timestamptz not null default now()
);

alter table public.events add column if not exists short_description text;
alter table public.events add column if not exists category text not null default 'Community';
alter table public.events add column if not exists starts_at timestamptz;
alter table public.events add column if not exists ends_at timestamptz;
alter table public.events add column if not exists venue text;
alter table public.events add column if not exists image_url text;
alter table public.events add column if not exists image_position text;
alter table public.events add column if not exists is_featured boolean not null default false;
alter table public.events add column if not exists registration_open boolean not null default true;
alter table public.events add column if not exists registration_limit integer;
alter table public.events add column if not exists submissions_open boolean not null default false;
alter table public.events add column if not exists submission_deadline timestamptz;
alter table public.events add column if not exists max_team_size smallint not null default 6;
alter table public.events add column if not exists submission_rules jsonb not null default '[]'::jsonb;

create table if not exists public.team_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_name text not null,
  m1_name text not null,
  m1_email text not null,
  m1_phone text not null,
  m1_usn text not null,
  m2_name text,
  m2_email text,
  m2_phone text,
  m2_usn text,
  m3_name text,
  m3_email text,
  m3_phone text,
  m3_usn text,
  m4_name text,
  m4_email text,
  m4_phone text,
  m4_usn text,
  m5_name text,
  m5_email text,
  m5_phone text,
  m5_usn text,
  m6_name text,
  m6_email text,
  m6_phone text,
  m6_usn text,
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_registration_id uuid not null references public.team_registrations(id) on delete cascade,
  github_url text not null,
  live_demo_url text,
  video_pitch_url text,
  submission_notes text,
  created_at timestamptz not null default now()
);

-- Add the final submission fields to an existing table without deleting rows.
alter table public.submissions add column if not exists github_url text;
alter table public.submissions add column if not exists live_demo_url text;
alter table public.submissions add column if not exists video_pitch_url text;
alter table public.submissions add column if not exists submission_notes text;
alter table public.submissions add column if not exists team_registration_id uuid references public.team_registrations(id) on delete cascade;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'submissions'
      and column_name = 'project_url'
  ) then
    execute 'update public.submissions set live_demo_url = coalesce(live_demo_url, project_url)';
  end if;
end
$$;

create index if not exists team_registrations_event_id_idx
  on public.team_registrations(event_id);
create index if not exists submissions_event_id_idx
  on public.submissions(event_id);
create index if not exists submissions_team_registration_id_idx
  on public.submissions(team_registration_id);

alter table public.events enable row level security;
alter table public.team_registrations enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Anyone can read active events" on public.events;
create policy "Anyone can read active events"
  on public.events for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Anyone can register a team for an active event" on public.team_registrations;
create policy "Anyone can register a team for an active event"
  on public.team_registrations for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.events
      where events.id = team_registrations.event_id
        and events.is_active = true
    )
  );

drop policy if exists "Anyone can submit for an active event" on public.submissions;

create or replace function public.can_submit_for_event(
  registration_id uuid,
  target_event_id uuid
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_registrations as registration
    join public.events as event on event.id = registration.event_id
    where registration.id = registration_id
      and registration.event_id = target_event_id
      and event.is_active = true
  );
$$;

revoke all on function public.can_submit_for_event(uuid, uuid) from public;
grant execute on function public.can_submit_for_event(uuid, uuid) to anon, authenticated;

create policy "Anyone can submit for an active event"
  on public.submissions for insert
  to anon, authenticated
  with check (public.can_submit_for_event(team_registration_id, event_id));

-- Enable Supabase Realtime for the event and submission tables when available.
do $$
declare
  target_table text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach target_table in array array['events', 'team_registrations', 'submissions'] loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
        execute format('alter publication supabase_realtime add table public.%I', target_table);
      end if;
    end loop;
  end if;
end
$$;
