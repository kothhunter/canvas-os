export interface Course {
  id: number
  canvas_id: string
  name: string
  code: string
  term: string | null
  instructor: string | null
}

export interface Assignment {
  id: number
  canvas_id: string
  course_id: number
  course_name: string
  course_code: string
  name: string
  due_at: string | null
  points_possible: number | null
  status: string
  html_url: string | null
}

export interface Note {
  id: number
  course_id: number
  title: string
  date: string
  created_at: string
}

export interface Resource {
  id: string
  type: 'file' | 'page'
  name: string
  size?: number
  contentType?: string
  url: string
  updatedAt: string
}

export interface ResourceListResult {
  resources: Resource[]
  warnings: string[]
}

export interface UserSettings {
  hasCanvasToken: boolean
  canvas_url: string
}

export interface SyncResult {
  success: boolean
  coursesCount?: number
  assignmentsCount?: number
  error?: string
}
