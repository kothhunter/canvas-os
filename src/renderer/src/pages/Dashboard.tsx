import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar, ExternalLink, Clock, CheckCircle2, AlertTriangle, Filter, Plus, X,
  Upload, Mic, Loader2, CheckCircle, AlertCircle, Cpu
} from 'lucide-react'

interface Assignment {
  id: number
  course_id: number
  course_name: string
  course_code: string
  name: string
  due_at: string | null
  points_possible: number | null
  status: string
  html_url: string
}

type StatusFilter = 'all' | 'pending' | 'submitted' | 'graded' | 'overdue'
type DueFilter = 'all' | 'today' | 'week' | 'month'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'graded', label: 'Graded' },
  { value: 'overdue', label: 'Overdue' }
]

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Due Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' }
]

function getStatusStyle(status: string): string {
  switch (status) {
    case 'submitted':
    case 'graded':
      return 'bg-green-500/10 text-green-400'
    case 'upcoming':
      return 'bg-sky-500/10 text-sky-400'
    case 'overdue':
      return 'bg-rose-500/10 text-rose-400'
    default:
      return 'bg-amber-500/10 text-amber-400'
  }
}

function getStatusIcon(status: string): JSX.Element {
  switch (status) {
    case 'submitted':
    case 'graded':
      return <CheckCircle2 className="w-3.5 h-3.5" />
    case 'overdue':
      return <AlertTriangle className="w-3.5 h-3.5" />
    default:
      return <Clock className="w-3.5 h-3.5" />
  }
}

function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date'
  const d = new Date(iso)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days <= 7) return `Due in ${days} days`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function sortPriority(status: string): number {
  if (status === 'overdue') return 2
  if (status === 'submitted' || status === 'graded') return 1
  return 0 // pending / upcoming
}

function isDueInRange(dueAt: string | null, range: DueFilter): boolean {
  if (range === 'all') return true
  if (!dueAt) return false
  const due = new Date(dueAt)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)

  switch (range) {
    case 'today':
      return due >= startOfToday && due < endOfToday
    case 'week':
      return due >= startOfToday && due < new Date(startOfToday.getTime() + 7 * 24 * 60 * 60 * 1000)
    case 'month':
      return due >= startOfToday && due < new Date(startOfToday.getTime() + 30 * 24 * 60 * 60 * 1000)
    default:
      return true
  }
}

