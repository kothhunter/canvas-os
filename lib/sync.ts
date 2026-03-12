import { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchActiveCourses,
  fetchAssignmentsForCourse,
  transformCourse,
  transformAssignment
} from './canvas'

export async function performSync(
  userId: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; coursesCount: number; assignmentsCount: number; error?: string }> {
  try {
    const courses = await fetchActiveCourses(userId, supabase)
    const activeCanvasIds = courses.map((c) => c.id)

    // Remove courses (and cascade-delete their assignments) that are no longer active
    if (activeCanvasIds.length > 0) {
      await supabase
        .from('courses')
        .delete()
        .eq('user_id', userId)
        .not('canvas_id', 'in', `(${activeCanvasIds.map((id) => `"${id}"`).join(',')})`)
    }

    let totalAssignments = 0

    for (const course of courses) {
      const transformed = transformCourse(course)

      // Upsert course and get its internal ID
      const { data: upsertedCourse, error: courseError } = await supabase
        .from('courses')
        .upsert(
          { user_id: userId, ...transformed },
          { onConflict: 'user_id,canvas_id' }
        )
        .select('id')
        .single()

      if (courseError || !upsertedCourse) {
        console.error(`Failed to upsert course ${course.course_code}:`, courseError)
        continue
      }

      const internalId = upsertedCourse.id

      try {
        const assignments = await fetchAssignmentsForCourse(course.id, userId, supabase)
        for (const assignment of assignments) {
          const ta = transformAssignment(assignment, internalId)
          await supabase
            .from('assignments')
            .upsert(
              { user_id: userId, ...ta },
              { onConflict: 'user_id,canvas_id' }
            )
          totalAssignments++
        }
      } catch (err) {
        console.error(`Failed to fetch assignments for ${course.course_code}:`, err)
      }
    }

    // Log successful sync
    await supabase.from('sync_logs').insert({
      user_id: userId,
      synced_at: new Date().toISOString(),
      courses_synced: courses.length,
      assignments_synced: totalAssignments,
      status: 'success'
    })

    return { success: true, coursesCount: courses.length, assignmentsCount: totalAssignments }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'

    await supabase.from('sync_logs').insert({
      user_id: userId,
      synced_at: new Date().toISOString(),
      courses_synced: 0,
      assignments_synced: 0,
      status: 'error',
      error: message
    })

    return { success: false, coursesCount: 0, assignmentsCount: 0, error: message }
  }
}
