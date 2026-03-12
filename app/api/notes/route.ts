import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

  const { data, error } = await supabase
    .from('notes')
    .select('id, title, date, created_at')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .order('date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { courseId, title, content, date } = body as {
    courseId: number
    title: string
    content: string
    date: string
  }

  if (!courseId || !title?.trim() || !content?.trim() || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify the course belongs to this user
  const { data: course } = await supabase
    .from('courses')
    .select('id, code')
    .eq('id', courseId)
    .eq('user_id', user.id)
    .single()

  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 })

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: user.id,
      course_id: courseId,
      title: title.trim(),
      content,
      date
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, id: data.id })
}
