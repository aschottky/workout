import type { SupabaseClient } from '@supabase/supabase-js'

/** Matches `Date.getDay()`: 0 Sun … 2 Tue … 6 Sat */
export const LEG_DAY_TUESDAY_WEEKDAYS = [2] as const

export const LEG_DAY_DB_BAND_PRESET = {
  title: 'Leg day — DB + band',
  notes:
    'Dumbbells + band: wall squat, step-ups, bridge, lunge, sidelying & stomach leg lifts. (Preset: 3×10 except last exercise 1×10.)',
  exercises: [
    { name: 'Wall Squat (DB)', sort_order: 0, sets_count: 3, reps_per_set: 10 },
    { name: 'Step ups (DB)', sort_order: 1, sets_count: 3, reps_per_set: 10 },
    { name: 'Bridge (DB on lap)', sort_order: 2, sets_count: 3, reps_per_set: 10 },
    { name: 'Stationary Lunge (DB)', sort_order: 3, sets_count: 3, reps_per_set: 10 },
    { name: 'Sidelying leg lift with band', sort_order: 4, sets_count: 3, reps_per_set: 10 },
    { name: 'Stomach leg lift with band', sort_order: 5, sets_count: 1, reps_per_set: 10 },
  ],
} as const

export type PresetInsertResult =
  | { ok: true; scheduleId: string }
  | { ok: false; error: string }

export async function insertLegTuesdayDbBandPreset(
  client: SupabaseClient,
  userId: string,
): Promise<PresetInsertResult> {
  const { data: sch, error: schErr } = await client
    .from('workout_schedules')
    .insert({
      user_id: userId,
      title: LEG_DAY_DB_BAND_PRESET.title,
      weekdays: [...LEG_DAY_TUESDAY_WEEKDAYS],
      notes: LEG_DAY_DB_BAND_PRESET.notes,
      is_active: true,
    })
    .select('id')
    .single()

  if (schErr || !sch) {
    return { ok: false, error: schErr?.message ?? 'Could not create schedule.' }
  }

  const scheduleId = sch.id as string

  const rows = LEG_DAY_DB_BAND_PRESET.exercises.map((e) => ({
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
