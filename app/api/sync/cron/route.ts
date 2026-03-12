import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { performSync } from '@/lib/sync'

// Allow up to 60s for the cron job (syncs all users)
export const maxDuration = 60

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Get all users with a configured Canvas token
  const { data: allSettings, error } = await supabase
    .from('user_settings')
    .select('user_id')
    .not('canvas_token', 'is', null)
    .neq('canvas_token', '')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results = []
  for (const settings of allSettings || []) {
    const result = await performSync(settings.user_id, supabase)
    results.push({ userId: settings.user_id, ...result })
  }

  return NextResponse.json({ synced: results.length, results })
}
