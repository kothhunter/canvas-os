import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  FileText,
  Plus,
  FolderOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
  Upload,
  Mic,
  Loader2,
  CheckCircle,
  AlertCircle,
  Cpu,
  Download,
  Square,
  CheckSquare
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Course {
  id: number
  canvas_id: number
  name: string
  code: string
  term: string | null
  instructor: string | null
}

interface Assignment {
  id: number
  name: string
  due_at: string | null
  points_possible: number | null
  status: string
  html_url: string
}

interface NoteFile {
  name: string
  path: string
  date: string
  title: string
}

interface Resource {
  id: string
  type: 'file' | 'page'
  name: string
  size?: number
  contentType?: string
  url: string
  updatedAt: string
}

interface ResourceProgress {
  status: 'listing' | 'downloading' | 'complete' | 'error'
  message: string
  current?: number
  total?: number
  progress?: number
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

export default function CourseDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [notes, setNotes] = useState<NoteFile[]>([])
  const [loading, setLoading] = useState(true)

  // Note Modal
  const [showEditor, setShowEditor] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [noteContent, setNoteContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewingNote, setViewingNote] = useState<string | null>(null)
  const [noteMarkdown, setNoteMarkdown] = useState('')

  // AI Processing state
  const [noteTab, setNoteTab] = useState<'manual' | 'ai'>('manual')
  const [audioPath, setAudioPath] = useState<string | null>(null)
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const [aiMessage, setAiMessage] = useState('')
  const [aiProgress, setAiProgress] = useState<number | undefined>(undefined)
  const [processing, setProcessing] = useState(false)
  const [ollamaAvailable, setOllamaAvailable] = useState<boolean | null>(null)

  // Resource Vault Modal
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [resourceProgress, setResourceProgress] = useState<ResourceProgress | null>(null)
  const [resourceError, setResourceError] = useState<string | null>(null)
  const [resourceWarnings, setResourceWarnings] = useState<string[]>([])

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')

  const courseId = Number(id)

