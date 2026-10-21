import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'
import { resolveTown } from '../../lib/towns'
import { escapeLike } from '../../lib/escapeLike'

// Discovery → after connecting a feed or AI extract, record the org.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { name, website_url, place_id, town: rawTown } = await request.json()
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const town = await resolveTown(rawTown)
    if (!town) return NextResponse.json({ error: `Unknown town "${rawTown}"` }, { status: 400 })
    if (!(await canManageTown(auth.admin, town))) return forbiddenTown(town)

    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id, place_id')
      .ilike('name', escapeLike(name))
      .limit(1)
      .maybeSingle()

    if (existing) {
      // Update place_id if we now have one and it wasn't saved before
      if (place_id && !existing.place_id) {
        const { error } = await supabaseAdmin
          .from('organizations')
          .update({ place_id })
          .eq('id', existing.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
      const { error } = await supabaseAdmin.from('organizations').insert([{
        name,
        website_url: website_url || null,
        place_id: place_id || null,
        town,
        verified: false,
        is_aggregator: false,
      }])
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Save org error:', error)
    return NextResponse.json({ error: 'Failed to save org' }, { status: 500 })
  }
}
