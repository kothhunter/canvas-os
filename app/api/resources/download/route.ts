import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildResourceZip } from '@/lib/resources'
import { Resource } from '@/types'

// Allow up to 60s for potentially large downloads
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { courseId, resources } = body as { courseId: number; resources: Resource[] }

  if (!courseId || !resources?.length) {
    return NextResponse.json({ error: 'courseId and resources are required' }, { status: 400 })
  }

  try {
    const zipBuffer = await buildResourceZip(courseId, resources, user.id, supabase)

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="canvas-resources.zip"',
        'Content-Length': zipBuffer.length.toString()
      }
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to build zip'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
