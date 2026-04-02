import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../supabase'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const querySecret = request.import { supabase } from '../supabase'nextUrl.searchParams.get('secret')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && querySecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('name, ical_feed_url')
    .not('ical_feed_url', 'is', null)
    .neq('ical_feed_url', '')
  if (error || !orgs) {
    return NextResponse.json({ error: 'Failed to load organizations' }, { status: 500 })
  }
  const results = []
  for (const org of orgs) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/import-ical`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedUrl: org.ical_feed_url,
          organization: org.name,
        })
      })
      const data = await response.json()
      results.push({ org: org.name, imported: data.imported, skipped: data.skipped })
    } catch (err) {
      results.push({ org: org.name, error: 'Failed' })
    }
  }
  return NextResponse.json({ success: true, synced: orgs.length, results })
}
