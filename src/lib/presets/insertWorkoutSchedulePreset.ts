import type { SupabaseClient } from '@supabase/supabase-js'

export type WorkoutSchedulePreset = {
  title: string
  weekdays: readonly number[]
  notes: string
  exercises: readonly {
    name: string
    sort_order: number
    sets_count: number
    reps_per_set: number
  }[]
}

export type PresetInsertResult =
  | { ok: true; scheduleId: string }
  | { ok: false; error: string }

export async function insertWorkoutSchedulePreset(
  client: SupabaseClient,
  userId: string,
  preset: WorkoutSchedulePreset,
): Promise<PresetInsertResult> {
  const { data: sch, error: schErr } = await client
    .from('workout_schedules')
    .insert({
      user_id: userId,
      title: preset.title,
      weekdays: [...preset.weekdays],
      notes: preset.notes,
      is_active: true,
    })
    .select('id')
    .single()

  if (schErr || !sch) {
    return { ok: false, error: schErr?.message ?? 'Could not create schedule.' }
  }

  const scheduleId = sch.id as string

  const rows = preset.exercises.map((e) => ({
    schedule_id: scheduleId,
    name: e.name,
    sort_order: e.sort_order,
    sets_count: e.sets_count,
    reps_per_set: e.reps_per_set,
  }))

  const { error: exErr } = await client.from('schedule_exercises').insert(rows)

  if (exErr) {
    await client.from('workout_schedules').delete().eq('id', scheduleId)
    return { ok: false, error: exErr.message }
  }

  return { ok: true, scheduleId }
}
