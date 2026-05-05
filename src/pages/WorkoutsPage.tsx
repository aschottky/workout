import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Workout } from '../types'
import { useAuth } from '../auth/AuthContext'

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function WorkoutsPage() {
  const { user, signOut } = useAuth()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState(todayISO)
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', user.id)
      .order('workout_date', { ascending: false })
      .order('created_at', { ascending: false })

    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    setWorkouts((data as Workout[]) ?? [])
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!supabase || !user) return
    setCreating(true)
    setError(null)
    const { error: insErr } = await supabase.from('workouts').insert({
      user_id: user.id,
      workout_date: date,
      notes: notes.trim() || null,
    })
    setCreating(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    setNotes('')
    await load()
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Workouts</h1>
          <p className="muted">Plan exercises, sets, and reps—then log weight per set.</p>
        </div>
        <button type="button" className="btn ghost" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <section className="panel">
        <h2>New workout</h2>
        <form className="stack horizontal-md" onSubmit={onCreate}>
          <label className="field inline">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field grow">
            <span>Notes (optional)</span>
            <input
              type="text"
              placeholder="Leg day, hotel gym…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button type="submit" className="btn primary" disabled={creating}>
            {creating ? 'Saving…' : 'Create'}
          </button>
        </form>
      </section>

      {error && <p className="message error">{error}</p>}

      <section className="panel">
        <h2>Your days</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : workouts.length === 0 ? (
          <p className="muted">No workouts yet. Create one above.</p>
        ) : (
          <ul className="list">
            {workouts.map((w) => (
              <li key={w.id}>
                <Link to={`/workout/${w.id}`} className="list-link">
                  <span className="list-title">{w.workout_date}</span>
                  {w.notes && <span className="muted list-sub">{w.notes}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
