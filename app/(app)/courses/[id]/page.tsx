'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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
  Download,
  Square,
  CheckSquare,
  Mic,
  MicOff,
  Copy,
  Check
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Course, Assignment, Note, Resource } from '@/types'
import { useLiveTranscription } from '@/hooks/useLiveTranscription'
import { SpotlightCard } from '@/components/SpotlightCard'

interface ResourceProgress {
  status: 'downloading' | 'complete' | 'error'
  message: string
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
    case 'overdue':
      return 'bg-rose-500/10 text-rose-400'
    default:
      return 'bg-amber-500/10 text-amber-400'
  }
}

function getStatusIcon(status: string) {
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
  const diff = d.getTime() - Date.now()
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
  return 0
}

function isDueInRange(dueAt: string | null, range: DueFilter): boolean {
  if (range === 'all') return true
  if (!dueAt) return false
  const due = new Date(dueAt)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (range) {
    case 'today':
      return due >= startOfToday && due < new Date(startOfToday.getTime() + 86400000)
    case 'week':
      return due >= startOfToday && due < new Date(startOfToday.getTime() + 7 * 86400000)
    case 'month':
      return due >= startOfToday && due < new Date(startOfToday.getTime() + 30 * 86400000)
    default:
      return true
  }
}

function formatBytes(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function CourseDetailPage() {
  const params = useParams()
  const courseId = parseInt(params.id as string, 10)

  const [course, setCourse] = useState<Course | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')

  // Note editor state
  const [showEditor, setShowEditor] = useState(false)
  const [editorTab, setEditorTab] = useState<'paste' | 'live'>('paste')
  const [copiedPrompt, setCopiedPrompt] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [noteContent, setNoteContent] = useState('')
  const [saving, setSaving] = useState(false)

  // Note viewer state
  const [viewingNoteId, setViewingNoteId] = useState<number | null>(null)
  const [noteMarkdown, setNoteMarkdown] = useState('')
  const [viewingNoteTitle, setViewingNoteTitle] = useState('')

  // Resource modal state
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [resources, setResources] = useState<Resource[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [resourceProgress, setResourceProgress] = useState<ResourceProgress | null>(null)
  const [resourceError, setResourceError] = useState<string | null>(null)
  const [resourceWarnings, setResourceWarnings] = useState<string[]>([])

  const {
    transcript,
    listening,
    browserSupportsSpeechRecognition,
    error: recordingError,
    startListening,
    stopListening,
    resetTranscript
  } = useLiveTranscription()

  const toggleRecording = () => {
    if (listening) {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }

  const handleCopyForLLM = () => {
    if (!transcript.trim()) return

    const prompt = `You are an expert Academic Teaching Assistant. Your job is to take a raw, often messy lecture transcript and convert it into a highly structured, organized Markdown Study Guide.

Your output MUST be in valid Markdown format and STRICTLY follow this structure:

# [Lecture Title]

## Executive Summary
[A concise 2-3 paragraph summary of the overarching themes and main point of the lecture.]

## Core Concepts & Study Notes
[Organize the transcript into logical sections using H3 (###) headers. Use bullet points for readability. Clean up any filler words, tangents, or syllabus chatter. Focus purely on the academic material.]

## Key Terms & Glossary
[A bulleted list of 5-10 important terms mentioned, with a brief definition for each.]

---
Do not add any conversational text before or after the Markdown document. Return ONLY the markdown.

Here is the transcript for "${noteTitle || 'Lecture'}":

${transcript}`

    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedPrompt(true)
      setTimeout(() => setCopiedPrompt(false), 2000)
    })
  }

  useEffect(() => {
    if (isNaN(courseId)) return

    Promise.all([
      fetch(`/api/courses/${courseId}`).then((r) => r.json()),
      fetch(`/api/assignments?courseId=${courseId}`).then((r) => r.json()),
      fetch(`/api/notes?courseId=${courseId}`).then((r) => r.json())
    ])
      .then(([courseData, assignmentsData, notesData]) => {
        setCourse(courseData)
        setAssignments(Array.isArray(assignmentsData) ? assignmentsData : [])
        setNotes(Array.isArray(notesData) ? notesData : [])
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [courseId])

  const refreshNotes = () => {
    fetch(`/api/notes?courseId=${courseId}`)
      .then((r) => r.json())
      .then((data) => setNotes(Array.isArray(data) ? data : []))
      .catch(() => { })
  }

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return
    setSaving(true)
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, title: noteTitle, content: noteContent, date: noteDate })
      })
      setShowEditor(false)
      setNoteTitle('')
      setNoteContent('')
      refreshNotes()
    } catch {
      // handled
    } finally {
      setSaving(false)
    }
  }

  const handleViewNote = async (note: Note) => {
    const data = await fetch(`/api/notes/${note.id}`).then((r) => r.json())
    setNoteMarkdown(data.content || '')
    setViewingNoteTitle(note.title)
    setViewingNoteId(note.id)
  }

  const handleDownloadNote = (note: Note) => {
    fetch(`/api/notes/${note.id}`)
      .then((r) => r.json())
      .then((data) => {
        const blob = new Blob([data.content || ''], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${note.date ? note.date + '-' : ''}${note.title}.md`
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => { })
  }

  const handleOpenResources = async () => {
    setShowResourceModal(true)
    setResourcesLoading(true)
    setResourceError(null)
    setResourceWarnings([])
    setResources([])
    setSelectedIds(new Set())
    setResourceProgress(null)

    try {
      const data = await fetch(`/api/resources?courseId=${courseId}`).then((r) => r.json())
      if (data.error) {
        setResourceError(data.error)
      } else {
        setResources(data.resources || [])
        setResourceWarnings(data.warnings || [])
      }
    } catch {
      setResourceError('Failed to load resources')
    } finally {
      setResourcesLoading(false)
    }
  }

  const handleDownloadResources = async () => {
    const selectedResources = resources.filter((r) => selectedIds.has(r.id))
    if (!selectedResources.length) return

    setDownloading(true)
    setResourceProgress({ status: 'downloading', message: `Preparing ${selectedResources.length} resource(s)...` })

    try {
      const response = await fetch('/api/resources/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, resources: selectedResources })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Download failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${course?.code || 'course'}-resources.zip`
      a.click()
      URL.revokeObjectURL(url)

      setResourceProgress({ status: 'complete', message: `Downloaded ${selectedResources.length} resource(s)` })
    } catch (err) {
      setResourceProgress({
        status: 'error',
        message: err instanceof Error ? err.message : 'Download failed'
      })
    } finally {
      setDownloading(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelectedIds(new Set(resources.map((r) => r.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const filteredAndSorted = useMemo(() => {
    let filtered = assignments
    if (statusFilter !== 'all') filtered = filtered.filter((a) => a.status === statusFilter)
    if (dueFilter !== 'all') filtered = filtered.filter((a) => isDueInRange(a.due_at, dueFilter))

    return [...filtered].sort((a, b) => {
      const pa = sortPriority(a.status)
      const pb = sortPriority(b.status)
      if (pa !== pb) return pa - pb
      const da = a.due_at ? new Date(a.due_at).getTime() : Infinity
      const db = b.due_at ? new Date(b.due_at).getTime() : Infinity
      return da - db
    })
  }, [assignments, statusFilter, dueFilter])

  const fileResources = resources.filter((r) => r.type === 'file')
  const pageResources = resources.filter((r) => r.type === 'page')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-green-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="p-10 text-slate-600 dark:text-slate-400">
        Course not found.{' '}
        <Link href="/courses" className="text-green-400 hover:underline">
          Back to Courses
        </Link>
      </div>
    )
  }

  return (
    <div className="p-8 lg:p-10 max-w-7xl">
      {/* Back nav */}
      <Link
        href="/courses"
        className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        All Courses
      </Link>

      {/* Course header */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
              {course.code}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-3">{course.name}</h1>
            {course.instructor && (
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{course.instructor}</p>
            )}
            {course.term && <p className="text-xs text-slate-600 mt-0.5">{course.term}</p>}
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Assignments — wider column */}
        <div className="lg:col-span-3">
          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/10">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Assignments ({filteredAndSorted.length})
              </h2>

              {/* Compact filter row */}
              <div className="flex items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <select
                  value={dueFilter}
                  onChange={(e) => setDueFilter(e.target.value as DueFilter)}
                  className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
                >
                  {DUE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {(statusFilter !== 'all' || dueFilter !== 'all') && (
                  <button
                    onClick={() => { setStatusFilter('all'); setDueFilter('all') }}
                    className="text-[11px] text-slate-600 hover:text-green-400 transition-colors"
                  >
                    <Filter className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {filteredAndSorted.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-500 dark:text-slate-500">
                <Calendar className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No assignments match your filters.</p>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                {filteredAndSorted.map((a) => {
                  const isUrgent =
                    a.status === 'pending' &&
                    a.due_at &&
                    new Date(a.due_at).getTime() - Date.now() < 24 * 60 * 60 * 1000 &&
                    new Date(a.due_at).getTime() - Date.now() > 0;

                  return (
                    <SpotlightCard key={a.id} className="px-5 py-4 border border-transparent hover:border-slate-200 dark:border-white/10 bg-transparent hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isUrgent && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                              </span>
                            )}
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{a.name}</p>
                          </div>
                          <p className={`text-xs mt-1 ${isUrgent ? 'text-rose-400/80 font-medium' : 'text-slate-500 dark:text-slate-500'}`}>
                            {formatDueDate(a.due_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
                              className="text-slate-500 dark:text-slate-500 hover:text-green-400 transition-colors ml-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                      {a.points_possible !== null && (
                        <p className="text-[11px] text-slate-600 mt-2">{a.points_possible} pts</p>
                      )}
                    </SpotlightCard>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Notes — narrower column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Lecture Notes */}
          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/10">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Lecture Notes ({notes.length})
              </h2>
              <button
                onClick={() => setShowEditor(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all"
              >
                <Plus className="w-3 h-3" />
                Add Note
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="px-5 py-10 text-center text-slate-600">
                <FileText className="w-6 h-6 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No notes yet. Add one to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notes.map((note) => (
                  <div key={note.id} className="px-5 py-3 hover:bg-slate-100 dark:bg-white/5 transition-colors group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{note.title}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{note.date}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleViewNote(note)}
                          className="p-1.5 text-slate-500 dark:text-slate-500 hover:text-green-400 transition-colors rounded"
                          title="View note"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDownloadNote(note)}
                          className="p-1.5 text-slate-500 dark:text-slate-500 hover:text-green-400 transition-colors rounded"
                          title="Download .md"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* File Vault */}
          <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-200 dark:border-white/10 p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-3">
              <FolderOpen className="w-4 h-4" />
              File Vault
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
              Download files and pages from Canvas as a ZIP archive.
            </p>
            <button
              onClick={handleOpenResources}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:bg-white/10 hover:text-white transition-all duration-200 active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Sync Resources
            </button>
          </div>
        </div>
      </div>

      {/* Note Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">New Lecture Note</h3>
              <button
                onClick={() => setShowEditor(false)}
                className="text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-slate-200 dark:border-white/10 px-6 pt-2">
              <button
                onClick={() => setEditorTab('paste')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${editorTab === 'paste' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`}
              >
                Markdown Editor
              </button>
              <button
                onClick={() => setEditorTab('live')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${editorTab === 'live' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200'}`}
              >
                <Mic className="w-4 h-4" /> Live Lecture AI
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="e.g., Intro to Databases"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              {editorTab === 'paste' ? (
                <div className="flex-1 flex flex-col pt-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Markdown Content
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Paste your lecture notes here, or use the Live Lecture AI tab to generate them automatically..."
                    rows={12}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 font-mono resize-none flex-1"
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col pt-2 pb-4">
                  <div className="bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-green-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4">
                    <button
                      onClick={toggleRecording}
                      className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-xl ${listening ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.3)]' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-700 border border-slate-200 dark:border-white/10'}`}
                    >
                      {listening ? (
                        <>
                          <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-20"></div>
                          <MicOff className="w-8 h-8 text-white relative z-10" />
                        </>
                      ) : (
                        <Mic className="w-8 h-8 text-slate-700 dark:text-slate-300" />
                      )}
                    </button>

                    {!browserSupportsSpeechRecognition && (
                      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-lg text-sm max-w-md mx-auto">
                        <strong>Browser Not Supported: </strong>
                        Your browser doesn't support speech recognition. Please try Google Chrome for the best experience.
                      </div>
                    )}

                    {recordingError && (
                      <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-lg text-sm max-w-md mx-auto">
                        <strong>Microphone Error: </strong>
                        {recordingError === 'not-allowed'
                          ? 'Permission denied. Please click the icon in your browser URL bar to allow microphone access.'
                          : recordingError === 'no-speech'
                            ? 'No speech detected. Please check your system microphone settings.'
                            : recordingError}
                      </div>
                    )}

                    <div>
                      <h4 className="text-lg font-medium text-slate-800 dark:text-slate-200">
                        {listening ? 'Listening live...' : 'Start Live Transcription'}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                        Hit record, place your laptop near the professor, and let the AI generate a perfect study guide.
                      </p>
                    </div>

                    {transcript && (
                      <div className="w-full mt-4 bg-white dark:bg-slate-950/50 border border-slate-300 dark:border-white/5 rounded-lg p-4 text-left max-h-40 overflow-y-auto">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                          {transcript}
                          {listening && <span className="inline-block w-1.5 h-3.5 bg-green-500 ml-1 animate-pulse"></span>}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 flex justify-between items-center bg-white dark:bg-slate-900/50 rounded-b-2xl">
              <div className="flex gap-3">
                {editorTab === 'live' && (
                  <button
                    onClick={handleCopyForLLM}
                    disabled={!transcript}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-100 text-indigo-600 hover:bg-indigo-200 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30 dark:border-indigo-500/30 border transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedPrompt ? 'Copied to Clipboard!' : 'Copy Prompt & Transcript for LLM'}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={saving || !noteTitle.trim() || !noteContent.trim()}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note Viewer Modal */}
      {viewingNoteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50 truncate">{viewingNoteTitle}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const note = notes.find((n) => n.id === viewingNoteId)
                    if (note) handleDownloadNote(note)
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-green-400 hover:bg-slate-100 dark:bg-white/5 rounded-lg transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download .md
                </button>
                <button
                  onClick={() => setViewingNoteId(null)}
                  className="text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{noteMarkdown}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resource Selection Modal */}
      {showResourceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 rounded-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                Course Resources — {course.code}
              </h3>
              <button
                onClick={() => setShowResourceModal(false)}
                className="text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {resourcesLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-slate-700 border-t-green-500 rounded-full animate-spin" />
                </div>
              ) : resourceError ? (
                <p className="text-sm text-rose-400">{resourceError}</p>
              ) : resources.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-500 text-center py-6">
                  No files or pages found for this course.
                </p>
              ) : (
                <div className="space-y-5">
                  {resourceWarnings.length > 0 && (
                    <div className="space-y-1">
                      {resourceWarnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Select all */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={selectedIds.size === resources.length ? clearSelection : selectAll}
                      className="text-xs text-slate-600 dark:text-slate-400 hover:text-green-400 transition-colors flex items-center gap-1.5"
                    >
                      {selectedIds.size === resources.length ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                      {selectedIds.size === resources.length ? 'Deselect all' : 'Select all'}
                    </button>
                    {selectedIds.size > 0 && (
                      <span className="text-[11px] text-slate-600">{selectedIds.size} selected</span>
                    )}
                  </div>

                  {/* Files */}
                  {fileResources.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                        Files ({fileResources.length})
                      </p>
                      <div className="space-y-1">
                        {fileResources.map((r) => (
                          <label
                            key={r.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:bg-white/5 cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                              className="accent-green-500 rounded"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{r.name}</p>
                              {r.size && (
                                <p className="text-[11px] text-slate-600">{formatBytes(r.size)}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pages */}
                  {pageResources.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-2">
                        Pages → Markdown ({pageResources.length})
                      </p>
                      <div className="space-y-1">
                        {pageResources.map((r) => (
                          <label
                            key={r.id}
                            className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-100 dark:bg-white/5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                              className="accent-green-500 rounded"
                            />
                            <p className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{r.name}</p>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress */}
                  {resourceProgress && (
                    <div
                      className={`flex items-center gap-3 p-4 rounded-xl border ${resourceProgress.status === 'error'
                        ? 'bg-rose-500/10 border-rose-500/20'
                        : 'bg-green-500/10 border-green-500/20'
                        }`}
                    >
                      <p
                        className={`text-sm ${resourceProgress.status === 'error' ? 'text-rose-300' : 'text-green-300'
                          }`}
                      >
                        {resourceProgress.message}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 dark:border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setShowResourceModal(false)}
                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleDownloadResources}
                disabled={downloading || selectedIds.size === 0 || resourcesLoading}
                className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                {downloading
                  ? 'Building ZIP...'
                  : `Download ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
