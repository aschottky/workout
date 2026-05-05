import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ExerciseSet, Workout, WorkoutExerciseWithSets } from '../types'
import { useAuth } from '../auth/AuthContext'

function parseWeightKg(raw: string): number | null | 'invalid' {
  const t = raw.trim()
  if (t === '') return null
  const n = Number(t)
  if (Number.isNaN(n)) return 'invalid'
  return n
}

export function TrainWorkoutPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<WorkoutExerciseWithSets[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [exIdx, setExIdx] = useState(0)
  const [setIdx, setSetIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const weightInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    if (!supabase || !user || !id) return
    setLoading(true)
    setError(null)

    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (wErr || !w) {
      setLoading(false)
      setError(wErr?.message ?? 'Workout not found.')
      setWorkout(null)
      setExercises([])
      return
    }

    setWorkout(w as Workout)

    const { data: ex, error: exErr } = await supabase
      .from('workout_exercises')
      .select('*, exercise_sets(*)')
      .eq('workout_id', id)
      .order('sort_order', { ascending: true })

    setLoading(false)
    if (exErr) {
      setError(exErr.message)
      setExercises([])
      return
    }

    const rows = (ex as WorkoutExerciseWithSets[]) ?? []
    rows.forEach((r) => {
      r.exercise_sets = (r.exercise_sets ?? []).sort((a, b) => a.set_index - b.set_index)
    })
    setExercises(rows)
    setExIdx(0)
    setSetIdx(0)
    setDone(false)
  }, [id, user])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  const currentExercise = exercises[exIdx]
  const currentSets = currentExercise?.exercise_sets ?? []
  const currentSet: ExerciseSet | undefined = currentSets[setIdx]

  const totalSets = exercises.reduce((acc, ex) => acc + ex.exercise_sets.length, 0)
  const completedBeforeCurrent =
    exercises.slice(0, exIdx).reduce((acc, ex) => acc + ex.exercise_sets.length, 0) + setIdx
  const progress = totalSets > 0 ? Math.min(1, completedBeforeCurrent / totalSets) : 0

  useEffect(() => {
    if (done || loading) return
    queueMicrotask(() => weightInputRef.current?.focus())
  }, [done, loading, exIdx, setIdx])

  async function persistAndAdvance(weight_kg: number | null) {
    const client = supabase
    if (!client || !currentSet) return

    setSaving(true)
    setError(null)

    const { error: uErr } = await client
      .from('exercise_sets')
      .update({ weight_kg })
      .eq('id', currentSet.id)

    if (uErr) {
      setError(uErr.message)
      setSaving(false)
      return
    }

    setExercises((prev) =>
      prev.map((ex) => ({
        ...ex,
        exercise_sets: ex.exercise_sets.map((s) =>
          s.id === currentSet.id ? { ...s, weight_kg } : s,
        ),
      })),
    )

    const lastSetOfExercise = setIdx >= currentSets.length - 1
    const lastExercise = exIdx >= exercises.length - 1

    if (!lastSetOfExercise) {
      setSetIdx((i) => i + 1)
    } else if (!lastExercise) {
      setExIdx((i) => i + 1)
      setSetIdx(0)
    } else {
      setDone(true)
    }

    setSaving(false)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!currentSet || saving) return
    const raw = weightInputRef.current?.value ?? ''
    const parsed = parseWeightKg(raw)
    if (parsed === 'invalid') {
      setError('Enter a valid number for weight, or leave blank to skip.')
      return
    }
    await persistAndAdvance(parsed)
  }

  async function skipSet() {
    if (!currentSet || saving) return
    await persistAndAdvance(null)
  }

  if (loading) {
    return (
      <div className="train-page">
        <p className="muted train-pad">Loading…</p>
      </div>
    )
  }

  if (!workout) {
    return (
      <div className="train-page train-pad">
        <p className="message error">{error ?? 'Not found.'}</p>
        <Link to="/" className="btn ghost train-btn-large">
          Home
        </Link>
      </div>
    )
  }

  if (exercises.length === 0 || totalSets === 0) {
    return (
      <div className="train-page train-pad">
        <p className="muted">Add exercises to this workout before training mode.</p>
        <Link to={`/workout/${id}`} className="btn primary train-btn-large">
          Edit workout
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="train-page train-done">
        <h2 className="train-done-title">Workout complete</h2>
        <p className="muted">Nice work. You can review or edit anything on the workout page.</p>
        <div className="train-actions-stack">
          <Link to={`/workout/${id}`} className="btn primary train-btn-large">
            Review workout
          </Link>
          <Link to="/" className="btn ghost train-btn-large">
            All workouts
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="train-page">
      <header className="train-top">
        <Link to={`/workout/${id}`} className="train-back">
          ← Exit
        </Link>
        <span className="train-date">{workout.workout_date}</span>
      </header>

      <div className="train-progress-wrap" aria-hidden="true">
        <div className="train-progress-bar" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="train-progress-label muted small">
        Set {completedBeforeCurrent + 1} of {totalSets}
        {exercises.length > 1 && (
          <>
            {' '}
            · Exercise {exIdx + 1} of {exercises.length}
          </>
        )}
      </p>

      <main className="train-main">
        <p className="train-kicker muted small">Current exercise</p>
        <h1 className="train-exercise-title">{currentExercise.name}</h1>
        <p className="train-set-line">
          Set <strong>{currentSet.set_index}</strong> of {currentSets.length}
        </p>
        <p className="train-reps-line">
          Reps: <strong>{currentSet.reps}</strong>
        </p>

        {error && <p className="message error train-inline-msg">{error}</p>}

        <form className="train-form" onSubmit={onSubmit}>
          <label className="train-weight-label" htmlFor="train-weight">
            Weight
          </label>
          <input
            id="train-weight"
            key={currentSet.id}
            ref={weightInputRef}
            className="train-weight-input"
            type="text"
            name="weight"
            inputMode="decimal"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="0"
            defaultValue={currentSet.weight_kg == null ? '' : String(currentSet.weight_kg)}
            onChange={() => setError(null)}
            aria-label="Weight for this set"
          />
          <p className="muted small train-hint">Same unit every time (e.g. lb or kg). Leave blank to skip weight.</p>

          <div className="train-actions-stack">
            <button type="submit" className="btn primary train-btn-large" disabled={saving}>
              {saving ? 'Saving…' : 'Log set & next'}
            </button>
            <button type="button" className="btn ghost train-btn-large" disabled={saving} onClick={() => void skipSet()}>
              Skip (no weight)
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
