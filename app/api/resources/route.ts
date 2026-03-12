import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listCourseResources } from '@/lib/resources'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const courseIdParam = searchParams.get('courseId')

  if (!courseIdParam) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  }

  const courseId = parseInt(courseIdParam, 10)
  if (isNaN(courseId)) return NextResponse.json({ error: 'Invalid courseId' }, { status: 400 })

  try {
    const result = await listCourseResources(courseId, user.id, supabase)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list resources'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
