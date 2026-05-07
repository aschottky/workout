import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { WorkoutSchedule } from '../types'
import { useAuth } from '../auth/AuthContext'
import { WEEKDAY_ORDER, WEEKDAY_SHORT } from '../lib/weekdays'
import type { PresetInsertResult } from '../lib/presets/insertWorkoutSchedulePreset'
import type { SupabaseClient } from '@supabase/supabase-js'
import { insertLegTuesdayDbBandPreset } from '../lib/presets/legTuesdayDbBand'
import {
  insertHamsCalvesThursdayHomePreset,
  insertPullWednesdayHomePreset,
  insertTotalBodyFridayHomePreset,
} from '../lib/presets/wedThuFriHomePresets'

function formatWeekdays(ws: number[]) {
  const set = new Set(ws)
  return WEEKDAY_ORDER.filter((d) => set.has(d))
    .map((d) => WEEKDAY_SHORT[d])
    .join(', ')
}

export function SchedulesPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [rows, setRows] = useState<WorkoutSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [addingPresetKey, setAddingPresetKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('workout_schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    setRows((data as WorkoutSchedule[]) ?? [])
  }, [user])

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  async function createSchedule() {
    if (!supabase || !user) return
    setCreating(true)
    setError(null)
    const { data, error: insErr } = await supabase
      .from('workout_schedules')
      .insert({
        user_id: user.id,
        title: 'New recurring workout',
        weekdays: [1],
        notes: null,
        is_active: true,
      })
      .select('id')
      .single()

    setCreating(false)
    if (insErr || !data) {
      setError(insErr?.message ?? 'Could not create schedule.')
      return
    }
    navigate(`/schedule/${data.id}`)
  }

  async function runPreset(
    key: string,
    insertFn: (client: SupabaseClient, userId: string) => Promise<PresetInsertResult>,
  ) {
    if (!supabase || !user) return
    setAddingPresetKey(key)
    setError(null)
    const result = await insertFn(supabase, user.id)
    setAddingPresetKey(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await load()
    navigate(`/schedule/${result.scheduleId}`)
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Recurring schedules</h1>
          <p className="muted">
            Pick weekdays (e.g. every Monday). Add template exercises, then create workouts for a day or fill the
            current week.
          </p>
        </div>
        <div className="row">
          <Link to="/" className="btn ghost">
            Workouts
          </Link>
          <button type="button" className="btn ghost" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      {error && <p className="message error">{error}</p>}

      <section className="panel">
        <h2>Quick add</h2>
        <p className="muted small">
          One-tap recurring templates (home). Each creates a schedule on the matching weekday; edit or spawn workouts
          on the next screen. Weights you log when you train.
        </p>
        <div className="preset-quick-grid">
          <button
            type="button"
            className="btn primary preset-quick-btn"
            disabled={addingPresetKey !== null}
            onClick={() => void runPreset('tue', insertLegTuesdayDbBandPreset)}
          >
            {addingPresetKey === 'tue' ? 'Adding…' : 'Tue · Leg day — DB + band'}
          </button>
          <button
            type="button"
            className="btn primary preset-quick-btn"
            disabled={addingPresetKey !== null}
            onClick={() => void runPreset('wed', insertPullWednesdayHomePreset)}
          >
            {addingPresetKey === 'wed' ? 'Adding…' : 'Wed · Pull day (home)'}
          </button>
          <button
            type="button"
            className="btn primary preset-quick-btn"
            disabled={addingPresetKey !== null}
            onClick={() => void runPreset('thu', insertHamsCalvesThursdayHomePreset)}
          >
            {addingPresetKey === 'thu' ? 'Adding…' : 'Thu · Hams / calves (home)'}
          </button>
          <button
            type="button"
            className="btn primary preset-quick-btn"
            disabled={addingPresetKey !== null}
            onClick={() => void runPreset('fri', insertTotalBodyFridayHomePreset)}
          >
            {addingPresetKey === 'fri' ? 'Adding…' : 'Fri · Total body (home)'}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="row" style={{ justifyContent: 'space-between', width: '100%' }}>
          <h2 style={{ margin: 0 }}>Your schedules</h2>
          <button type="button" className="btn primary" disabled={creating} onClick={() => void createSchedule()}>
            {creating ? 'Adding…' : 'New schedule'}
          </button>
        </div>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="muted">No schedules yet. Create one to repeat on chosen weekdays.</p>
        ) : (
          <ul className="list">
            {rows.map((s) => (
              <li key={s.id}>
                <Link to={`/schedule/${s.id}`} className="list-link">
                  <span className="list-title">{s.title}</span>
                  <span className="muted list-sub">{formatWeekdays(s.weekdays)}</span>
                  {!s.is_active && <span className="muted list-sub">Paused</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
