'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GraduationCap, ChevronRight, BookOpen, Users, CalendarDays } from 'lucide-react'
import { Course } from '@/types'

const CARD_GRADIENTS = [
  'from-green-500/20 to-emerald-500/20',
  'from-violet-500/20 to-fuchsia-500/20',
  'from-sky-500/20 to-cyan-500/20',
  'from-amber-500/20 to-orange-500/20',
  'from-rose-500/20 to-pink-500/20',
  'from-teal-500/20 to-blue-500/20'
]

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/courses')
      .then((r) => r.json())
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 lg:p-10 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
            Courses
          </span>
        </h1>
        <p className="text-slate-400 mt-1">Your enrolled courses from Canvas.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-green-500 rounded-full animate-spin" />
        </div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20">
          <GraduationCap className="w-10 h-10 mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400 font-medium">No courses synced yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Configure your Canvas token in{' '}
            <Link href="/settings" className="text-green-400 hover:underline">
              Settings
            </Link>{' '}
            and sync to get started.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="group relative bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-white/10 p-6 hover:border-white/20 hover:bg-slate-800/50 transition-all duration-200 active:scale-[0.98] overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-green-500/5 to-emerald-500/5 pointer-events-none" />

              <div className="relative flex items-start justify-between">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${CARD_GRADIENTS[i % CARD_GRADIENTS.length]} flex items-center justify-center mb-4`}
                >
                  <BookOpen className="w-5 h-5 text-green-400" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-green-400 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>

              <div className="relative">
                <h3 className="font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-2">
                  {course.name}
                </h3>
                <p className="text-sm text-green-400 font-medium mt-1">{course.code}</p>
                {course.instructor && (
                  <p className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    {course.instructor}
                  </p>
                )}
                {course.term && (
                  <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                    <CalendarDays className="w-3 h-3" />
                    {course.term}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
