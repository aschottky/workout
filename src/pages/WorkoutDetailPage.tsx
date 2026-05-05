import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ExerciseSet, Workout, WorkoutExerciseWithSets } from '../types'
import { useAuth } from '../auth/AuthContext'

export function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [exercises, setExercises] = useState<WorkoutExerciseWithSets[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [exName, setExName] = useState('')
  const [exSets, setExSets] = useState(3)
  const [exReps, setExReps] = useState(10)
  const [adding, setAdding] = useState(false)

  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [savingMeta, setSavingMeta] = useState(false)

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

    const workoutRow = w as Workout
    setWorkout(workoutRow)
    setEditDate(workoutRow.workout_date)
    setEditNotes(workoutRow.notes ?? '')

    const { data: ex, error: exErr } = await supabase
      .from('workout_exercises')
      .select('*, exercise_sets(*)')
      .eq('workout_id', id)
      .order('sort_order', { ascending: true })

    setLoading(false)
    if (exErr) {
      setError(exErr.message)
      return
    }

    const rows = (ex as WorkoutExerciseWithSets[]) ?? []
    rows.forEach((r) => {
      r.exercise_sets = (r.exercise_sets ?? []).sort((a, b) => a.set_index - b.set_index)
    })
    setExercises(rows)
  }, [id, user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function saveMeta(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !workout) return
    setSavingMeta(true)
    setError(null)
    const { error: uErr } = await supabase
      .from('workouts')
      .update({
        workout_date: editDate,
        notes: editNotes.trim() || null,
      })
      .eq('id', workout.id)
    setSavingMeta(false)
    if (uErr) {
      setError(uErr.message)
      return
    }
    await load()
  }

  async function deleteWorkout() {
    if (!supabase || !workout) return
    if (!confirm('Delete this workout and all exercises?')) return
    const { error: dErr } = await supabase.from('workouts').delete().eq('id', workout.id)
    if (dErr) {
      setError(dErr.message)
      return
    }
    navigate('/')
  }

  async function addExercise(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !workout || !exName.trim()) return
    setAdding(true)
    setError(null)

    const nextOrder =
      exercises.length === 0 ? 0 : Math.max(...exercises.map((x) => x.sort_order)) + 1

    const { data: inserted, error: insErr } = await supabase
      .from('workout_exercises')
      .insert({
        workout_id: workout.id,
        name: exName.trim(),
        sort_order: nextOrder,
      })
      .select('id')
      .single()

    if (insErr || !inserted) {
      setAdding(false)
      setError(insErr?.message ?? 'Could not add exercise.')
      return
    }

    const exerciseId = inserted.id as string
    const count = Math.max(1, Math.min(50, Math.floor(exSets)))
    const reps = Math.max(1, Math.min(999, Math.floor(exReps)))

    const setRows = Array.from({ length: count }, (_, i) => ({
      workout_exercise_id: exerciseId,
      set_index: i + 1,
      reps,
      weight_kg: null as number | null,
    }))

    const { error: setsErr } = await supabase.from('exercise_sets').insert(setRows)
    setAdding(false)
    if (setsErr) {
      setError(setsErr.message)
      return
    }
    setExName('')
    setExSets(3)
    setExReps(10)
    await load()
  }

  async function updateSetWeight(setId: string, weight: string) {
    if (!supabase) return
    const trimmed = weight.trim()
    const weight_kg = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && Number.isNaN(weight_kg)) return

    const { error: uErr } = await supabase
      .from('exercise_sets')
      .update({ weight_kg })
      .eq('id', setId)

    if (uErr) setError(uErr.message)
    else await load()
  }

  async function updateSetReps(setId: string, reps: number) {
    if (!supabase) return
    const r = Math.max(1, Math.min(999, Math.floor(reps)))
    const { error: uErr } = await supabase.from('exercise_sets').update({ reps: r }).eq('id', setId)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function applyPlan(exercise: WorkoutExerciseWithSets, newCount: number, defaultReps: number) {
    if (!supabase) return
    const count = Math.max(1, Math.min(50, Math.floor(newCount)))
    const reps = Math.max(1, Math.min(999, Math.floor(defaultReps)))
    const sets = exercise.exercise_sets
    const current = sets.length

    if (count === current) {
      const allSameReps = sets.every((s) => s.reps === reps)
      if (!allSameReps) {
        const { error: bulkErr } = await supabase
          .from('exercise_sets')
          .update({ reps })
          .eq('workout_exercise_id', exercise.id)
        if (bulkErr) setError(bulkErr.message)
        else await load()
      }
      return
    }

    if (count < current) {
      const toRemove = sets.filter((s) => s.set_index > count)
      const { error: delErr } = await supabase
        .from('exercise_sets')
        .delete()
        .in(
          'id',
          toRemove.map((s) => s.id),
        )
      if (delErr) {
        setError(delErr.message)
        return
      }
      const { error: repAfterDel } = await supabase
        .from('exercise_sets')
        .update({ reps })
        .eq('workout_exercise_id', exercise.id)
      if (repAfterDel) {
        setError(repAfterDel.message)
        return
      }
      await load()
      return
    } else {
      const existingMax = current === 0 ? 0 : Math.max(...sets.map((s) => s.set_index))
      const newRows = []
      for (let i = existingMax + 1; i <= count; i++) {
        newRows.push({
          workout_exercise_id: exercise.id,
          set_index: i,
          reps,
          weight_kg: null as number | null,
        })
      }
      const { error: insErr } = await supabase.from('exercise_sets').insert(newRows)
      if (insErr) {
        setError(insErr.message)
        return
      }
    }

    if (count >= current) {
      const { error: repErr } = await supabase
        .from('exercise_sets')
        .update({ reps })
        .eq('workout_exercise_id', exercise.id)
      if (repErr) setError(repErr.message)
    }

    await load()
  }

  async function removeExercise(exerciseId: string) {
    if (!supabase) return
    if (!confirm('Remove this exercise and its sets?')) return
    const { error: dErr } = await supabase.from('workout_exercises').delete().eq('id', exerciseId)
    if (dErr) setError(dErr.message)
    else await load()
  }

  const weightInputs = useMemo(() => {
    const map = new Map<string, string>()
    exercises.forEach((ex) => {
      ex.exercise_sets.forEach((s) => {
        map.set(s.id, s.weight_kg == null ? '' : String(s.weight_kg))
      })
    })
    return map
  }, [exercises])

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

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/">Workouts</Link>
        <span aria-hidden="true"> / </span>
        <span>{workout.workout_date}</span>
      </nav>

      <header className="page-header">
        <h1>{workout.workout_date}</h1>
        <button type="button" className="btn danger ghost" onClick={() => void deleteWorkout()}>
          Delete workout
        </button>
      </header>

      {error && <p className="message error">{error}</p>}

      <section className="panel">
        <h2>Session details</h2>
        <form className="stack horizontal-md" onSubmit={saveMeta}>
          <label className="field inline">
            <span>Date</span>
            <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
          </label>
          <label className="field grow">
            <span>Notes</span>
            <input
              type="text"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <button type="submit" className="btn primary" disabled={savingMeta}>
            {savingMeta ? 'Saving…' : 'Save'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Add exercise</h2>
        <form className="stack horizontal-md wrap" onSubmit={addExercise}>
          <label className="field grow">
            <span>Name</span>
            <input
              type="text"
              placeholder="Skull crusher"
              value={exName}
              onChange={(e) => setExName(e.target.value)}
              required
            />
          </label>
          <label className="field inline">
            <span>Sets</span>
            <input
              type="number"
              min={1}
              max={50}
              value={exSets}
              onChange={(e) => setExSets(Number(e.target.value))}
            />
          </label>
          <label className="field inline">
            <span>Reps</span>
            <input
              type="number"
              min={1}
              max={999}
              value={exReps}
              onChange={(e) => setExReps(Number(e.target.value))}
            />
          </label>
          <button type="submit" className="btn primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      </section>

      {exercises.length === 0 ? (
        <p className="muted">No exercises yet. Add one above.</p>
      ) : (
        <div className="stack gap-lg">
          {exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              initialWeights={weightInputs}
              onRemove={() => void removeExercise(ex.id)}
              onBlurWeight={(setId, value) => void updateSetWeight(setId, value)}
              onCommitReps={(setId, reps) => void updateSetReps(setId, reps)}
              onApplyPlan={(count, reps) => void applyPlan(ex, count, reps)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ExerciseCard({
  exercise,
  initialWeights,
  onRemove,
  onBlurWeight,
  onCommitReps,
  onApplyPlan,
}: {
  exercise: WorkoutExerciseWithSets
  initialWeights: Map<string, string>
  onRemove: () => void
  onBlurWeight: (setId: string, value: string) => void
  onCommitReps: (setId: string, reps: number) => void
  onApplyPlan: (sets: number, reps: number) => void
}) {
  const [planSets, setPlanSets] = useState(exercise.exercise_sets.length || 3)
  const [planReps, setPlanReps] = useState(exercise.exercise_sets[0]?.reps ?? 10)

  useEffect(() => {
    queueMicrotask(() => {
      setPlanSets(exercise.exercise_sets.length || 3)
      setPlanReps(exercise.exercise_sets[0]?.reps ?? 10)
    })
  }, [exercise.id, exercise.exercise_sets])

  return (
    <article className="panel exercise-card">
      <div className="exercise-head">
        <h3>{exercise.name}</h3>
        <button type="button" className="btn ghost small" onClick={onRemove}>
          Remove
        </button>
      </div>

      <div className="plan-row">
        <label className="field inline">
          <span>Sets</span>
          <input
            type="number"
            min={1}
            max={50}
            value={planSets}
            onChange={(e) => setPlanSets(Number(e.target.value))}
          />
        </label>
        <label className="field inline">
          <span>Reps (default)</span>
          <input
            type="number"
            min={1}
            max={999}
            value={planReps}
            onChange={(e) => setPlanReps(Number(e.target.value))}
          />
        </label>
        <button type="button" className="btn ghost" onClick={() => onApplyPlan(planSets, planReps)}>
          Update plan
        </button>
      </div>

      <p className="muted small">Log weight (kg or your unit—stored as a number) when you train. Leave blank if unknown.</p>

      <div className="sets-table-wrap">
        <table className="sets-table">
          <thead>
            <tr>
              <th>Set</th>
              <th>Reps</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {exercise.exercise_sets.map((s: ExerciseSet) => (
              <tr key={s.id}>
                <td>{s.set_index}</td>
                <td>
                  <input
                    className="input-tight"
                    type="number"
                    min={1}
                    max={999}
                    defaultValue={s.reps}
                    key={`${s.id}-reps-${s.reps}`}
                    onBlur={(e) => {
                      const n = Number(e.target.value)
                      if (!Number.isFinite(n)) {
                        e.target.value = String(s.reps)
                        return
                      }
                      onCommitReps(s.id, n)
                    }}
                  />
                </td>
                <td>
                  <input
                    className="input-tight"
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    defaultValue={initialWeights.get(s.id) ?? ''}
                    key={s.id + String(s.weight_kg)}
                    onBlur={(e) => onBlurWeight(s.id, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )
}
