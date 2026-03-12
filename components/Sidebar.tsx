'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, GraduationCap, Settings, RefreshCw, BookOpen, LogOut } from 'lucide-react'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/courses', icon: GraduationCap, label: 'Courses' },
  { to: '/settings', icon: Settings, label: 'Settings' }
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/sync/last')
      .then((r) => r.json())
      .then((d) => setLastSync(d.lastSync))
      .catch(() => {})
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/sync', { method: 'POST' })
      const data = await fetch('/api/sync/last').then((r) => r.json())
      setLastSync(data.lastSync)
    } catch {
      // handled
    } finally {
      setSyncing(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
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
    <aside className="w-64 flex-shrink-0 h-screen flex flex-col bg-white/5 backdrop-blur-md border-r border-white/10">
      {/* App title */}
      <div className="pt-8 pb-6 px-6">
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
            item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              href={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-white/10 text-slate-50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sync status + sign out */}
      <div className="p-4 border-t border-white/10 space-y-1">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-200 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Syncing...' : `Last synced: ${formatSyncTime(lastSync)}`}</span>
          {!syncing && lastSync && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-400 hover:bg-white/5 transition-all duration-200"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}
