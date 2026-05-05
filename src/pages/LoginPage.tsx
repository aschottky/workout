import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { supabaseConfigured } from '../lib/supabase'

export function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (loading) {
    return <p className="muted">Checking session…</p>
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setPending(true)
    const fn = mode === 'signin' ? signIn : signUp
    const { error } = await fn(email.trim(), password)
    setPending(false)
    if (error) setMessage(error)
    else if (mode === 'signup') {
      setMessage('Check your email to confirm the account, then sign in.')
    }
  }

  if (!supabaseConfigured) {
    return (
      <section className="panel">
        <h1>Configuration</h1>
        <p className="muted">
          Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>{' '}
          to a <code>.env</code> file (see <code>.env.example</code>), then restart the dev server.
        </p>
      </section>
    )
  }

  return (
    <section className="panel narrow">
      <h1>Workout log</h1>
      <p className="muted">Sign in to sync workouts with Supabase.</p>
      <form className="stack" onSubmit={onSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && <p className="message">{message}</p>}
        <div className="row">
          <button type="submit" className="btn primary" disabled={pending}>
            {pending ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin')
              setMessage(null)
            }}
          >
            {mode === 'signin' ? 'Need an account?' : 'Have an account?'}
          </button>
        </div>
      </form>
    </section>
  )
}
