'use client'

import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Key, Save, CheckCircle2, Globe } from 'lucide-react'

export default function SettingsPage() {
  const [token, setToken] = useState('')
  const [canvasUrl, setCanvasUrl] = useState('https://canvas.instructure.com')
  const [hasToken, setHasToken] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        setHasToken(data.hasCanvasToken)
        if (data.canvas_url) setCanvasUrl(data.canvas_url)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    const body: Record<string, string> = { canvas_url: canvasUrl }
    if (token.trim()) body.canvas_token = token.trim()

    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (token.trim()) setHasToken(true)
    setToken('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 lg:p-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-slate-500" />
          <span className="bg-gradient-to-r from-slate-200 to-slate-400 bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
        <p className="text-slate-400 mt-1">Configure your Canvas API connection.</p>
      </div>

      <div className="space-y-5">
        {/* Canvas URL */}
        <div className="group bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all duration-200">
          <label className="block text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            Canvas URL
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Your institution&apos;s Canvas URL (e.g., https://school.instructure.com)
          </p>
          <input
            type="url"
            value={canvasUrl}
            onChange={(e) => setCanvasUrl(e.target.value)}
            placeholder="https://canvas.instructure.com"
            className="w-full px-4 py-2.5 bg-slate-800/80 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500/50 transition-all"
          />
        </div>

        {/* Canvas Token */}
        <div className="group bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all duration-200">
          <label className="block text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            Canvas API Token
            {hasToken && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Configured
              </span>
            )}
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Generate a personal access token from Canvas: Profile → Settings → New Access Token.{' '}
            {hasToken && 'Leave blank to keep the existing token.'}
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? 'Enter new token to replace existing...' : 'Enter your Canvas API token'}
            className="w-full px-4 py-2.5 bg-slate-800/80 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500/50 transition-all"
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 active:scale-[0.98] ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20'
          }`}
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Settings
            </>
          )}
        </button>

        {!hasToken && (
          <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
            Canvas API token is required. After saving, use the sync button in the sidebar to load
            your courses and assignments.
          </p>
        )}
      </div>
    </div>
  )
}