export default function Dashboard(): JSX.Element {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')

  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteCourseId, setNoteCourseId] = useState<number | ''>('')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // AI Processing state
  const [noteTab, setNoteTab] = useState<'manual' | 'ai'>('manual')
  const [audioPath, setAudioPath] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [aiMessage, setAiMessage] = useState('')
  const [aiProgress, setAiProgress] = useState<number | undefined>(undefined)
  const [processing, setProcessing] = useState(false)
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    window.api
      ?.getAssignments?.()
      .then((data) => setAssignments(data as Assignment[]))
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const courseOptions = useMemo(() => {
    const codes = [...new Set(assignments.map((a) => a.course_code))].sort()
    return codes
  }, [assignments])

  const activeCourses = useMemo(() => {
    const map = new Map<number, { id: number; code: string; name: string }>()
    assignments.forEach(a => {
      if (!map.has(a.course_id)) {
        map.set(a.course_id, { id: a.course_id, code: a.course_code, name: a.course_name })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [assignments])

  // Check Ollama when AI tab is selected
  useEffect(() => {
    if (noteTab === 'ai' && ollamaAvailable === null) {
      window.api?.checkOllama?.().then((result) => {
        setOllamaAvailable(result.available)
      }).catch(() => setOllamaAvailable(false))
    }
  }, [noteTab])

  // Listen for AI progress events
  useEffect(() => {
    const handler = (_event: unknown, data: unknown): void => {
      const d = data as { status: string; message: string; progress?: number }
      setAiStatus(d.status)
      setAiMessage(d.message)
      setAiProgress(d.progress)
      if (d.status === 'complete' || d.status === 'error') {
        setProcessing(false)
      }
    }
    window.api?.onAiProgress?.(handler)
    return (): void => { window.api?.offAiProgress?.() }
  }, [])

  const handleSelectAudio = async (): Promise<void> => {
    const path = await window.api?.selectAudioFile?.()
    if (path) setAudioPath(path)
  }

  const handleProcessAudio = async (): Promise<void> => {
    if (!audioPath || !noteCourseId || !noteTitle.trim()) return
    setProcessing(true)
    setAiStatus('preparing')
    setAiMessage('Starting...')
    try {
      const result = await window.api?.processLecture?.(
        audioPath, Number(noteCourseId), noteTitle, noteDate
      )
      if (result?.success) {
        setAiStatus('complete')
        setAiMessage('Notes saved to vault!')
      }
    } catch (err: unknown) {
      setAiStatus('error')
      setAiMessage(err instanceof Error ? err.message : 'Processing failed')
    }
  }

  const handleSaveNote = async (): Promise<void> => {
    if (!noteTitle.trim() || !noteContent.trim() || !noteCourseId) return
    setSavingNote(true)
    try {
      await window.api?.saveNote?.(Number(noteCourseId), noteTitle, noteContent, noteDate)
      setShowNoteEditor(false)
      setNoteTitle('')
      setNoteContent('')
      setNoteCourseId('')
    } catch {
      // handled
    } finally {
      setSavingNote(false)
    }
  }

  const filteredAndSorted = useMemo(() => {
    let filtered = assignments

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter)
    }

    // Course filter
    if (courseFilter !== 'all') {
      filtered = filtered.filter((a) => a.course_code === courseFilter)
    }

    // Due date range filter
    if (dueFilter !== 'all') {
      filtered = filtered.filter((a) => isDueInRange(a.due_at, dueFilter))
    }

    // Sort: pending (soonest due) → submitted/graded → overdue (at bottom)
    return [...filtered].sort((a, b) => {
      const pa = sortPriority(a.status)
      const pb = sortPriority(b.status)
      if (pa !== pb) return pa - pb

      // Within same priority group, sort by due date ascending (nulls last)
      const da = a.due_at ? new Date(a.due_at).getTime() : Infinity
      const db = b.due_at ? new Date(b.due_at).getTime() : Infinity
      return da - db
    })
  }, [assignments, statusFilter, courseFilter, dueFilter])

  const upcoming = assignments.filter(
    (a) => a.status !== 'submitted' && a.status !== 'graded'
  )
  const dueThisWeek = upcoming.filter((a) => {
    if (!a.due_at) return false
    const diff = new Date(a.due_at).getTime() - Date.now()
    return diff > 0 && diff < 7 * 24 * 60 * 60 * 1000
  })

  const hasActiveFilters = statusFilter !== 'all' || courseFilter !== 'all' || dueFilter !== 'all'

  return (
    <div className="p-8 lg:p-10 max-w-6xl w-full flex-1 flex flex-col">
      {/* Hero Section */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {getGreeting()},{' '}
          <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Hunter
          </span>
        </h1>
        <p className="text-slate-400 mt-1">
          {dueThisWeek.length > 0
            ? `You have ${dueThisWeek.length} assignment${dueThisWeek.length > 1 ? 's' : ''} due this week.`
            : loading
              ? 'Loading your assignments...'
              : 'No assignments due this week. Nice!'}
        </p>
      </div>

      {/* Summary Stats - Bento Grid */}
      {!loading && assignments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-4 hover:border-white/20 transition-all duration-200 cursor-default">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-slate-200 mt-1">{assignments.length}</p>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-4 hover:border-white/20 transition-all duration-200 cursor-default">
            <p className="text-[11px] font-medium text-amber-500/80 uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-bold text-amber-400 mt-1">
              {assignments.filter(a => a.status !== 'submitted' && a.status !== 'graded' && a.status !== 'overdue').length}
            </p>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-4 hover:border-white/20 transition-all duration-200 cursor-default">
            <p className="text-[11px] font-medium text-green-500/80 uppercase tracking-wider">Completed</p>
            <p className="text-2xl font-bold text-green-400 mt-1">
              {assignments.filter(a => a.status === 'submitted' || a.status === 'graded').length}
            </p>
          </div>
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-xl border border-white/10 p-4 hover:border-white/20 transition-all duration-200 cursor-default">
            <p className="text-[11px] font-medium text-rose-500/80 uppercase tracking-wider">Overdue</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">
              {assignments.filter(a => a.status === 'overdue').length}
            </p>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {!loading && assignments.length > 0 && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 p-3 rounded-xl border border-white/10">
          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-4 h-4 text-slate-500 ml-1 flex-shrink-0" />

            {/* Course Select */}
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="bg-slate-800/80 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
            >
              <option value="all">All Courses</option>
              {courseOptions.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>

            {/* Status Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-slate-800/80 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>Status: {opt.label}</option>
              ))}
            </select>

            {/* Due Date Select */}
            <select
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value as DueFilter)}
              className="bg-slate-800/80 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
            >
              {DUE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>Due: {opt.label}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setCourseFilter('all')
                  setDueFilter('all')
                }}
                className="text-[11px] text-slate-500 hover:text-green-400 transition-colors whitespace-nowrap px-2"
              >
                Clear all
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 pr-2">
            <span className="text-[11px] text-slate-500 whitespace-nowrap">
              Showing {filteredAndSorted.length} assignments
            </span>
            <button
              onClick={() => setShowNoteEditor(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Note
            </button>
          </div>
        </div>
      )}

      {/* Assignments table */}
      <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 flex flex-col flex-1 min-h-0">
        <div className="px-6 py-4 border-b border-white/5 flex-shrink-0">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Assignments
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-16 text-center text-slate-500">
            <div className="w-6 h-6 border-2 border-slate-700 border-t-green-500 rounded-full animate-spin mx-auto mb-3" />
            Loading assignments...
          </div>
        ) : assignments.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500">
            <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No assignments yet</p>
            <p className="text-sm mt-1">
              Head to{' '}
              <Link to="/settings" className="text-green-400 hover:underline">
                Settings
              </Link>{' '}
              to configure your Canvas token and sync.
            </p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            <Filter className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No assignments match your filters.</p>
          </div>
        ) : (
          <div className="relative flex-1">
            <div className="absolute inset-0 overflow-y-auto p-0 border-t border-white/5">
              <table className="w-full table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-900 border-b border-white/5 shadow-sm">
                  <tr className="text-xs text-slate-500 uppercase tracking-wider">
                    <th className="w-[40%] px-6 py-3 text-left font-medium">Assignment</th>
                    <th className="w-[15%] px-4 py-3 text-left font-medium">Course</th>
                    <th className="w-[14%] px-4 py-3 text-left font-medium">Due</th>
                    <th className="w-[9%] px-4 py-3 text-left font-medium">Points</th>
                    <th className="w-[14%] px-4 py-3 text-left font-medium">Status</th>
                    <th className="w-[8%] px-4 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAndSorted.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                    >
                      <td className="px-6 py-3.5">
                        <span className="text-sm font-medium text-slate-200 block truncate" title={a.name}>
                          {a.name}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium px-2 py-1 rounded-md bg-white/5 text-slate-400 max-w-[140px] truncate inline-block align-bottom">
                          {a.course_code}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400 whitespace-nowrap">
                        {formatDueDate(a.due_at)}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-slate-400">
                        {a.points_possible ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${getStatusStyle(a.status)}`}
                        >
                          {getStatusIcon(a.status)}
                          {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {a.html_url && (
                          <a
                            href={a.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-green-400 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Global Note Editor Modal (accessible from Dashboard) */}
      {showNoteEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-slate-50">New Lecture Note</h3>
              <button
                onClick={() => setShowNoteEditor(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setNoteTab('manual')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  noteTab === 'manual'
                    ? 'text-green-400 border-b-2 border-green-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setNoteTab('ai')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  noteTab === 'ai'
                    ? 'text-green-400 border-b-2 border-green-400'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5" />
                  AI Process
                </span>
              </button>
            </div>

            {/* Manual Entry tab */}
            {noteTab === 'manual' && (
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Course</label>
                    <select
                      value={noteCourseId}
                      onChange={(e) => setNoteCourseId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all cursor-pointer"
                    >
                      <option value="" disabled>Select course</option>
                      {activeCourses.map((c) => (
                        <option key={c.id} value={c.id}>{c.code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="e.g., Intro to Databases"
                      className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={noteDate}
                      onChange={(e) => setNoteDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Markdown Content
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Paste your lecture notes here..."
                    rows={12}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all font-mono resize-none"
                  />
                </div>
              </div>
            )}

            {/* AI Process tab */}
            {noteTab === 'ai' && (
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Course</label>
                    <select
                      value={noteCourseId}
                      onChange={(e) => setNoteCourseId(e.target.value ? Number(e.target.value) : '')}
                      disabled={processing}
                      className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <option value="" disabled>Select course</option>
                      {activeCourses.map((c) => (
                        <option key={c.id} value={c.id}>{c.code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      disabled={processing}
                      placeholder="e.g., Intro to Databases"
                      className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all disabled:opacity-50"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={noteDate}
                      onChange={(e) => setNoteDate(e.target.value)}
                      disabled={processing}
                      className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Audio file selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Audio File</label>
                  <button
                    onClick={handleSelectAudio}
                    disabled={processing}
                    className="w-full flex items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-white/10 rounded-xl hover:border-green-500/50 hover:bg-green-500/5 transition-all text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:hover:border-white/10 disabled:hover:bg-transparent"
                  >
                    {audioPath ? (
                      <>
                        <Mic className="w-5 h-5 text-green-400" />
                        <span className="text-sm truncate max-w-md">{audioPath.split('/').pop()}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        <span className="text-sm">Click to select audio file (m4a, mp3, wav)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Ollama status warning */}
                {ollamaAvailable === false && (
                  <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-300">Ollama not detected</p>
                      <p className="text-xs text-amber-400/70 mt-1">
                        Install Ollama from{' '}
                        <span className="font-medium">ollama.com</span> and run:{' '}
                        <code className="bg-amber-500/10 px-1 py-0.5 rounded">ollama pull llama3:8b</code>
                      </p>
                    </div>
                  </div>
                )}

                {/* Processing progress */}
                {processing && (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <Loader2 className="w-5 h-5 text-green-400 animate-spin flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-300">{aiMessage}</p>
                      {aiProgress !== undefined && (
                        <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                          <div
                            className="bg-green-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${aiProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Completion state */}
                {aiStatus === 'complete' && !processing && (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="text-sm text-green-300">Notes generated and saved to your vault!</p>
                  </div>
                )}

                {/* Error state */}
                {aiStatus === 'error' && !processing && (
                  <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                    <p className="text-sm text-rose-300">{aiMessage}</p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setShowNoteEditor(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                {processing ? 'Dismiss' : 'Cancel'}
              </button>
              {noteTab === 'manual' && (
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteTitle.trim() || !noteContent.trim() || !noteCourseId}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingNote ? 'Saving...' : 'Save to Vault'}
                </button>
              )}
              {noteTab === 'ai' && (
                <button
                  onClick={handleProcessAudio}
                  disabled={processing || !audioPath || !noteCourseId || !noteTitle.trim() || ollamaAvailable === false}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Cpu className="w-4 h-4" />
                      Process Audio
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
