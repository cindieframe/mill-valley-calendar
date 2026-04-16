import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../supabase'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const querySecret = request.nextUrl.searchParams.get('secret')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && querySecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Delete past events automatically
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('events').delete().lt('date', today)

  // Load all active iCal feeds
  const { data: feeds, error } = await supabase
    .from('ical_feeds')
    .select('id, organization, url')
    .eq('active', true)

  if (error || !feeds) {
    return NextResponse.json({ error: 'Failed to load feeds' }, { status: 500 })
  }

  // Load all orgs to find canonical names
  const { data: orgs } = await supabase
    .from('organizations')
    .select('name, canonical_name')

  const results = []

  for (const feed of feeds) {
    try {
      // Find canonical name for this feed's org if one exists
      const matchingOrg = orgs?.find(o =>
        o.canonical_name?.toLowerCase() === feed.organization.toLowerCase() ||
        o.name?.toLowerCase() === feed.organization.toLowerCase()
      )
      const orgNameToUse = matchingOrg?.name || feed.organization

      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/import-ical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedUrl: feed.url,
          organization: orgNameToUse,
        })
      })
      const data = await response.json()

      // Update last_synced timestamp
      await supabase
        .from('ical_feeds')
        .update({ last_synced: new Date().toISOString() })
        .eq('id', feed.id)

      results.push({ org: orgNameToUse, imported: data.imported, skipped: data.skipped })
    } catch (err) {
      results.push({ org: feed.organization, error: 'Failed' })
    }
  }

  return NextResponse.json({ success: true, synced: feeds.length, results })
}