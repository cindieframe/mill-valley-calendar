import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { run_id } = await request.json()
    if (!run_id) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
    }

    await supabase
      .from('discovery_runs')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', run_id)
      .eq('status', 'running') // only touch it if it's still marked running

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fail-run error:', error)
    return NextResponse.json({ error: 'Failed to mark run as failed' }, { status: 500 })
  }
}