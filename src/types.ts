export type Workout = {
  id: string
  user_id: string
  workout_date: string
  notes: string | null
  schedule_id?: string | null
  /** Present when listing workouts with `select('*, workout_schedules(title)')`. */
  workout_schedules?: { title: string } | null
  created_at: string
}

export type WorkoutSchedule = {
  id: string
  user_id: string
  title: string
  weekdays: number[]
  notes: string | null
  is_active: boolean
  created_at: string
}

export type ScheduleExercise = {
  id: string
  schedule_id: string
  name: string
  sort_order: number
  sets_count: number
  reps_per_set: number
}

export type WorkoutExercise = {
  id: string
  workout_id: string
  name: string
  sort_order: number
}

export type ExerciseSet = {
  id: string
  workout_exercise_id: string
  set_index: number
  reps: number
  weight_kg: number | null
}

export type WorkoutExerciseWithSets = WorkoutExercise & {
  exercise_sets: ExerciseSet[]
}
