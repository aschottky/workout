import type { SupabaseClient } from '@supabase/supabase-js'
import { insertWorkoutSchedulePreset, type PresetInsertResult, type WorkoutSchedulePreset } from './insertWorkoutSchedulePreset'

/** 0 Sun … 3 Wed … 5 Fri … 6 Sat */
export const PULL_DAY_WEDNESDAY_HOME: WorkoutSchedulePreset = {
  title: 'Wednesday: Pull day (home)',
  weekdays: [3],
  notes: 'Home pull session — dumbbells + band. All exercises 3×10 unless you change the template.',
  exercises: [
    { name: 'Lawnmower rows (DB)', sort_order: 0, sets_count: 3, reps_per_set: 10 },
    { name: 'Bicep curls (DB)', sort_order: 1, sets_count: 3, reps_per_set: 10 },
    { name: 'Lying on bench (face down) reverse fly', sort_order: 2, sets_count: 3, reps_per_set: 10 },
    { name: 'Bent arm pullover (DB)', sort_order: 3, sets_count: 3, reps_per_set: 10 },
    { name: 'Banded pull aparts', sort_order: 4, sets_count: 3, reps_per_set: 10 },
    { name: 'Hammer curls (DB)', sort_order: 5, sets_count: 3, reps_per_set: 10 },
  ],
}

export const HAMS_CALVES_THURSDAY_HOME: WorkoutSchedulePreset = {
  title: 'Thursday: Hams / calves (home)',
  weekdays: [4],
  notes: 'Home hamstrings & calves — DB + band. Last exercise 1×10; others 3×10.',
  exercises: [
    { name: 'Calf raises (DB)', sort_order: 0, sets_count: 3, reps_per_set: 10 },
    { name: 'Dead Lifts (DB)', sort_order: 1, sets_count: 3, reps_per_set: 10 },
    { name: 'Single leg Bridge', sort_order: 2, sets_count: 3, reps_per_set: 10 },
    { name: 'All fours kick back (band)', sort_order: 3, sets_count: 3, reps_per_set: 10 },
    { name: 'All fours hydrants', sort_order: 4, sets_count: 3, reps_per_set: 10 },
    { name: 'Open and close bridge', sort_order: 5, sets_count: 1, reps_per_set: 10 },
  ],
}

export const TOTAL_BODY_FRIDAY_HOME: WorkoutSchedulePreset = {
  title: 'Friday: Total body (home)',
  weekdays: [5],
  notes: 'Home total body — bands + DB. All listed moves 3×10 (adjust in template if needed).',
  exercises: [
    { name: 'Band shoulder external rotation', sort_order: 0, sets_count: 3, reps_per_set: 10 },
    { name: 'Band shoulder internal rotation', sort_order: 1, sets_count: 3, reps_per_set: 10 },
    { name: 'Upright rows (DB)', sort_order: 2, sets_count: 3, reps_per_set: 10 },
    { name: 'Banded side stepping (or monster walk)', sort_order: 3, sets_count: 3, reps_per_set: 10 },
    { name: 'Sidelying clamshells with band', sort_order: 4, sets_count: 3, reps_per_set: 10 },
    { name: 'Banded donkey kicks', sort_order: 5, sets_count: 3, reps_per_set: 10 },
  ],
}

export function insertPullWednesdayHomePreset(
  client: SupabaseClient,
  userId: string,
): Promise<PresetInsertResult> {
  return insertWorkoutSchedulePreset(client, userId, PULL_DAY_WEDNESDAY_HOME)
}

export function insertHamsCalvesThursdayHomePreset(
  client: SupabaseClient,
  userId: string,
): Promise<PresetInsertResult> {
  return insertWorkoutSchedulePreset(client, userId, HAMS_CALVES_THURSDAY_HOME)
}

export function insertTotalBodyFridayHomePreset(
  client: SupabaseClient,
  userId: string,
): Promise<PresetInsertResult> {
  return insertWorkoutSchedulePreset(client, userId, TOTAL_BODY_FRIDAY_HOME)
}
