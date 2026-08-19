-- Key Buddy account/profile and per-user progress schema.
-- One auth.users row owns exactly one pianist profile and every progress row.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    left(coalesce(requested_name, nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Pianist'), 80)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.player_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.skill_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_id)
);

create table public.chart_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  chart_id text not null,
  best_stars integer not null default 0 check (best_stars between 0 and 3),
  mastery_star boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, chart_id)
);

create table public.attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id text not null,
  ref_id text not null,
  session_id text,
  occurred_at timestamptz not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, attempt_id)
);

create index attempts_user_occurred_at_idx
  on public.attempts (user_id, occurred_at desc);

create table public.lesson_results (
  user_id uuid not null references auth.users (id) on delete cascade,
  result_id text not null,
  lesson_id text not null,
  session_id text,
  occurred_at timestamptz not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, result_id)
);

create index lesson_results_user_occurred_at_idx
  on public.lesson_results (user_id, occurred_at desc);

create table public.lesson_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.song_mastery (
  user_id uuid not null references auth.users (id) on delete cascade,
  song_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

create table public.practice_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  started_at timestamptz not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create index practice_sessions_user_started_at_idx
  on public.practice_sessions (user_id, started_at desc);

create table public.adaptation_state (
  user_id uuid not null references auth.users (id) on delete cascade,
  ref_id text not null,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (user_id, ref_id)
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger player_state_set_updated_at
  before update on public.player_state
  for each row execute procedure public.set_updated_at();
create trigger skill_progress_set_updated_at
  before update on public.skill_progress
  for each row execute procedure public.set_updated_at();
create trigger chart_progress_set_updated_at
  before update on public.chart_progress
  for each row execute procedure public.set_updated_at();
create trigger attempts_set_updated_at
  before update on public.attempts
  for each row execute procedure public.set_updated_at();
create trigger lesson_results_set_updated_at
  before update on public.lesson_results
  for each row execute procedure public.set_updated_at();
create trigger lesson_progress_set_updated_at
  before update on public.lesson_progress
  for each row execute procedure public.set_updated_at();
create trigger song_mastery_set_updated_at
  before update on public.song_mastery
  for each row execute procedure public.set_updated_at();
create trigger practice_sessions_set_updated_at
  before update on public.practice_sessions
  for each row execute procedure public.set_updated_at();
create trigger adaptation_state_set_updated_at
  before update on public.adaptation_state
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.player_state enable row level security;
alter table public.skill_progress enable row level security;
alter table public.chart_progress enable row level security;
alter table public.attempts enable row level security;
alter table public.lesson_results enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.song_mastery enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.adaptation_state enable row level security;

create policy profiles_owner_access on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy player_state_owner_access on public.player_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy skill_progress_owner_access on public.skill_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy chart_progress_owner_access on public.chart_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy attempts_owner_access on public.attempts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy lesson_results_owner_access on public.lesson_results
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy lesson_progress_owner_access on public.lesson_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy song_mastery_owner_access on public.song_mastery
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy practice_sessions_owner_access on public.practice_sessions
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy adaptation_state_owner_access on public.adaptation_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.profiles from anon;
revoke all on table public.player_state from anon;
revoke all on table public.skill_progress from anon;
revoke all on table public.chart_progress from anon;
revoke all on table public.attempts from anon;
revoke all on table public.lesson_results from anon;
revoke all on table public.lesson_progress from anon;
revoke all on table public.song_mastery from anon;
revoke all on table public.practice_sessions from anon;
revoke all on table public.adaptation_state from anon;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.player_state to authenticated;
grant select, insert, update, delete on table public.skill_progress to authenticated;
grant select, insert, update, delete on table public.chart_progress to authenticated;
grant select, insert, update, delete on table public.attempts to authenticated;
grant select, insert, update, delete on table public.lesson_results to authenticated;
grant select, insert, update, delete on table public.lesson_progress to authenticated;
grant select, insert, update, delete on table public.song_mastery to authenticated;
grant select, insert, update, delete on table public.practice_sessions to authenticated;
grant select, insert, update, delete on table public.adaptation_state to authenticated;
