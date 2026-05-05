import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleExercise } from '../types'

export type SpawnResult =
  | { ok: true; workoutId: string }
  | { ok: false; error: string; code?: string }

/** Inserts a workout for `workoutDate` and copies template exercises + empty set rows. */
export async function spawnWorkoutFromSchedule(
  client: SupabaseClient,
  args: {
    userId: string
    scheduleId: string
    workoutDate: string
    scheduleTitle: string
    scheduleNotes: string | null
    exercises: Pick<ScheduleExercise, 'name' | 'sort_order' | 'sets_count' | 'reps_per_set'>[]
  },
): Promise<SpawnResult> {
  const noteLines = [args.scheduleTitle, args.scheduleNotes].filter(Boolean)
  const notes = noteLines.length ? noteLines.join('\n') : null

  const { data: w, error: wErr } = await client
    .from('workouts')
    .insert({
      user_id: args.userId,
      workout_date: args.workoutDate,
      notes,
      schedule_id: args.scheduleId,
    })
    .select('id')
    .single()

  if (wErr || !w) {
    return { ok: false, error: wErr?.message ?? 'Could not create workout.', code: wErr?.code }
  }

  const workoutId = w.id as string

  for (const row of args.exercises) {
    const { data: we, error: weErr } = await client
      .from('workout_exercises')
      .insert({
        workout_id: workoutId,
        name: row.name,
        sort_order: row.sort_order,
      })
      .select('id')
      .single()

    if (weErr || !we) {
      return { ok: false, error: weErr?.message ?? 'Could not add exercise.', code: weErr?.code }
    }

    const wid = we.id as string
    const count = Math.max(1, Math.min(50, Math.floor(row.sets_count)))
    const reps = Math.max(1, Math.min(999, Math.floor(row.reps_per_set)))
    const setRows = Array.from({ length: count }, (_, i) => ({
      workout_exercise_id: wid,
      set_index: i + 1,
      reps,
      weight_kg: null as number | null,
    }))

    const { error: sErr } = await client.from('exercise_sets').insert(setRows)
    if (sErr) {
      return { ok: false, error: sErr.message, code: sErr.code }
    }
  }

  return { ok: true, workoutId }
}
