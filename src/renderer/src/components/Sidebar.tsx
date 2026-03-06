import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  GraduationCap,
  Settings,
  RefreshCw,
  BookOpen,
  Loader2
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/courses', icon: GraduationCap, label: 'Courses' },
  { to: '/settings', icon: Settings, label: 'Settings' }
]

export default function Sidebar(): JSX.Element {
  const location = useLocation()
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [aiProcessing, setAiProcessing] = useState(false)
  const [aiStatusMsg, setAiStatusMsg] = useState('')

  useEffect(() => {
    window.api?.getLastSync?.().then(setLastSync).catch(() => {})
  }, [])

  // Listen for AI progress events
  useEffect(() => {
    const handler = (_event: unknown, data: unknown): void => {
      const d = data as { status: string; message: string }
      if (d.status === 'complete' || d.status === 'error') {
        setAiStatusMsg(d.status === 'complete' ? 'Notes saved!' : d.message)
        setAiProcessing(false)
        const timer = setTimeout(() => setAiStatusMsg(''), 3000)
        return () => clearTimeout(timer)
      } else {
        setAiProcessing(true)
        setAiStatusMsg(d.message)
      }
    }
    window.api?.onAiProgress?.(handler)
    return (): void => { window.api?.offAiProgress?.() }
  }, [])

  const handleSync = async (): Promise<void> => {
    setSyncing(true)
    try {
      await window.api?.syncNow?.()
      const sync = await window.api?.getLastSync?.()
      setLastSync(sync)
    } catch {
      // handled elsewhere
    } finally {
      setSyncing(false)
    }
  }

  const formatSyncTime = (iso: string | null): string => {
    if (!iso) return 'Never synced'
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    return `${hrs}h ago`
  }

  return (
    <aside className="w-64 flex-shrink-0 h-screen flex flex-col bg-white/5 backdrop-blur-md border-r border-white/10 [-webkit-app-region:drag]">
      {/* App title - drag region */}
      <div className="pt-8 pb-6 px-6" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-slate-50">Canvas</h1>
            <p className="text-[11px] text-slate-500 -mt-0.5">Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 [-webkit-app-region:no-drag] ${
                isActive
                  ? 'bg-white/10 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* Sync status & AI processing */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-200 disabled:opacity-50 [-webkit-app-region:no-drag]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing...' : `Last synced: ${formatSyncTime(lastSync)}`}</span>
          {!syncing && lastSync && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </button>

        {(aiProcessing || aiStatusMsg) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-green-400 bg-green-500/10 [-webkit-app-region:no-drag]">
            {aiProcessing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
            )}
            <span className="truncate">{aiStatusMsg}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
