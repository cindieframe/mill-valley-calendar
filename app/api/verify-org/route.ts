import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'
import { escapeLike } from '../../lib/escapeLike'

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { id, verified } = await request.json()
  if (!id || typeof verified !== 'boolean') {
    return NextResponse.json({ error: 'id and verified required' }, { status: 400 })
  }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, name, town')
    .eq('id', id)
    .maybeSingle()
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  if (!(await canManageTown(auth.admin, org.town))) return forbiddenTown(org.town)

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ verified })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also update all events for this org (stored name, not the browser's)
  const { error: eventsError } = await supabaseAdmin
    .from('events')
    .update({ verified })
    .ilike('organization', escapeLike(org.name))
  if (eventsError) {
    return NextResponse.json({ error: `Org updated, but its events were not: ${eventsError.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
