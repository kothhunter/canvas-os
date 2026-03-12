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

  let query = supabase
    .from('assignments')
    .select('*, courses(name, code)')
    .eq('user_id', user.id)
    .order('due_at', { ascending: true, nullsFirst: false })

  if (courseIdParam) {
    const courseId = parseInt(courseIdParam, 10)
    if (!isNaN(courseId)) {
      query = query.eq('course_id', courseId)
    }
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten the nested courses join to match the existing frontend interface
  const flattened = (data || []).map((a) => ({
    ...a,
    course_name: (a.courses as { name: string; code: string } | null)?.name ?? '',
    course_code: (a.courses as { name: string; code: string } | null)?.code ?? '',
    courses: undefined
  }))

  return NextResponse.json(flattened)
}
