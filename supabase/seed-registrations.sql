-- Synthetic data for testing events, registrations, and submissions.
-- PostgreSQL generates all IDs. The statements link rows using event titles,
-- start times, and team names, and skip matching rows when rerun.
-- For Sheets sync, run seed.sql and create event sheets before this file.

insert into public.events (
  title,
  description,
  short_description,
  category,
  starts_at,
  ends_at,
  venue,
  image_url,
  is_featured,
  is_active,
  registration_open,
  registration_limit,
  submissions_open,
  submission_deadline,
  max_team_size,
  submission_rules
)
select
  seed.title,
  seed.description,
  seed.short_description,
  seed.category,
  seed.starts_at,
  seed.ends_at,
  seed.venue,
  seed.image_url,
  seed.is_featured,
  true,
  true,
  seed.registration_limit,
  seed.submissions_open,
  seed.submission_deadline,
  seed.max_team_size,
  seed.submission_rules
from (
  values
    (
      'Test Build Night'::text,
      'Synthetic event for checking registration, submissions, and Google Sheets integration.'::text,
      'A sample event for testing the full flow.'::text,
      'Hackathon'::text,
      '2026-10-18 18:00:00+05:30'::timestamptz,
      '2026-10-19 18:00:00+05:30'::timestamptz,
      'Test Innovation Lab'::text,
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1400&q=85'::text,
      true,
      24,
      true,
      '2026-10-19 15:00:00+05:30'::timestamptz,
      6,
      '["Submit a project repository link.", "Include a live demo and a short video pitch."]'::jsonb
    ),
    (
      'Test Design Workshop',
      'Synthetic workshop event for checking event listing and category filters.',
      'A sample workshop for testing the event dashboard.',
      'Workshop',
      '2026-10-22 16:30:00+05:30'::timestamptz,
      '2026-10-22 18:30:00+05:30'::timestamptz,
      'Test Design Studio',
      'https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=1000&q=85',
      false,
      18,
      false,
      null::timestamptz,
      4,
      '[]'::jsonb
    )
) as seed(
  title, description, short_description, category, starts_at, ends_at,
  venue, image_url, is_featured, registration_limit, submissions_open,
  submission_deadline, max_team_size, submission_rules
)
where not exists (
  select 1
  from public.events as existing
  where existing.title = seed.title
    and existing.starts_at = seed.starts_at
);

insert into public.team_registrations (
  event_id,
  team_name,
  m1_name,
  m1_email,
  m1_phone,
  m1_usn,
  m2_name,
  m2_email,
  m2_phone,
  m2_usn,
  m3_name,
  m3_email,
  m3_phone,
  m3_usn
)
select
  event.id,
  'Test Build Crew',
  'Test Leader',
  'test.leader@example.invalid',
  '+910000000001',
  'TEST-1001',
  'Test Member Two',
  'test.member2@example.invalid',
  '+910000000002',
  'TEST-1002',
  'Test Member Three',
  'test.member3@example.invalid',
  '+910000000003',
  'TEST-1003'
from public.events as event
where event.title = 'Test Build Night'
  and event.starts_at = '2026-10-18 18:00:00+05:30'::timestamptz
  and not exists (
    select 1
    from public.team_registrations as existing
    where existing.event_id = event.id
      and existing.team_name = 'Test Build Crew'
  );

insert into public.team_registrations (
  event_id,
  team_name,
  m1_name,
  m1_email,
  m1_phone,
  m1_usn
)
select
  event.id,
  'Sample Workshop Team',
  'Sample Lead',
  'sample.lead@example.invalid',
  '+910000000004',
  'TEST-2001'
from public.events as event
where event.title = 'Test Design Workshop'
  and event.starts_at = '2026-10-22 16:30:00+05:30'::timestamptz
  and not exists (
    select 1
    from public.team_registrations as existing
    where existing.event_id = event.id
      and existing.team_name = 'Sample Workshop Team'
  );

insert into public.submissions (
  event_id,
  team_registration_id,
  github_url,
  live_demo_url,
  video_pitch_url,
  submission_notes
)
select
  event.id,
  team.id,
  'https://github.com/example/test-build-crew',
  'https://example.invalid/test-build-crew',
  'https://example.invalid/test-build-crew-pitch',
  'Synthetic submission for testing. Links are examples, not real project resources.'
from public.events as event
join public.team_registrations as team
  on team.event_id = event.id
 and team.team_name = 'Test Build Crew'
where event.title = 'Test Build Night'
  and event.starts_at = '2026-10-18 18:00:00+05:30'::timestamptz
  and not exists (
    select 1
    from public.submissions as existing
    where existing.team_registration_id = team.id
  );
