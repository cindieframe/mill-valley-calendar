import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'
import { escapeLike } from '../../lib/escapeLike'

// Admin → Organizations → rename. Also renames the org on its events.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { id, name } = await request.json()
    if (!id || !name?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    // Use the stored name, not one sent by the browser, to find the events to rename.
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, name, town')
      .eq('id', id)
      .maybeSingle()
    if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    if (!(await canManageTown(auth.admin, org.town))) return forbiddenTown(org.town)

    const newName = name.trim()
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({ name: newName })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (org.name && org.name !== newName) {
      const { error: eventsError } = await supabaseAdmin
        .from('events')
        .update({ organization: newName })
        .ilike('organization', escapeLike(org.name))
      if (eventsError) {
        return NextResponse.json({ error: `Renamed, but events were not updated: ${eventsError.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
