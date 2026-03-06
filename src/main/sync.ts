import { BrowserWindow } from 'electron'
import { fetchActiveCourses, fetchAssignmentsForCourse, transformCourse, transformAssignment } from './canvas'
import { upsertCourse, upsertAssignment, logSync, getDB } from './database'
import store from './store'

function sendProgress(message: string): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('canvas:syncProgress', { message })
  }
}

export async function performSync(): Promise<{ success: boolean; error?: string }> {
  const token = store.get('canvasToken')
  if (!token) {
    return { success: false, error: 'No Canvas API token configured.' }
  }

  try {
    sendProgress('Fetching courses...')
    const courses = await fetchActiveCourses()

    const activeCanvasIds = courses.map(c => c.id)

    // Remove courses from DB that are no longer active/favorited
    if (activeCanvasIds.length > 0) {
      const placeholders = activeCanvasIds.map(() => '?').join(',')
      getDB().prepare(`DELETE FROM assignments WHERE course_id IN (SELECT id FROM courses WHERE canvas_id NOT IN (${placeholders}))`).run(...activeCanvasIds)
      getDB().prepare(`DELETE FROM courses WHERE canvas_id NOT IN (${placeholders})`).run(...activeCanvasIds)
    }

    let totalAssignments = 0

    for (const course of courses) {
      sendProgress(`Syncing ${course.course_code}...`)
      const transformed = transformCourse(course)
      const internalId = upsertCourse(transformed)

      try {
        const assignments = await fetchAssignmentsForCourse(course.id)
        for (const assignment of assignments) {
          const ta = transformAssignment(assignment, internalId)
          upsertAssignment(ta)
          totalAssignments++
        }
      } catch (err: any) {
        // Some courses might restrict assignment access (403), skip them gracefully
        console.error(`Failed to fetch assignments for ${course.course_code}:`, err.message)
      }
    }

    const now = new Date().toISOString()
    store.set('lastSync', now)
    logSync(courses.length, totalAssignments)

    sendProgress('Sync complete!')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    logSync(0, 0, message)
    sendProgress(`Sync failed: ${message}`)
    return { success: false, error: message }
  }
}

let syncInterval: ReturnType<typeof setInterval> | null = null

export function startBackgroundSync(intervalMs = 30 * 60 * 1000): void {
  if (syncInterval) clearInterval(syncInterval)
  syncInterval = setInterval(() => {
    performSync().catch(() => { })
  }, intervalMs)
}

export function stopBackgroundSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}
