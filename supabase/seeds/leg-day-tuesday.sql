-- Optional: run in Supabase SQL Editor if you prefer SQL over the in-app "Quick add" button.
-- Replace YOUR_LOGIN_EMAIL with the email you use to sign in.

DO $$
DECLARE
  uid uuid;
  sid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'YOUR_LOGIN_EMAIL' LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No auth.users row for that email — fix YOUR_LOGIN_EMAIL and try again.';
  END IF;

  INSERT INTO public.workout_schedules (user_id, title, weekdays, notes, is_active)
  VALUES (
    uid,
    'Leg day — DB + band',
    ARRAY[2]::smallint[],
    'Dumbbells + band: wall squat, step-ups, bridge, lunge, sidelying & stomach leg lifts.',
    true
  )
  RETURNING id INTO sid;

  INSERT INTO public.schedule_exercises (schedule_id, name, sort_order, sets_count, reps_per_set) VALUES
    (sid, 'Wall Squat (DB)', 0, 3, 10),
    (sid, 'Step ups (DB)', 1, 3, 10),
    (sid, 'Bridge (DB on lap)', 2, 3, 10),
    (sid, 'Stationary Lunge (DB)', 3, 3, 10),
    (sid, 'Sidelying leg lift with band', 4, 3, 10),
    (sid, 'Stomach leg lift with band', 5, 1, 10);
END $$;
