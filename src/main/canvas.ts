import store from './store'

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
  has_submitted_submissions?: boolean
  submission?: {
    workflow_state: string
    submitted_at: string | null
    grade: string | null
  }
}

async function canvasFetch<T>(endpoint: string): Promise<T> {
  const token = store.get('canvasToken')
  const baseUrl = store.get('canvasUrl')

  if (!token || !baseUrl) {
    throw new Error('Canvas API not configured. Please set your token and URL in Settings.')
  }

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
  // Replace all fields ending in 'id' with a string to prevent JS precision loss for IDs > MAX_SAFE_INTEGER
  const stringified = rawText.replace(/"([a-zA-Z0-9_]*id)":\s*(\d+)/g, '"$1":"$2"')
  return JSON.parse(stringified) as Promise<T>
}

export async function fetchActiveCourses(): Promise<CanvasCourse[]> {
  const courses = await canvasFetch<CanvasCourse[]>(
    '/users/self/favorites/courses?include[]=term&include[]=teachers&per_page=100'
  )
  return courses
}

export async function fetchAssignmentsForCourse(
  canvasCourseId: string
): Promise<CanvasAssignment[]> {
  const assignments = await canvasFetch<CanvasAssignment[]>(
    `/courses/${canvasCourseId}/assignments?include[]=submission&per_page=100&order_by=due_at`
  )
  return assignments
}

function determineStatus(assignment: CanvasAssignment): string {
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

export function transformCourse(c: CanvasCourse): {
  canvas_id: string
  name: string
  code: string
  term?: string
  instructor?: string
} {
  return {
    canvas_id: c.id,
    name: c.name,
    code: c.course_code,
    term: c.term?.name,
    instructor: c.teachers?.[0]?.display_name
  }
}

// --- File Vault API types ---

interface CanvasFile {
  id: string
  display_name: string
  filename: string
  url: string
  size: number
  content_type: string
  created_at: string
  updated_at: string
}

interface CanvasPage {
  page_id: string
  url: string
  title: string
  created_at: string
  updated_at: string
  body?: string
}

// --- File Vault API fetchers ---

export async function fetchCourseFiles(canvasCourseId: string): Promise<CanvasFile[]> {
  return canvasFetch<CanvasFile[]>(`/courses/${canvasCourseId}/files?per_page=100`)
}

export async function fetchCoursePages(canvasCourseId: string): Promise<CanvasPage[]> {
  return canvasFetch<CanvasPage[]>(`/courses/${canvasCourseId}/pages?per_page=100`)
}

export async function fetchPageBody(canvasCourseId: string, pageUrl: string): Promise<string> {
  const page = await canvasFetch<CanvasPage>(`/courses/${canvasCourseId}/pages/${pageUrl}`)
  return page.body || ''
}

export function transformAssignment(
  a: CanvasAssignment,
  internalCourseId: number
): {
  canvas_id: string
  course_id: number
  name: string
  due_at: string | null
  points_possible: number | null
  status: string
  description: string | null
  html_url: string | null
} {
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
