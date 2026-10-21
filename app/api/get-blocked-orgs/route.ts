import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'
import { findTown, townFilter } from '../../lib/towns'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { town: rawTown } = await request.json()
    // Match the town however it was typed on Discovery ("San Anselmo, CA", "san-anselmo")
    const town = await findTown(rawTown)
    if (!(await canManageTown(auth.admin, town?.name ?? rawTown))) return forbiddenTown(town?.name ?? rawTown)

    let query = supabaseAdmin.from('blocked_orgs').select('*')
    query = town ? query.or(townFilter(town)) : query.eq('town', rawTown)
    const { data, error } = await query.order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load blocked orgs' }, { status: 500 })
  }
}
