import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const noteId = parseInt(params.id, 10)
  if (isNaN(noteId)) return NextResponse.json({ error: 'Invalid note ID' }, { status: 400 })

  const { data, error } = await supabase
    .from('notes')
    .select('id, title, content, date, course_id')
    .eq('id', noteId)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  return NextResponse.json(data)
}
