import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { town } = await request.json()
    const { data, error } = await supabase
      .from('blocked_orgs')
      .select('*')
      .eq('town', town)
      .order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load blocked orgs' }, { status: 500 })
  }
}