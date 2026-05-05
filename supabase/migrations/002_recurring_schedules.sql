-- Apply if you already ran the initial schema without recurring schedules.

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

drop policy if exists "workout_schedules_own" on public.workout_schedules;
create policy "workout_schedules_own" on public.workout_schedules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "schedule_exercises_own" on public.schedule_exercises;
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

drop policy if exists "workouts_insert_own" on public.workouts;
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

drop policy if exists "workouts_update_own" on public.workouts;
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
