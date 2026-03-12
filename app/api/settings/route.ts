import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_settings')
    .select('canvas_url, canvas_token')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    hasCanvasToken: !!(data?.canvas_token),
    canvas_url: data?.canvas_url || 'https://canvas.instructure.com'
  })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { canvas_token, canvas_url } = body as {
    canvas_token?: string
    canvas_url?: string
  }

  const updates: Record<string, string> = {}
  if (canvas_url !== undefined) updates.canvas_url = canvas_url
  // Only update token if a non-empty value was provided
  if (canvas_token && canvas_token.trim()) updates.canvas_token = canvas_token.trim()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: user.id, ...updates },
      { onConflict: 'user_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
