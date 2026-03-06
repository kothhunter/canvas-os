import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import Settings from './pages/Settings'

function RequireSetup({ children }: { children: JSX.Element }): JSX.Element {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    window.api
      ?.getSettings?.()
      .then((settings) => {
        setConfigured(!!settings.canvasToken && !!settings.vaultPath)
      })
      .catch(() => setConfigured(false))
  }, [location.pathname])

  if (configured === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!configured) {
    return <Navigate to="/settings" replace />
  }

  return children
}

export default function App(): JSX.Element {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-y-auto [-webkit-app-region:no-drag]">
        <Routes>
          <Route
            path="/"
            element={
              <RequireSetup>
                <Dashboard />
              </RequireSetup>
            }
          />
          <Route
            path="/courses"
            element={
              <RequireSetup>
                <Courses />
              </RequireSetup>
            }
          />
          <Route
            path="/course/:id"
            element={
              <RequireSetup>
                <CourseDetail />
              </RequireSetup>
            }
          />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
