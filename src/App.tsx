import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { WorkoutsPage } from './pages/WorkoutsPage'
import { WorkoutDetailPage } from './pages/WorkoutDetailPage'
import { SchedulesPage } from './pages/SchedulesPage'
import { ScheduleDetailPage } from './pages/ScheduleDetailPage'
import { ScheduleFromWorkoutPage } from './pages/ScheduleFromWorkoutPage'
import { TrainWorkoutPage } from './pages/TrainWorkoutPage'

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="shell">
        <p className="muted">Checking session…</p>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
}

export default function App() {
  const location = useLocation()
  const trainMode = /\/workout\/[^/]+\/train$/.test(location.pathname)

  return (
    <div className={trainMode ? 'shell shell--train' : 'shell'}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <Protected>
              <WorkoutsPage />
            </Protected>
          }
        />
        <Route
          path="/workout/:id/train"
          element={
            <Protected>
              <TrainWorkoutPage />
            </Protected>
          }
        />
        <Route
          path="/workout/:id"
          element={
            <Protected>
              <WorkoutDetailPage />
            </Protected>
          }
        />
        <Route
          path="/schedules"
          element={
            <Protected>
              <SchedulesPage />
            </Protected>
          }
        />
        <Route
          path="/schedules/from-workout/:workoutId"
          element={
            <Protected>
              <ScheduleFromWorkoutPage />
            </Protected>
          }
        />
        <Route
          path="/schedule/:id"
          element={
            <Protected>
              <ScheduleDetailPage />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
