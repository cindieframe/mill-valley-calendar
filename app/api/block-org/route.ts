import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'

// Discovery → "Block": hide an org from future Discovery runs for a town.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { place_id, name, town, website } = await request.json()
    if (!town) return NextResponse.json({ error: 'town required' }, { status: 400 })
    if (!(await canManageTown(auth.admin, town))) return forbiddenTown(town)

    const { error } = await supabaseAdmin.from('blocked_orgs').upsert([{
      place_id, name, town, website
    }])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to block org' }, { status: 500 })
  }
}
