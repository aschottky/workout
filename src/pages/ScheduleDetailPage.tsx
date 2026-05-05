import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ScheduleExercise, WorkoutSchedule } from '../types'
import { useAuth } from '../auth/AuthContext'
import {
  WEEKDAY_ORDER,
  WEEKDAY_SHORT,
  datesThisWeekMatching,
  nextDateMatchingWeekdays,
} from '../lib/weekdays'
import { spawnWorkoutFromSchedule } from '../lib/spawnFromSchedule'

function isUniqueViolation(code?: string, message?: string) {
  return code === '23505' || (message?.toLowerCase().includes('duplicate') ?? false)
}

export function ScheduleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [schedule, setSchedule] = useState<WorkoutSchedule | null>(null)
  const [exercises, setExercises] = useState<ScheduleExercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [weekdays, setWeekdays] = useState<number[]>([1])
  const [isActive, setIsActive] = useState(true)
  const [savingMeta, setSavingMeta] = useState(false)

  const [exName, setExName] = useState('')
  const [exSets, setExSets] = useState(3)
  const [exReps, setExReps] = useState(10)
  const [adding, setAdding] = useState(false)

  const [spawnDate, setSpawnDate] = useState('')
  const [spawning, setSpawning] = useState(false)
  const [fillingWeek, setFillingWeek] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !user || !id) return
    setLoading(true)
    setError(null)
    setInfo(null)

    const { data: sch, error: sErr } = await supabase
      .from('workout_schedules')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sErr || !sch) {
      setLoading(false)
      setError(sErr?.message ?? 'Schedule not found.')
      setSchedule(null)
      setExercises([])
      return
    }

    const row = sch as WorkoutSchedule
    const wd = Array.isArray(row.weekdays) ? row.weekdays.map(Number).filter((n) => n >= 0 && n <= 6) : [1]
    setSchedule(row)
    setTitle(row.title)
    setNotes(row.notes ?? '')
    setWeekdays(wd.length ? [...new Set(wd)].sort((a, b) => a - b) : [1])
    setIsActive(row.is_active)
    setSpawnDate(nextDateMatchingWeekdays(wd.length ? wd : [1]))

    const { data: ex, error: exErr } = await supabase
      .from('schedule_exercises')
      .select('*')
      .eq('schedule_id', id)
      .order('sort_order', { ascending: true })

    setLoading(false)
    if (exErr) {
      setError(exErr.message)
      return
    }
    setExercises((ex as ScheduleExercise[]) ?? [])
  }, [id, user])

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

  async function saveSchedule(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !schedule) return
    if (weekdays.length === 0) {
      setError('Pick at least one weekday.')
      return
    }
    setSavingMeta(true)
    setError(null)
    const { error: uErr } = await supabase
      .from('workout_schedules')
      .update({
        title: title.trim() || 'Untitled',
        notes: notes.trim() || null,
        weekdays,
        is_active: isActive,
      })
      .eq('id', schedule.id)

    setSavingMeta(false)
    if (uErr) {
      setError(uErr.message)
      return
    }
    await load()
  }

  async function deleteSchedule() {
    if (!supabase || !schedule) return
    if (!confirm('Delete this schedule? Workouts already created from it stay on your calendar.')) return
    const { error: dErr } = await supabase.from('workout_schedules').delete().eq('id', schedule.id)
    if (dErr) {
      setError(dErr.message)
      return
    }
    navigate('/schedules')
  }

  async function addExercise(ev: FormEvent) {
    ev.preventDefault()
    if (!supabase || !schedule || !exName.trim()) return
    setAdding(true)
    setError(null)
    const nextOrder =
      exercises.length === 0 ? 0 : Math.max(...exercises.map((x) => x.sort_order)) + 1
    const { error: insErr } = await supabase.from('schedule_exercises').insert({
      schedule_id: schedule.id,
      name: exName.trim(),
      sort_order: nextOrder,
      sets_count: Math.max(1, Math.min(50, Math.floor(exSets))),
      reps_per_set: Math.max(1, Math.min(999, Math.floor(exReps))),
    })
    setAdding(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setExName('')
    setExSets(3)
    setExReps(10)
    await load()
  }

  async function removeExercise(exerciseId: string) {
    if (!supabase) return
    if (!confirm('Remove this template exercise?')) return
    const { error: dErr } = await supabase.from('schedule_exercises').delete().eq('id', exerciseId)
    if (dErr) setError(dErr.message)
    else await load()
  }

  async function updateTemplateExercise(
    exerciseId: string,
    patch: Partial<Pick<ScheduleExercise, 'name' | 'sets_count' | 'reps_per_set'>>,
  ) {
    if (!supabase) return
    const { error: uErr } = await supabase.from('schedule_exercises').update(patch).eq('id', exerciseId)
    if (uErr) setError(uErr.message)
    else await load()
  }

  async function createWorkoutForDate() {
    const client = supabase
    if (!client || !user || !schedule || exercises.length === 0) {
      setError('Add at least one template exercise before creating a workout.')
      return
    }
    setSpawning(true)
    setError(null)
    setInfo(null)

    const result = await spawnWorkoutFromSchedule(
      client,
      {
        userId: user.id,
        scheduleId: schedule.id,
        workoutDate: spawnDate,
        scheduleTitle: schedule.title,
        scheduleNotes: schedule.notes,
        exercises: exercises.map((e) => ({
          name: e.name,
          sort_order: e.sort_order,
          sets_count: e.sets_count,
          reps_per_set: e.reps_per_set,
        })),
      },
    )

    setSpawning(false)
    if (!result.ok) {
      if (isUniqueViolation(result.code, result.error)) {
        setError('A workout from this schedule already exists on that date.')
      } else {
        setError(result.error)
      }
      return
    }
    setInfo('Workout created. Opening it…')
    navigate(`/workout/${result.workoutId}`)
  }

  async function fillThisWeek() {
    const client = supabase
    if (!client || !user || !schedule || exercises.length === 0) {
      setError('Add at least one template exercise first.')
      return
    }
    setFillingWeek(true)
    setError(null)
    setInfo(null)

    const dates = datesThisWeekMatching(weekdays)
    let created = 0
    let skipped = 0

    const template = exercises.map((e) => ({
      name: e.name,
      sort_order: e.sort_order,
      sets_count: e.sets_count,
      reps_per_set: e.reps_per_set,
    }))

    for (const workoutDate of dates) {
      const result = await spawnWorkoutFromSchedule(client, {
        userId: user.id,
        scheduleId: schedule.id,
        workoutDate,
        scheduleTitle: schedule.title,
        scheduleNotes: schedule.notes,
        exercises: template,
      })
      if (result.ok) created++
      else if (isUniqueViolation(result.code, result.error)) skipped++
      else {
        setError(result.error)
        setFillingWeek(false)
        return
      }
    }

    setFillingWeek(false)
    setInfo(
      dates.length === 0
        ? 'No matching days left this week (Mon–Sun) for this schedule.'
        : `Created ${created} workout(s). Skipped ${skipped} that already existed.`,
    )
  }

  if (loading) {
    return <p className="muted">Loading schedule…</p>
  }

  if (!schedule) {
    return (
      <div className="page">
        <p className="message error">{error ?? 'Not found.'}</p>
        <Link to="/schedules" className="btn ghost">
          Back to schedules
        </Link>
      </div>
    )
  }

  return (
    <div className="page">
      <nav className="breadcrumb">
        <Link to="/schedules">Schedules</Link>
        <span aria-hidden="true"> / </span>
        <span>{title || 'Schedule'}</span>
      </nav>

      <header className="page-header">
        <h1>{title || 'Schedule'}</h1>
        <button type="button" className="btn danger ghost" onClick={() => void deleteSchedule()}>
          Delete schedule
        </button>
      </header>

      {error && <p className="message error">{error}</p>}
      {info && <p className="message">{info}</p>}

      <section className="panel">
        <h2>Repeat on</h2>
        <p className="muted small">Uses your browser&apos;s local timezone. Week starts Monday for &quot;this week&quot;.</p>
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
        <form className="stack" style={{ marginTop: '1rem' }} onSubmit={saveSchedule}>
          <label className="field">
            <span>Title</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Leg day template…" />
          </label>
          <label className="field inline">
            <span>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
            </span>
          </label>
          <button type="submit" className="btn primary" disabled={savingMeta}>
            {savingMeta ? 'Saving…' : 'Save schedule'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Create workouts from template</h2>
        <p className="muted small">
          Next suggested day: <strong>{nextDateMatchingWeekdays(weekdays)}</strong>. Pick a date to create one session
          (exercises copy over; weights stay empty until you log them).
        </p>
        <div className="stack horizontal-md wrap">
          <label className="field inline">
            <span>Date</span>
            <input type="date" value={spawnDate} onChange={(e) => setSpawnDate(e.target.value)} />
          </label>
          <button type="button" className="btn primary" disabled={spawning} onClick={() => void createWorkoutForDate()}>
            {spawning ? 'Creating…' : 'Create workout for date'}
          </button>
          <button type="button" className="btn ghost" disabled={fillingWeek} onClick={() => void fillThisWeek()}>
            {fillingWeek ? 'Working…' : 'Fill this week (Mon–Sun)'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Template exercises</h2>
        <p className="muted small">These exercises are copied each time you create a workout from this schedule.</p>
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
            <input type="number" min={1} max={50} value={exSets} onChange={(e) => setExSets(Number(e.target.value))} />
          </label>
          <label className="field inline">
            <span>Reps</span>
            <input type="number" min={1} max={999} value={exReps} onChange={(e) => setExReps(Number(e.target.value))} />
          </label>
          <button type="submit" className="btn primary" disabled={adding}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>

        {exercises.length === 0 ? (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            No template exercises yet.
          </p>
        ) : (
          <ul className="template-ex-list">
            {exercises.map((ex) => (
              <li key={ex.id} className="template-ex-row">
                <TemplateExerciseRow exercise={ex} onRemove={() => void removeExercise(ex.id)} onSave={updateTemplateExercise} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="muted small">
        <Link to="/">← Workouts</Link>
      </p>
    </div>
  )
}

function TemplateExerciseRow({
  exercise,
  onRemove,
  onSave,
}: {
  exercise: ScheduleExercise
  onRemove: () => void
  onSave: (id: string, patch: Partial<Pick<ScheduleExercise, 'name' | 'sets_count' | 'reps_per_set'>>) => void
}) {
  const [name, setName] = useState(exercise.name)
  const [sets, setSets] = useState(exercise.sets_count)
  const [reps, setReps] = useState(exercise.reps_per_set)

  useEffect(() => {
    queueMicrotask(() => {
      setName(exercise.name)
      setSets(exercise.sets_count)
      setReps(exercise.reps_per_set)
    })
  }, [exercise.id, exercise.name, exercise.sets_count, exercise.reps_per_set])

  function save() {
    const n = name.trim() || exercise.name
    const sc = Math.max(1, Math.min(50, Math.floor(sets)))
    const rp = Math.max(1, Math.min(999, Math.floor(reps)))
    if (n === exercise.name && sc === exercise.sets_count && rp === exercise.reps_per_set) return
    void onSave(exercise.id, { name: n, sets_count: sc, reps_per_set: rp })
  }

  return (
    <div className="template-ex-grid">
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
      <label className="field inline tight">
        <span>Sets</span>
        <input
          className="input-tight"
          type="number"
          min={1}
          max={50}
          value={sets}
          onChange={(e) => setSets(Number(e.target.value))}
          onBlur={save}
        />
      </label>
      <label className="field inline tight">
        <span>Reps</span>
        <input
          className="input-tight"
          type="number"
          min={1}
          max={999}
          value={reps}
          onChange={(e) => setReps(Number(e.target.value))}
          onBlur={save}
        />
      </label>
      <button type="button" className="btn ghost small" onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}