  const loadData = async (): Promise<void> => {
    try {
      const [c, a, n] = await Promise.all([
        window.api?.getCourse?.(courseId),
        window.api?.getAssignments?.(courseId),
        window.api?.getNotes?.(courseId)
      ])
      setCourse(c as Course)
      setAssignments((a as Assignment[]) || [])
      setNotes((n as NoteFile[]) || [])
    } catch {
      // handled
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [courseId])

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
        // Refresh notes on completion
        if (d.status === 'complete') {
          window.api?.getNotes?.(courseId).then((n) => setNotes((n as NoteFile[]) || []))
        }
      }
    }
    window.api?.onAiProgress?.(handler)
    return (): void => { window.api?.offAiProgress?.() }
  }, [courseId])

  // Resource Vault handlers
  const handleOpenResourceModal = async (): Promise<void> => {
    setShowResourceModal(true)
    setResourcesLoading(true)
    setResourceError(null)
    setResourceProgress(null)
    setSelectedIds(new Set())
    setResourceWarnings([])
    try {
      const result = (await window.api?.listResources?.(courseId)) as { resources: Resource[]; warnings: string[] } | undefined
      setResources(result?.resources || [])
      setResourceWarnings(result?.warnings || [])
    } catch (err) {
      setResourceError(err instanceof Error ? err.message : 'Failed to fetch resources')
    } finally {
      setResourcesLoading(false)
    }
  }

  const toggleResource = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = (): void => {
    if (selectedIds.size === resources.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(resources.map((r) => r.id)))
    }
  }

  const handleDownloadResources = async (): Promise<void> => {
    const selected = resources.filter((r) => selectedIds.has(r.id))
    if (selected.length === 0) return
    setDownloading(true)
    setResourceProgress({ status: 'downloading', message: 'Starting...', current: 0, total: selected.length, progress: 0 })
    try {
      await window.api?.downloadResources?.(courseId, selected)
    } catch (err) {
      setResourceProgress({
        status: 'error',
        message: err instanceof Error ? err.message : 'Download failed'
      })
    }
  }

  // Listen for resource progress events
  useEffect(() => {
    const handler = (_event: unknown, data: unknown): void => {
      const d = data as ResourceProgress
      setResourceProgress(d)
      if (d.status === 'complete' || d.status === 'error') {
        setDownloading(false)
      }
    }
    window.api?.onResourceProgress?.(handler)
    return (): void => { window.api?.offResourceProgress?.() }
  }, [])

  const handleSelectAudio = async (): Promise<void> => {
    const path = await window.api?.selectAudioFile?.()
    if (path) setAudioPath(path)
  }

  const handleProcessAudio = async (): Promise<void> => {
    if (!audioPath || !noteTitle.trim()) return
    setProcessing(true)
    setAiStatus('preparing')
    setAiMessage('Starting...')
    try {
      const result = await window.api?.processLecture?.(
        audioPath, courseId, noteTitle, noteDate
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
    if (!noteTitle.trim() || !noteContent.trim()) return
    setSaving(true)
    try {
      await window.api?.saveNote?.(courseId, noteTitle, noteContent, noteDate)
      setShowEditor(false)
      setNoteTitle('')
      setNoteContent('')
      // Refresh notes
      const n = await window.api?.getNotes?.(courseId)
      setNotes((n as NoteFile[]) || [])
    } catch {
      // handled
    } finally {
      setSaving(false)
    }
  }

  const handleViewNote = async (path: string): Promise<void> => {
    try {
      const md = await window.api?.getNote?.(path)
      setNoteMarkdown(md)
      setViewingNote(path)
    } catch {
      // handled
    }
  }

  const filteredAndSorted = useMemo(() => {
    let filtered = assignments

    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter)
    }

    if (dueFilter !== 'all') {
      filtered = filtered.filter((a) => isDueInRange(a.due_at, dueFilter))
    }

    return [...filtered].sort((a, b) => {
      const pa = sortPriority(a.status)
      const pb = sortPriority(b.status)
      if (pa !== pb) return pa - pb

      const da = a.due_at ? new Date(a.due_at).getTime() : Infinity
      const db = b.due_at ? new Date(b.due_at).getTime() : Infinity
      return da - db
    })
  }, [assignments, statusFilter, dueFilter])

  const hasActiveFilters = statusFilter !== 'all' || dueFilter !== 'all'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="p-8">
        <p className="text-slate-400">Course not found.</p>
        <Link to="/courses" className="text-green-400 hover:underline text-sm mt-2 inline-block">
          Back to Courses
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 lg:p-10 max-w-6xl w-full flex-1 flex flex-col min-h-0">
      {/* Back link */}
      <Link
        to="/courses"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-6 flex-shrink-0"
      >
        <ArrowLeft className="w-4 h-4" />
        All Courses
      </Link>

      {/* Course header */}
      <div className="mb-8 flex-shrink-0">
        <h1 className="text-3xl font-bold tracking-tight">{course.code}</h1>
        <p className="text-slate-400 mt-1">{course.name}</p>
        {course.instructor && (
          <p className="text-sm text-slate-500 mt-1">{course.instructor}</p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6 flex-1 min-h-0">

        {/* Assignments column */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 flex flex-col min-h-0">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Assignments
            </h2>
            <div className="text-[11px] text-slate-500">
              {filteredAndSorted.length} assignments
            </div>
          </div>

          {/* Filters Bar */}
          {assignments.length > 0 && (
            <div className="px-4 py-2 bg-slate-900/80 border-b border-white/5 flex items-center gap-2 overflow-x-auto flex-shrink-0">
              <Filter className="w-3.5 h-3.5 text-slate-500 ml-1" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>Status: {opt.label}</option>
                ))}
              </select>
              <select
                value={dueFilter}
                onChange={(e) => setDueFilter(e.target.value as DueFilter)}
                className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
              >
                {DUE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>Due: {opt.label}</option>
                ))}
              </select>
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    setStatusFilter('all')
                    setDueFilter('all')
                  }}
                  className="text-[11px] text-slate-500 hover:text-green-400 transition-colors whitespace-nowrap ml-1"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {assignments.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">
              No assignments for this course.
            </div>
          ) : filteredAndSorted.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">
              No assignments match these filters.
            </div>
          ) : (
            <div className="relative flex-1">
              <div className="absolute inset-0 overflow-y-auto w-full p-0">
                <table className="w-full table-fixed">
                  <tbody className="divide-y divide-white/5">
                    {filteredAndSorted.map((a) => (
                      <tr
                        key={a.id}
                        className="hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                      >
                        <td className="px-6 py-3.5 w-full block sm:table-cell sm:w-auto">
                          <p className="text-sm font-medium text-slate-200 truncate pr-2">{a.name}</p>
                          <div className="flex items-center gap-3 mt-1 sm:hidden">
                            <span className="text-xs text-slate-500">{formatDueDate(a.due_at)}</span>
                            {a.points_possible && <span className="text-xs text-slate-600">{a.points_possible} pts</span>}
                          </div>
                        </td>
                        <td className="hidden sm:table-cell px-2 py-3.5 w-[25%]">
                          <span className="text-xs text-slate-400 whitespace-nowrap block truncate">
                            {formatDueDate(a.due_at)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right w-[120px] sm:w-[150px]">
                          <div className="flex items-center justify-end gap-3">
                            <span
                              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${getStatusStyle(a.status)}`}
                            >
                              {getStatusIcon(a.status)}
                              {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                            </span>
                            {a.html_url && (
                              <a
                                href={a.html_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-600 hover:text-green-400 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Notes column */}
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 flex flex-col min-h-0">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Lecture Notes
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenResourceModal}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-white/10 text-slate-300 transition-all duration-200 active:scale-[0.98] border border-white/10"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Sync Resources
              </button>
              <button
                onClick={() => setShowEditor(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Note
              </button>
            </div>
          </div>
          {notes.length === 0 ? (
            <div className="px-6 py-10 text-center text-slate-500 text-sm">
              No lecture notes yet. Create one to get started.
            </div>
          ) : (
            <div className="relative flex-1">
              <div className="absolute inset-0 overflow-y-auto divide-y divide-white/5">
                {notes.map((note) => (
                  <div
                    key={note.path}
                    className="px-6 py-3.5 flex items-center justify-between hover:bg-white/5 transition-colors duration-200 cursor-pointer"
                  >
                    <button
                      onClick={() => handleViewNote(note.path)}
                      className="text-left min-w-0 flex-1"
                    >
                      <p className="text-sm font-medium text-slate-200 truncate">{note.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{note.date}</p>
                    </button>
                    <button
                      onClick={() => window.api?.revealNote?.(note.path)}
                      className="text-slate-600 hover:text-green-400 transition-colors ml-3"
                      title="Open in Finder"
                    >
                      <FolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Note editor modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-slate-50">New Lecture Note</h3>
              <button
                onClick={() => setShowEditor(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setNoteTab('manual')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${noteTab === 'manual'
                    ? 'text-green-400 border-b-2 border-green-400'
                    : 'text-slate-500 hover:text-slate-300'
                  }`}
              >
                Manual Entry
              </button>
              <button
                onClick={() => setNoteTab('ai')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${noteTab === 'ai'
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="e.g., Intro to Databases"
                      className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all"
                    />
                  </div>
                  <div>
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
                    rows={14}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 transition-all font-mono resize-none"
                  />
                </div>
              </div>
            )}

            {/* AI Process tab */}
            {noteTab === 'ai' && (
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div>
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
                  <div>
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
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                {processing ? 'Dismiss' : 'Cancel'}
              </button>
              {noteTab === 'manual' && (
                <button
                  onClick={handleSaveNote}
                  disabled={saving || !noteTitle.trim() || !noteContent.trim()}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save to Vault'}
                </button>
              )}
              {noteTab === 'ai' && (
                <button
                  onClick={handleProcessAudio}
                  disabled={processing || !audioPath || !noteTitle.trim() || ollamaAvailable === false}
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

      {/* Resource Selection Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-slate-50">Sync Resources</h3>
              <button
                onClick={() => { setShowResourceModal(false); setResourceProgress(null) }}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {resourcesLoading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
                  <span className="ml-3 text-sm text-slate-400">Fetching resources from Canvas...</span>
                </div>
              )}

              {resourceError && (
                <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                  <p className="text-sm text-rose-300">{resourceError}</p>
                </div>
              )}

              {!resourcesLoading && resourceWarnings.length > 0 && (
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-300 space-y-1">
                    {resourceWarnings.map((w, i) => <p key={i}>{w}</p>)}
                  </div>
                </div>
              )}

              {!resourcesLoading && !resourceError && resources.length === 0 && resourceWarnings.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No files or pages found for this course.
                </div>
              )}

              {!resourcesLoading && resources.length > 0 && !downloading && resourceProgress?.status !== 'complete' && (
                <>
                  {/* Select All */}
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 mb-4 transition-colors"
                  >
                    {selectedIds.size === resources.length
                      ? <CheckSquare className="w-4 h-4 text-green-400" />
                      : <Square className="w-4 h-4" />}
                    Select All ({resources.length})
                  </button>

                  {/* Files group */}
                  {resources.filter(r => r.type === 'file').length > 0 && (
                    <>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Files ({resources.filter(r => r.type === 'file').length})
                      </h4>
                      <div className="space-y-1 mb-4">
                        {resources.filter(r => r.type === 'file').map((r) => (
                          <button
                            key={r.id}
                            onClick={() => toggleResource(r.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors duration-200 text-left cursor-pointer"
                          >
                            {selectedIds.has(r.id)
                              ? <CheckSquare className="w-4 h-4 text-green-400 flex-shrink-0" />
                              : <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                            <span className="text-sm text-slate-200 truncate">{r.name}</span>
                            {r.size && (
                              <span className="text-[11px] text-slate-600 ml-auto flex-shrink-0">
                                {(r.size / 1024).toFixed(0)} KB
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Pages group */}
                  {resources.filter(r => r.type === 'page').length > 0 && (
                    <>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Pages ({resources.filter(r => r.type === 'page').length})
                      </h4>
                      <div className="space-y-1">
                        {resources.filter(r => r.type === 'page').map((r) => (
                          <button
                            key={r.id}
                            onClick={() => toggleResource(r.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors duration-200 text-left cursor-pointer"
                          >
                            {selectedIds.has(r.id)
                              ? <CheckSquare className="w-4 h-4 text-green-400 flex-shrink-0" />
                              : <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />}
                            <span className="text-sm text-slate-200 truncate">{r.name}</span>
                            <span className="text-[11px] text-slate-600 ml-auto flex-shrink-0">.md</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Download progress */}
              {downloading && resourceProgress && (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <Loader2 className="w-5 h-5 text-green-400 animate-spin flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-300">{resourceProgress.message}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {resourceProgress.current} / {resourceProgress.total}
                    </p>
                    {resourceProgress.progress !== undefined && (
                      <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
                        <div
                          className="bg-green-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${resourceProgress.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Complete state */}
              {resourceProgress?.status === 'complete' && (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <p className="text-sm text-green-300">{resourceProgress.message}</p>
                </div>
              )}

              {/* Error state during download */}
              {resourceProgress?.status === 'error' && (
                <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                  <p className="text-sm text-rose-300">{resourceProgress.message}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => { setShowResourceModal(false); setResourceProgress(null) }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
              >
                {resourceProgress?.status === 'complete' ? 'Close' : 'Cancel'}
              </button>
              {!downloading && resourceProgress?.status !== 'complete' && (
                <button
                  onClick={handleDownloadResources}
                  disabled={selectedIds.size === 0}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download ({selectedIds.size})
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Note viewer modal */}
      {viewingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-slate-50">Lecture Note</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.api?.revealNote?.(viewingNote)}
                  className="text-slate-500 hover:text-green-400 transition-colors"
                  title="Open in Finder"
                >
                  <FolderOpen className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    setViewingNote(null)
                    setNoteMarkdown('')
                  }}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 prose prose-invert prose-sm max-w-none prose-headings:text-slate-200 prose-p:text-slate-300 prose-code:text-green-300 prose-pre:bg-slate-800 prose-a:text-green-400">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteMarkdown}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
