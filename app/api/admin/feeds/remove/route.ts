import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../../../lib/adminAuth'
import { resolveTown } from '../../../../lib/towns'

// Disconnects a feed and deletes the events it imported.
// rejected_uids is left untouched: reconnecting the feed later brings back
// its events, while anything an admin rejected stays rejected.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: feed, error: feedError } = await supabaseAdmin
    .from('ical_feeds')
    .select('id, organization, town')
    .eq('id', id)
    .single()
  if (feedError || !feed) return NextResponse.json({ error: 'Feed not found' }, { status: 404 })

  const town = (await resolveTown(feed.town)) || feed.town
  if (!(await canManageTown(auth.admin, town))) return forbiddenTown(town)

  // Events first: if this fails the feed stays connected and nothing is half-removed.
  const { count, error: eventsError } = await supabaseAdmin
    .from('events')
    .delete({ count: 'exact' })
    .eq('feed_id', id)
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 })

  const { error: deleteError } = await supabaseAdmin.from('ical_feeds').delete().eq('id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({ success: true, organization: feed.organization, eventsDeleted: count ?? 0 })
}
