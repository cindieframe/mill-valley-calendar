import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { data: row } = await supabaseAdmin.from('blocked_orgs').select('town').eq('id', id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'Blocked org not found' }, { status: 404 })
    if (!(await canManageTown(auth.admin, row.town))) return forbiddenTown(row.town)

    const { error } = await supabaseAdmin.from('blocked_orgs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to unblock org' }, { status: 500 })
  }
}
