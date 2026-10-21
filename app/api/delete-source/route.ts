import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'

// Admin → Import → AI tab → Saved Sources → Delete.
// Deletes the organizations row only (its events stay). Orgs with a login are
// refused here — use Organizations → ··· → Remove org instead.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'No id provided' }, { status: 400 })

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id, town, user_id')
      .eq('id', id)
      .maybeSingle()
    if (!org) return NextResponse.json({ error: 'Source not found' }, { status: 404 })
    if (!(await canManageTown(auth.admin, org.town))) return forbiddenTown(org.town)
    if (org.user_id) {
      return NextResponse.json({ error: 'This organization has its own login, so it can’t be deleted here.' }, { status: 409 })
    }

    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
