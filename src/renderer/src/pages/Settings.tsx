import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, FolderOpen, Key, Save, CheckCircle2, Globe } from 'lucide-react'

export default function Settings(): JSX.Element {
  const [token, setToken] = useState('')
  const [canvasUrl, setCanvasUrl] = useState('https://canvas.instructure.com')
  const [vaultPath, setVaultPath] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api
      ?.getSettings?.()
      .then((settings) => {
        if (settings.canvasToken) setToken(settings.canvasToken as string)
        if (settings.canvasUrl) setCanvasUrl(settings.canvasUrl as string)
        if (settings.vaultPath) setVaultPath(settings.vaultPath as string)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSelectDir = async (): Promise<void> => {
    const dir = await window.api?.openDirectory?.()
    if (dir) setVaultPath(dir)
  }

  const handleSave = async (): Promise<void> => {
    await window.api?.setSetting?.('canvasToken', token)
    await window.api?.setSetting?.('canvasUrl', canvasUrl)
    await window.api?.setSetting?.('vaultPath', vaultPath)
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
        <p className="text-slate-400 mt-1">Configure your Canvas API connection and vault path.</p>
      </div>

      <div className="space-y-5">
        {/* Canvas URL */}
        <div className="group bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all duration-200">
          <label className="block text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-400" />
            Canvas URL
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Your institution's Canvas URL (e.g., https://school.instructure.com)
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
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Generate a personal access token from Canvas: Profile → Settings → New Access Token
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter your Canvas API token"
            className="w-full px-4 py-2.5 bg-slate-800/80 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500/50 transition-all"
          />
        </div>

        {/* Vault Path */}
        <div className="group bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all duration-200">
          <label className="block text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-emerald-400" />
            Vault Root Directory
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Where your course folders and lecture notes will be stored (Obsidian vault root).
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={vaultPath}
              readOnly
              placeholder="Select a directory..."
              className="flex-1 px-4 py-2.5 bg-slate-800/80 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600"
            />
            <button
              onClick={handleSelectDir}
              className="px-4 py-2.5 bg-slate-800/80 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-all duration-200 active:scale-[0.98]"
            >
              Browse
            </button>
          </div>
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
      </div>
    </div>
  )
}
