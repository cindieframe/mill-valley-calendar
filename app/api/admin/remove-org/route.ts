import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../../lib/adminAuth'
import { resolveTown } from '../../../lib/towns'
import { blockableDomain } from '../../../lib/domains'

// Value for a PostgREST or() filter: escapes LIKE wildcards (so ilike is a
// case-insensitive exact match), then quotes it so commas/parentheses in org
// names don't break the filter.
const quoted = (s: string, forLike = false) => {
  const v = forLike ? s.replace(/[\\%_]/g, '\\$&') : s
  return `"${v.replace(/[\\"]/g, '\\$&')}"`
}

// Removes an org completely: blocks it from Discovery in its town, deletes
// its events, disconnects its feeds, then deletes the org row.
// Orgs with their own login are refused so the account isn't left broken.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, name, canonical_name, town, user_id, place_id, website, website_url')
    .eq('id', id)
    .single()
  if (orgError || !org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  if (org.user_id) {
    return NextResponse.json({
      error: `${org.name} has its own login account. Unlink or delete that account before removing the org.`,
    }, { status: 409 })
  }

  const names = Array.from(new Set([org.name, org.canonical_name].filter(Boolean))) as string[]
  const nameFilter = (column: string) => names.map(n => `${column}.ilike.${quoted(n, true)}`).join(',')

  const { data: feeds, error: feedsError } = await supabaseAdmin
    .from('ical_feeds')
    .select('id, town')
    .or(nameFilter('organization'))
  if (feedsError) return NextResponse.json({ error: feedsError.message }, { status: 500 })
  const feedIds = (feeds || []).map(f => f.id)

  // The org's town decides permission and where the block applies.
  let town = await resolveTown(org.town)
  if (!town && feeds && feeds.length > 0) town = await resolveTown(feeds[0].town)
  if (!town) {
    const { data: sample } = await supabaseAdmin
      .from('events').select('town').or(nameFilter('organization')).limit(1)
    town = await resolveTown(sample?.[0]?.town)
  }
  if (!town) {
    return NextResponse.json({ error: `Can't tell which town ${org.name} belongs to. Set its town first.` }, { status: 400 })
  }
  if (!(await canManageTown(auth.admin, town))) return forbiddenTown(town)

  // 1. Block first: if a later step fails, the org can't be rediscovered
  //    while you retry.
  const website = org.website_url || org.website || null
  const domain = blockableDomain(website)
  const placeId = org.place_id || null
  if (placeId || domain) {
    const matchers = [
      placeId ? `place_id.eq.${quoted(placeId)}` : null,
      domain ? `domain.eq.${quoted(domain)}` : null,
    ].filter(Boolean).join(',')
    const { data: existingBlock } = await supabaseAdmin
      .from('blocked_orgs').select('id').eq('town', town).or(matchers).limit(1)
    const block = { name: org.name, town, place_id: placeId, website, domain }
    const { error: blockError } = existingBlock && existingBlock.length > 0
      ? await supabaseAdmin.from('blocked_orgs').update(block).eq('id', existingBlock[0].id)
      : await supabaseAdmin.from('blocked_orgs').insert([block])
    if (blockError) return NextResponse.json({ error: `Could not block org: ${blockError.message}` }, { status: 500 })
  }

  // 2. Events — from its feeds, and any listed under its name (AI/CSV/manual).
  let eventsDeleted = 0
  if (feedIds.length > 0) {
    const { count, error } = await supabaseAdmin
      .from('events').delete({ count: 'exact' }).in('feed_id', feedIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    eventsDeleted += count ?? 0
  }
  const { count: namedCount, error: namedError } = await supabaseAdmin
    .from('events').delete({ count: 'exact' }).or(nameFilter('organization'))
  if (namedError) return NextResponse.json({ error: namedError.message }, { status: 500 })
  eventsDeleted += namedCount ?? 0

  // 3. Feeds
  if (feedIds.length > 0) {
    const { error } = await supabaseAdmin.from('ical_feeds').delete().in('id', feedIds)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 4. The org itself
  const { error: deleteError } = await supabaseAdmin.from('organizations').delete().eq('id', id)
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  return NextResponse.json({
    success: true,
    name: org.name,
    town,
    eventsDeleted,
    feedsRemoved: feedIds.length,
    blocked: { placeId, domain },
  })
}
