export type Workout = {
  id: string
  user_id: string
  workout_date: string
  notes: string | null
  created_at: string
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
