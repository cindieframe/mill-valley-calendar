import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function withRetry<T>(fn: () => PromiseLike<T>, attempts = 3, delayMs = 800, timeoutMs = 8000): Promise<T> {
  let lastResult: any
  for (let i = 1; i <= attempts; i++) {
    try {
      const result = await Promise.race([
        Promise.resolve(fn()),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Supabase call timed out')), timeoutMs))
      ])
      if (result && typeof result === 'object' && 'error' in result && (result as any).error) {
        lastResult = result
        if (i < attempts) {
          await new Promise(resolve => setTimeout(resolve, delayMs))
          continue
        }
        return result
      }
      return result
    } catch (err) {
      lastResult = err
      if (i < attempts) await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  throw lastResult
}

export async function POST(request: NextRequest) {
  try {
    const { run_id } = await request.json()
    if (!run_id) {
      return NextResponse.json({ error: 'run_id is required' }, { status: 400 })
    }

    const { data: run, error: runError } = await withRetry(() =>
      supabase.from('discovery_runs').select('*').eq('id', run_id).single()
    )

    if (runError) {
      console.error('Status route Supabase error:', runError)
      return NextResponse.json({ error: `Database error: ${runError.message}` }, { status: 500 })
    }
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const { data: doneRows, error: rowsError } = await withRetry(() =>
      supabase
        .from('discovery_run_orgs')
        .select('result')
        .eq('run_id', run_id)
        .eq('status', 'done')
        .not('result', 'is', null)
        .order('processed_at', { ascending: true })
    )

    if (rowsError) {
      console.error('Status route Supabase error (rows):', rowsError)
      return NextResponse.json({ error: `Database error: ${rowsError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      run: {
        id: run.id,
        status: run.status,
        total_orgs: run.total_orgs,
        processed_count: run.processed_count,
        blocked_skipped: run.blocked_skipped,
        already_known_skipped: run.already_known_skipped,
      },
      orgs: (doneRows || []).map((r: any) => r.result),
    })
  } catch (error) {
    console.error('Discovery status error:', error)
    return NextResponse.json({ error: 'Failed to fetch status' }, { status: 500 })
  }
}