import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { findTown, townFilter } from '../../lib/towns'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { town: rawTown } = await request.json()
    // Match the town however it was typed on Discovery ("San Anselmo, CA", "san-anselmo")
    const town = await findTown(rawTown)
    let query = supabase.from('blocked_orgs').select('*')
    query = town ? query.or(townFilter(town)) : query.eq('town', rawTown)
    const { data, error } = await query.order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load blocked orgs' }, { status: 500 })
  }
}
