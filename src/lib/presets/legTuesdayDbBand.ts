import type { SupabaseClient } from '@supabase/supabase-js'
import { insertWorkoutSchedulePreset, type PresetInsertResult, type WorkoutSchedulePreset } from './insertWorkoutSchedulePreset'

/** Matches `Date.getDay()`: 0 Sun … 2 Tue … 6 Sat */
export const LEG_DAY_TUESDAY_WEEKDAYS = [2] as const

export const LEG_DAY_DB_BAND_PRESET: WorkoutSchedulePreset = {
  title: 'Leg day — DB + band',
  weekdays: LEG_DAY_TUESDAY_WEEKDAYS,
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
}

export type { PresetInsertResult }

export function insertLegTuesdayDbBandPreset(
  client: SupabaseClient,
  userId: string,
): Promise<PresetInsertResult> {
  return insertWorkoutSchedulePreset(client, userId, LEG_DAY_DB_BAND_PRESET)
}
