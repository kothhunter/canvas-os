import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { performSync } from '@/lib/sync'

// Allow up to 30s for sync on Vercel
export const maxDuration = 30

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await performSync(user.id, supabase)

  if (!result.success) {
    return NextResponse.json(result, { status: 500 })
  }

  return NextResponse.json(result)
}
