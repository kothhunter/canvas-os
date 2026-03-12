import { SupabaseClient } from '@supabase/supabase-js'

interface CanvasCourse {
  id: string
  name: string
  course_code: string
  term?: { name: string }
  teachers?: { display_name: string }[]
}

interface CanvasAssignment {
  id: string
  name: string
  due_at: string | null
  points_possible: number | null
  description: string | null
  html_url: string
  submission?: {
    workflow_state: string
    submitted_at: string | null
    grade: string | null
  }
}

interface CanvasFile {
  id: string
  display_name: string
  filename: string
  url: string
  size: number
  content_type: string
  updated_at: string
}

interface CanvasPage {
  page_id: string
  url: string
  title: string
  updated_at: string
  body?: string
}

async function getCanvasConfig(
  userId: string,
  supabase: SupabaseClient
): Promise<{ token: string; baseUrl: string }> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('canvas_token, canvas_url')
    .eq('user_id', userId)
    .single()

  if (error || !data?.canvas_token) {
    throw new Error('Canvas API not configured. Please set your token in Settings.')
  }

  return {
    token: data.canvas_token,
    baseUrl: (data.canvas_url as string) || 'https://canvas.instructure.com'
  }
}

async function canvasFetch<T>(
  endpoint: string,
  userId: string,
  supabase: SupabaseClient
): Promise<T> {
  const { token, baseUrl } = await getCanvasConfig(userId, supabase)
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1${endpoint}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Canvas API error ${response.status}: ${text}`)
  }

  const rawText = await response.text()
  // Stringify large integer IDs to prevent JS precision loss
  const stringified = rawText.replace(/"([a-zA-Z0-9_]*id)":\s*(\d+)/g, '"$1":"$2"')
  return JSON.parse(stringified) as T
}

export async function fetchActiveCourses(
  userId: string,
  supabase: SupabaseClient
): Promise<CanvasCourse[]> {
  return canvasFetch<CanvasCourse[]>(
    '/users/self/favorites/courses?include[]=term&include[]=teachers&per_page=100',
    userId,
    supabase
  )
}

export async function fetchAssignmentsForCourse(
  canvasCourseId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<CanvasAssignment[]> {
  return canvasFetch<CanvasAssignment[]>(
    `/courses/${canvasCourseId}/assignments?include[]=submission&per_page=100&order_by=due_at`,
    userId,
    supabase
  )
}

export async function fetchCourseFiles(
  canvasCourseId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<CanvasFile[]> {
  return canvasFetch<CanvasFile[]>(
    `/courses/${canvasCourseId}/files?per_page=100`,
    userId,
    supabase
  )
}

export async function fetchCoursePages(
  canvasCourseId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<CanvasPage[]> {
  return canvasFetch<CanvasPage[]>(
    `/courses/${canvasCourseId}/pages?per_page=100`,
    userId,
    supabase
  )
}

export async function fetchPageBody(
  canvasCourseId: string,
  pageUrl: string,
  userId: string,
  supabase: SupabaseClient
): Promise<string> {
  const page = await canvasFetch<CanvasPage>(
    `/courses/${canvasCourseId}/pages/${pageUrl}`,
    userId,
    supabase
  )
  return page.body || ''
}

export function determineStatus(assignment: CanvasAssignment): string {
  const sub = assignment.submission
  if (sub) {
    if (sub.grade !== null && sub.grade !== undefined) return 'graded'
    if (sub.submitted_at) return 'submitted'
  }
  if (assignment.due_at) {
    const due = new Date(assignment.due_at)
    if (due < new Date()) return 'overdue'
  }
  return 'pending'
}

export function transformCourse(c: CanvasCourse) {
  return {
    canvas_id: c.id,
    name: c.name,
    code: c.course_code,
    term: c.term?.name || null,
    instructor: c.teachers?.[0]?.display_name || null
  }
}

export function transformAssignment(a: CanvasAssignment, internalCourseId: number) {
  return {
    canvas_id: a.id,
    course_id: internalCourseId,
    name: a.name,
    due_at: a.due_at,
    points_possible: a.points_possible,
    status: determineStatus(a),
    description: a.description,
    html_url: a.html_url
  }
}
