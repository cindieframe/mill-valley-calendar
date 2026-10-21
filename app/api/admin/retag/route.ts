import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../../lib/adminAuth'
import { findTown, townFilter } from '../../../lib/towns'
import { categorizeEvent } from '../../../lib/categorize'

export const maxDuration = 120

const BATCH = 25

// Re-checks tags on upcoming events in a town, one batch per call.
// Only ADDS missing tags (and "arts" when music is added) — never removes
// anything an admin set. The page calls this repeatedly with `after` until
// `next` comes back null.
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response

  const { town: rawTown, after } = await request.json()
  const town = await findTown(rawTown)
  if (!town) return NextResponse.json({ error: `Unknown town "${rawTown}"` }, { status: 400 })
  if (!(await canManageTown(auth.admin, town.name))) return forbiddenTown(town.name)

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
  let query = supabaseAdmin
    .from('events')
    .select('id, title, description, organization, location, category, tags')
    .or(townFilter(town))
    .in('status', ['approved', 'pending'])
    .gte('date', today)
    .order('id')
    .limit(BATCH)
  if (after) query = query.gt('id', after)
  const { data: events, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const split = (v: string | null) => (v || '').split(',').map(x => x.trim()).filter(Boolean)
  const changes: { title: string; added: string[] }[] = []

  // Five at a time keeps this well inside the time limit.
  const list = events || []
  for (let i = 0; i < list.length; i += 5) {
    await Promise.all(list.slice(i, i + 5).map(async ev => {
      const suggested = await categorizeEvent({
        title: ev.title,
        description: ev.description,
        organization: ev.organization,
        location: ev.location,
        town: town.name,
      })
      const tags = split(ev.tags)
      const cats = split(ev.category)
      const addedTags = split(suggested.tags).filter(t => !tags.includes(t))
      if (addedTags.length === 0) return
      const newTags = [...tags, ...addedTags]
      const newCats = addedTags.includes('music') && !cats.includes('arts') ? [...cats, 'arts'] : cats
      const { error: updateError } = await supabaseAdmin
        .from('events')
        .update({ tags: newTags.join(','), category: newCats.join(',') })
        .eq('id', ev.id)
      if (!updateError) changes.push({ title: ev.title, added: addedTags })
    }))
  }

  return NextResponse.json({
    checked: list.length,
    updated: changes.length,
    changes,
    next: list.length === BATCH ? list[list.length - 1].id : null,
  })
}
