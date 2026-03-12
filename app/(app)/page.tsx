'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import Confetti from 'react-confetti'
import Link from 'next/link'
import { useLiveTranscription } from '@/hooks/useLiveTranscription'
import {
  Calendar,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Filter,
  Plus,
  X,
  Mic,
  MicOff,
  Copy,
  Check
} from 'lucide-react'
import { Assignment } from '@/types'
import { useWindowSize } from 'react-use' // Needs to be installed or mocked
import { SpotlightCard } from '@/components/SpotlightCard'

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

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
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

export default function Dashboard() {
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [showConfetti, setShowConfetti] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [courseFilter, setCourseFilter] = useState<string>('all')
  const [dueFilter, setDueFilter] = useState<DueFilter>('all')

  const [showNoteEditor, setShowNoteEditor] = useState(false)
  const [editorTab, setEditorTab] = useState<'paste' | 'live'>('paste')

  // Note Form State
  const [noteTitle, setNoteTitle] = useState('')
  const [noteCourseId, setNoteCourseId] = useState<number | ''>('')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const [copiedPrompt, setCopiedPrompt] = useState(false)

  const {
    transcript,
    listening,
    browserSupportsSpeechRecognition,
    error: recordingError,
    startListening,
    stopListening,
    resetTranscript
  } = useLiveTranscription()

  useEffect(() => {
    // Window size for Confetti
    setDimensions({ width: window.innerWidth, height: window.innerHeight })
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handleResize)

    fetch('/api/assignments')
      .then((r) => r.json())
      .then((data) => {
        const arr = Array.isArray(data) ? data : []
        setAssignments(arr)

        // Check for Inbox Zero
        const pending = arr.filter((a) => a.status !== 'submitted' && a.status !== 'graded' && a.status !== 'overdue')
        if (arr.length > 0 && pending.length === 0) {
          setShowConfetti(true)
          setTimeout(() => setShowConfetti(false), 5000)
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false))

    return () => window.removeEventListener('resize', handleResize)
  }, [])

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

  const courseOptions = useMemo(() => {
    const codes = [...new Set(assignments.map((a) => a.course_code))].sort()
    return codes
  }, [assignments])

  const activeCourses = useMemo(() => {
    const map = new Map<number, { id: number; code: string; name: string }>()
    assignments.forEach((a) => {
      if (!map.has(a.course_id)) {
        map.set(a.course_id, { id: a.course_id, code: a.course_code, name: a.course_name })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [assignments])

  const handleSaveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim() || !noteCourseId) return
    setSavingNote(true)
    try {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: Number(noteCourseId),
          title: noteTitle,
          content: noteContent,
          date: noteDate
        })
      })
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
    if (statusFilter !== 'all') filtered = filtered.filter((a) => a.status === statusFilter)
    if (courseFilter !== 'all') filtered = filtered.filter((a) => a.course_code === courseFilter)
    if (dueFilter !== 'all') filtered = filtered.filter((a) => isDueInRange(a.due_at, dueFilter))

    return [...filtered].sort((a, b) => {
      const pa = sortPriority(a.status)
      const pb = sortPriority(b.status)
      if (pa !== pb) return pa - pb
      const da = a.due_at ? new Date(a.due_at).getTime() : Infinity
      const db = b.due_at ? new Date(b.due_at).getTime() : Infinity
      return da - db
    })
  }, [assignments, statusFilter, courseFilter, dueFilter])

  const upcoming = assignments.filter((a) => a.status !== 'submitted' && a.status !== 'graded')
  const dueThisWeek = upcoming.filter((a) => {
    if (!a.due_at) return false
    const diff = new Date(a.due_at).getTime() - Date.now()
    return diff > 0 && diff < 7 * 86400000
  })

  const hasActiveFilters = statusFilter !== 'all' || courseFilter !== 'all' || dueFilter !== 'all'

  // Animation Variants
  const containerVars: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVars: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  }

  return (
    <div className="p-8 lg:p-10 max-w-6xl w-full flex-1 flex flex-col relative">
      {showConfetti && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <Confetti
            width={dimensions.width}
            height={dimensions.height}
            recycle={false}
            numberOfPieces={400}
            gravity={0.15}
          />
        </div>
      )}

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
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
      </motion.div>

      {/* Summary Stats */}
      {!loading && assignments.length > 0 && (
        <motion.div
          variants={containerVars}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
        >
          {[
            { label: 'Total', value: assignments.length, color: 'text-slate-200', labelColor: 'text-slate-500' },
            {
              label: 'Pending',
              value: assignments.filter(
                (a) => a.status !== 'submitted' && a.status !== 'graded' && a.status !== 'overdue'
              ).length,
              color: 'text-amber-400',
              labelColor: 'text-amber-500/80'
            },
            {
              label: 'Completed',
              value: assignments.filter(
                (a) => a.status === 'submitted' || a.status === 'graded'
              ).length,
              color: 'text-green-400',
              labelColor: 'text-green-500/80'
            },
            {
              label: 'Overdue',
              value: assignments.filter((a) => a.status === 'overdue').length,
              color: 'text-rose-400',
              labelColor: 'text-rose-500/80'
            }
          ].map((stat) => (
            <motion.div
              variants={itemVars}
              key={stat.label}
              className="h-full"
            >
              <SpotlightCard className="p-4 h-full border border-white/10 hover:border-white/20 transition-all duration-200 bg-slate-900/50">
                <p className={`text-[11px] font-medium ${stat.labelColor} uppercase tracking-wider`}>
                  {stat.label}
                </p>
                <p className={`text-2xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
              </SpotlightCard>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Filter bar */}
      {!loading && assignments.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/40 p-3 rounded-xl border border-white/10"
        >
          <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0">
            <Filter className="w-4 h-4 text-slate-500 ml-1 flex-shrink-0" />

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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-slate-800/80 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>Status: {opt.label}</option>
              ))}
            </select>

            <select
              value={dueFilter}
              onChange={(e) => setDueFilter(e.target.value as DueFilter)}
              className="bg-slate-800/80 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500/50 cursor-pointer"
            >
              {DUE_OPTIONS.map((opt) => (
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
        </motion.div>
      )}

      {/* Assignments table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5, type: 'spring' }}
        className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 flex flex-col flex-1 min-h-0"
      >
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
              <Link href="/settings" className="text-green-400 hover:underline">
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
            <div className="absolute inset-0 overflow-y-auto border-t border-white/5">
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
                  <AnimatePresence mode="popLayout">
                    {filteredAndSorted.map((a, i) => {
                      const isUrgent =
                        a.status === 'pending' &&
                        a.due_at &&
                        new Date(a.due_at).getTime() - Date.now() < 24 * 60 * 60 * 1000 &&
                        new Date(a.due_at).getTime() - Date.now() > 0;

                      return (
                        <motion.tr
                          key={a.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                          className="hover:bg-white/5 transition-colors duration-200 relative group"
                        >
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              {isUrgent && (
                                <span className="relative flex h-2 w-2 flex-shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                </span>
                              )}
                              <span
                                className="text-sm font-medium text-slate-200 block truncate"
                                title={a.name}
                              >
                                {a.name}
                              </span>
                            </div>
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
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {/* Note Editor Modal */}
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

            <div className="flex border-b border-white/10 px-6 pt-2">
              <button
                onClick={() => setEditorTab('paste')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${editorTab === 'paste' ? 'border-green-500 text-green-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                Markdown Editor
              </button>
              <button
                onClick={() => setEditorTab('live')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${editorTab === 'live' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
              >
                <Mic className="w-4 h-4" /> Live Lecture AI
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Course</label>
                  <select
                    value={noteCourseId}
                    onChange={(e) => setNoteCourseId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer"
                  >
                    <option value="" disabled>Select course</option>
                    {activeCourses.map((c) => (
                      <option key={c.id} value={c.id}>{c.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Title</label>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="e.g., Intro to Databases"
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Date</label>
                  <input
                    type="date"
                    value={noteDate}
                    onChange={(e) => setNoteDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>

              {editorTab === 'paste' ? (
                <div className="flex-1 flex flex-col pt-2">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">
                    Markdown Content
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Paste your lecture notes here, or use the Live Lecture AI tab to generate them automatically..."
                    rows={12}
                    className="w-full px-4 py-3 bg-slate-800 border border-white/10 rounded-lg text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-green-500 font-mono resize-none flex-1"
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col pt-2 pb-4">
                  <div className="bg-slate-900/80 border border-green-500/20 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4">
                    <button
                      onClick={toggleRecording}
                      className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-xl ${listening ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20 shadow-[0_0_30px_rgba(244,63,94,0.3)]' : 'bg-slate-800 hover:bg-slate-700 border border-white/10'}`}
                    >
                      {listening ? (
                        <>
                          <div className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-20"></div>
                          <MicOff className="w-8 h-8 text-white relative z-10" />
                        </>
                      ) : (
                        <Mic className="w-8 h-8 text-slate-300" />
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
                      <h4 className="text-lg font-medium text-slate-200">
                        {listening ? 'Listening live...' : 'Start Live Transcription'}
                      </h4>
                      <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                        Hit record, place your laptop near the professor, and let the AI generate a perfect study guide.
                      </p>
                    </div>

                    {transcript && (
                      <div className="w-full mt-4 bg-slate-950/50 border border-white/5 rounded-lg p-4 text-left max-h-40 overflow-y-auto">
                        <p className="text-sm text-slate-300 leading-relaxed font-mono">
                          {transcript}
                          {listening && <span className="inline-block w-1.5 h-3.5 bg-green-500 ml-1 animate-pulse"></span>}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-white/10 flex justify-between items-center bg-slate-900/50 rounded-b-2xl">
              <div className="flex gap-3">
                {editorTab === 'live' && (
                  <button
                    onClick={handleCopyForLLM}
                    disabled={!transcript}
                    className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 border border-indigo-500/30 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {copiedPrompt ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedPrompt ? 'Copied to Clipboard!' : 'Copy Prompt & Transcript for LLM'}
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNoteEditor(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={savingNote || !noteTitle.trim() || !noteContent.trim() || !noteCourseId}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-green-500 hover:bg-green-400 text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingNote ? 'Saving...' : 'Save Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
