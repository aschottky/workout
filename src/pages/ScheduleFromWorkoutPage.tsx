import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Workout, WorkoutExerciseWithSets } from '../types'
import { useAuth } from '../auth/AuthContext'
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from '../lib/weekdays'

function repsForTemplate(sets: { set_index: number; reps: number }[]): number {
  const sorted = [...sets].sort((a, b) => a.set_index - b.set_index)
  return sorted[0]?.reps ?? 10
}

function allSameReps(sets: { reps: number }[]): boolean {
  if (sets.length <= 1) return true
  const r = sets[0].reps
  return sets.every((s) => s.reps === r)
}

export function ScheduleFromWorkoutPage() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<WorkoutExerciseWithSets[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([1])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !user || !workoutId) return
    setLoading(true)
    setError(null)

    const { data: w, error: wErr } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (wErr || !w) {
      setLoading(false)
      setError(wErr?.message ?? 'Workout not found.')
      setWorkout(null)
      setExercises([])
      return
    }

    const row = w as Workout
    setWorkout(row)

    const defaultTitle = row.notes?.trim()
      ? `${row.notes.trim()} (recurring)`
      : `Workout from ${row.workout_date}`
    setTitle(defaultTitle)
    setNotes(row.notes?.trim() ? `Based on ${row.workout_date}.` : `Template from ${row.workout_date}.`)

    const { data: ex, error: exErr } = await supabase
      .from('workout_exercises')
      .select('*, exercise_sets(*)')
      .eq('workout_id', workoutId)
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
  }, [workoutId, user])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  function toggleWeekday(d: number) {
    setWeekdays((prev) => {
      const set = new Set(prev)
      if (set.has(d)) {
        if (prev.length <= 1) return prev
        set.delete(d)
      } else {
        set.add(d)
      }
      return [...set].sort((a, b) => a - b)
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const client = supabase
    if (!client || !user || !workout || !workoutId || exercises.length === 0) return

    setSaving(true)
    setError(null)

    const { data: sch, error: schErr } = await client
      .from('workout_schedules')
      .insert({
        user_id: user.id,
        title: title.trim() || 'Recurring workout',
        weekdays,
        notes: notes.trim() || null,
        is_active: true,
      })
      .select('id')
      .single()

    if (schErr || !sch) {
      setSaving(false)
      setError(schErr?.message ?? 'Could not create schedule.')
      return
    }

    const scheduleId = sch.id as string

    const templateRows = exercises.map((ex) => ({
      schedule_id: scheduleId,
      name: ex.name,
      sort_order: ex.sort_order,
      sets_count: Math.max(1, ex.exercise_sets.length),
      reps_per_set: repsForTemplate(ex.exercise_sets),
    }))

    const { error: exInsErr } = await client.from('schedule_exercises').insert(templateRows)

    setSaving(false)
    if (exInsErr) {
      setError(exInsErr.message)
      await client.from('workout_schedules').delete().eq('id', scheduleId)
      return
    }

    navigate(`/schedule/${scheduleId}`)
  }

  if (loading) {
    return <p className="muted">Loading workout…</p>
  }

  if (!workout) {
    return (
      <div className="page">
        <p className="message error">{error ?? 'Not found.'}</p>
        <Link to="/" className="btn ghost">
          Back
        </Link>
      </div>
    )
  }

  const varyingReps = exercises.some((ex) => ex.exercise_sets.length > 0 && !allSameReps(ex.exercise_sets))

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/">Workouts</Link>
        <span aria-hidden="true"> / </span>
        <Link to={`/workout/${workoutId}`}>{workout.workout_date}</Link>
        <span aria-hidden="true"> / </span>
        <span>Make recurring</span>
      </nav>

      <header className="page-header">
        <div>
          <h1>Schedule from workout</h1>
          <p className="muted">
            Creates a recurring template with the same exercises, set counts, and reps as this session (weights are
            not copied—you log those each time).
          </p>
        </div>
      </header>

      {error && <p className="message error">{error}</p>}

      {exercises.length === 0 ? (
        <section className="panel">
          <p className="muted">This workout has no exercises yet. Add some on the workout page, then try again.</p>
          <Link to={`/workout/${workoutId}`} className="btn primary">
            Back to workout
          </Link>
        </section>
      ) : (
        <>
          {varyingReps && (
            <p className="message">
              Some sets use different rep counts; the template will use <strong>set 1&apos;s reps</strong> per
              exercise. You can adjust on the next screen.
            </p>
          )}

          <section className="panel">
            <h2>Exercises to copy</h2>
            <ul className="muted" style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {exercises.map((ex) => (
                <li key={ex.id}>
                  {ex.name} — {ex.exercise_sets.length}×{repsForTemplate(ex.exercise_sets)}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2>Repeat on</h2>
            <div className="weekday-row">
              {WEEKDAY_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`chip ${weekdays.includes(d) ? 'on' : ''}`}
                  onClick={() => toggleWeekday(d)}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              ))}
            </div>

            <form className="stack" style={{ marginTop: '1rem' }} onSubmit={onSubmit}>
              <label className="field">
                <span>Schedule title</span>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label className="field">
                <span>Schedule notes (optional)</span>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <div className="row">
                <button type="submit" className="btn primary" disabled={saving}>
                  {saving ? 'Creating…' : 'Create recurring schedule'}
                </button>
                <Link to={`/workout/${workoutId}`} className="btn ghost">
                  Cancel
                </Link>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  )
}
