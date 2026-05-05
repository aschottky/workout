-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Creates tables and row level security for the workout tracker.

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists workouts_user_date_idx on public.workouts (user_id, workout_date desc);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_index int not null,
  reps int not null check (reps > 0),
  weight_kg numeric(12, 2),
  unique (workout_exercise_id, set_index)
);

create index if not exists exercise_sets_exercise_idx on public.exercise_sets (workout_exercise_id);

-- Weekly recurring templates (e.g. every Monday). Spawned workouts copy template exercises.
create table if not exists public.workout_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  weekdays smallint[] not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists workout_schedules_user_idx on public.workout_schedules (user_id);

create table if not exists public.schedule_exercises (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.workout_schedules (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  sets_count int not null default 3,
  reps_per_set int not null default 10,
  check (sets_count between 1 and 50),
  check (reps_per_set between 1 and 999)
);

create index if not exists schedule_exercises_schedule_idx on public.schedule_exercises (schedule_id);

alter table public.workouts add column if not exists schedule_id uuid references public.workout_schedules (id) on delete set null;

create unique index if not exists workouts_one_per_schedule_day
  on public.workouts (user_id, workout_date, schedule_id)
  where schedule_id is not null;

alter table public.workout_schedules enable row level security;
alter table public.schedule_exercises enable row level security;

create policy "workout_schedules_own" on public.workout_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "schedule_exercises_own" on public.schedule_exercises
  for all using (
    exists (
      select 1 from public.workout_schedules s
      where s.id = schedule_exercises.schedule_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_schedules s
      where s.id = schedule_exercises.schedule_id and s.user_id = auth.uid()
    )
  );

alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.exercise_sets enable row level security;

create policy "workouts_select_own" on public.workouts
  for select using (auth.uid() = user_id);

create policy "workouts_insert_own" on public.workouts
  for insert with check (
    auth.uid() = user_id
    and (
      schedule_id is null
      or exists (
        select 1 from public.workout_schedules s
        where s.id = schedule_id and s.user_id = auth.uid()
      )
    )
  );

create policy "workouts_update_own" on public.workouts
  for update using (auth.uid() = user_id) with check (
    auth.uid() = user_id
    and (
      schedule_id is null
      or exists (
        select 1 from public.workout_schedules s
        where s.id = schedule_id and s.user_id = auth.uid()
      )
    )
  );

create policy "workouts_delete_own" on public.workouts
  for delete using (auth.uid() = user_id);

create policy "workout_exercises_all_own" on public.workout_exercises
  for all using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_exercises.workout_id and w.user_id = auth.uid()
    )
  );

create policy "exercise_sets_all_own" on public.exercise_sets
  for all using (
    exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = exercise_sets.workout_exercise_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = exercise_sets.workout_exercise_id and w.user_id = auth.uid()
    )
  );
