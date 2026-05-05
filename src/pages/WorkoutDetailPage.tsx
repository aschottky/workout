import { useCallback, useEffect, useState, type FormEvent } from 'react'
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

  /** Local edits for weights/reps; synced from server when exercise rows change (keeps in-flight edits for existing set ids). */
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({})
  const [repsDraft, setRepsDraft] = useState<Record<string, string>>({})
  const [savingSetLog, setSavingSetLog] = useState(false)

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

  useEffect(() => {
    queueMicrotask(() => {
      setWeightDraft((prev) => {
        const next: Record<string, string> = {}
        for (const ex of exercises) {
          for (const s of ex.exercise_sets) {
            const fromServer = s.weight_kg == null ? '' : String(s.weight_kg)
            next[s.id] = Object.hasOwn(prev, s.id) ? prev[s.id] : fromServer
          }
        }
        return next
      })
      setRepsDraft((prev) => {
        const next: Record<string, string> = {}
        for (const ex of exercises) {
          for (const s of ex.exercise_sets) {
            const fromServer = String(s.reps)
            next[s.id] = Object.hasOwn(prev, s.id) ? prev[s.id] : fromServer
          }
        }
        return next
      })
    })
  }, [exercises])

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

  async function saveSetLog() {
    const client = supabase
    if (!client) return
    setSavingSetLog(true)
    setError(null)

    const rows: { id: string; reps: number; weight_kg: number | null }[] = []

    for (const ex of exercises) {
      for (const s of ex.exercise_sets) {
        const wStr = (weightDraft[s.id] ?? '').trim()
        const weight_kg = wStr === '' ? null : Number(wStr)
        if (wStr !== '' && Number.isNaN(weight_kg)) {
          setError(`Invalid weight for “${ex.name}”, set ${s.set_index}.`)
          setSavingSetLog(false)
          return
        }

        const rStr = (repsDraft[s.id] ?? '').trim()
        const reps = Math.floor(Number(rStr))
        if (!Number.isFinite(reps) || reps < 1 || reps > 999) {
          setError(`Invalid reps for “${ex.name}”, set ${s.set_index}.`)
          setSavingSetLog(false)
          return
        }

        const wSame =
          (weight_kg == null && s.weight_kg == null) ||
          (weight_kg != null &&
            s.weight_kg != null &&
            Number(weight_kg) === Number(s.weight_kg))
        if (reps !== s.reps || !wSame) {
          rows.push({ id: s.id, reps, weight_kg })
        }
      }
    }

    if (rows.length === 0) {
      setSavingSetLog(false)
      return
    }

    const results = await Promise.all(
      rows.map((row) =>
        client.from('exercise_sets').update({ reps: row.reps, weight_kg: row.weight_kg }).eq('id', row.id),
      ),
    )

    const firstErr = results.find((r) => r.error)?.error
    if (firstErr) {
      setError(firstErr.message)
      setSavingSetLog(false)
      return
    }

    setExercises((prev) =>
      prev.map((ex) => ({
        ...ex,
        exercise_sets: ex.exercise_sets.map((s) => {
          const u = rows.find((r) => r.id === s.id)
          return u ? { ...s, reps: u.reps, weight_kg: u.weight_kg } : s
        }),
      })),
    )

    setSavingSetLog(false)
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
      {workout.schedule_id && (
        <p className="muted small" style={{ marginTop: '-0.35rem', marginBottom: '0.75rem' }}>
          From recurring schedule —{' '}
          <Link to={`/schedule/${workout.schedule_id}`}>edit template</Link>
        </p>
      )}

      {exercises.length > 0 && (
        <Link to={`/workout/${workout.id}/train`} className="btn primary train-entry-btn">
          Log workout (step by step)
        </Link>
      )}

      <header className="page-header">
        <h1>{workout.workout_date}</h1>
        <div className="row">
          {exercises.length > 0 ? (
            <Link
              to={`/schedules/from-workout/${workout.id}`}
              className="btn ghost"
              title="Copy exercises into a weekly schedule"
            >
              Use as recurring template
            </Link>
          ) : (
            <span className="btn ghost" style={{ opacity: 0.45, cursor: 'not-allowed' }} title="Add at least one exercise first">
              Use as recurring template
            </span>
          )}
          <button type="button" className="btn danger ghost" onClick={() => void deleteWorkout()}>
            Delete workout
          </button>
        </div>
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
        <>
          <p className="muted small">
            Edit weights and reps here, then use <strong>Save set log</strong> once—nothing is sent until you save.
          </p>
          <div className="stack gap-lg">
            {exercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                weightDraft={weightDraft}
                repsDraft={repsDraft}
                onWeightChange={(setId, value) =>
                  setWeightDraft((d) => ({ ...d, [setId]: value }))
                }
                onRepsChange={(setId, value) => setRepsDraft((d) => ({ ...d, [setId]: value }))}
                onRemove={() => void removeExercise(ex.id)}
                onApplyPlan={(count, reps) => void applyPlan(ex, count, reps)}
              />
            ))}
          </div>
          <div className="save-set-log">
            <button type="button" className="btn primary" disabled={savingSetLog} onClick={() => void saveSetLog()}>
              {savingSetLog ? 'Saving…' : 'Save set log'}
            </button>
            <span className="muted small">Saves all weights and reps for this workout.</span>
          </div>
        </>
      )}
    </div>
  )
}

function ExerciseCard({
  exercise,
  weightDraft,
  repsDraft,
  onWeightChange,
  onRepsChange,
  onRemove,
  onApplyPlan,
}: {
  exercise: WorkoutExerciseWithSets
  weightDraft: Record<string, string>
  repsDraft: Record<string, string>
  onWeightChange: (setId: string, value: string) => void
  onRepsChange: (setId: string, value: string) => void
  onRemove: () => void
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

      <p className="muted small">
        Weight is a number (use the same unit every time). Reps and weight are saved when you click{' '}
        <strong>Save set log</strong> at the bottom.
      </p>

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
                    value={repsDraft[s.id] ?? String(s.reps)}
                    onChange={(e) => onRepsChange(s.id, e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="input-tight"
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={weightDraft[s.id] ?? ''}
                    onChange={(e) => onWeightChange(s.id, e.target.value)}
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
