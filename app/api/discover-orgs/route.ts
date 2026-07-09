import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../../supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TRUSTED_TYPES = new Set([
  'library', 'city_hall', 'school', 'primary_school', 'secondary_school',
  'university', 'hindu_temple', 'mosque', 'synagogue', 'museum', 'art_gallery',
  'performing_arts_theater', 'music_venue', 'stadium', 'community_center', 'civic_center',
])

const SKIP_ALWAYS_TYPES = new Set([
  'park', 'natural_feature', 'campground', 'rv_park', 'cemetery',
])

const EVENT_KEYWORDS = [
  'events', 'calendar', 'live-music', 'whats-on', 'what-s-on',
  'shows', 'performances', 'public-events', 'happenings', 'upcoming',
  'concerts', 'programming', 'schedule',
]

const PRIVATE_URL_PATTERNS = [
  'private-event', 'private_event', 'privateevents',
  'catering', 'rental', 'rent-a', 'wedding', 'banquet', 'buyout',
]

const EVENT_PAGE_PATHS = [
  '/events', '/calendar', '/live-music', '/whats-on',
  '/shows', '/performances', '/public-events',
  '/events/calendar', '/community/events', '/our-events',
  '/city-government/city-calendar', '/departments/parks-and-recreation/events',
  '/community-events', '/what-s-on', '/upcoming-events',
]

function isPrivateEventUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return PRIVATE_URL_PATTERNS.some(p => lower.includes(p))
}

async function searchPlaces(query: string, location: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + location)}&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()
  return data.results || []
}

async function getPlaceDetails(placeId: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_address,formatted_phone_number,types&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()
  return data.result || {}
}

function getBaseDomain(website: string): string {
  try {
    const url = new URL(website)
    return `${url.protocol}//${url.host}`
  } catch {
    return website
  }
}

async function fetchHtml(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0)' },
      redirect: 'follow',
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

async function pathExists(base: string, path: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0)', 'Range': 'bytes=0-500' },
      redirect: 'follow',
    })
    return res.ok
  } catch {
    return false
  }
}

async function findEventPageUrl(website: string): Promise<string | null> {
  if (!website) return null
  const base = getBaseDomain(website)

  for (const path of EVENT_PAGE_PATHS) {
    const candidate = `${base}${path}`
    if (isPrivateEventUrl(candidate)) continue
    if (await pathExists(base, path)) return candidate
  }

  const html = await fetchHtml(website)
  if (!html) return null

  const hrefMatches = [...html.matchAll(/href=["']([^"']+)["']/gi)]
  const links = hrefMatches
    .map(m => m[1])
    .filter(href => {
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false
      if (href.startsWith('http') && !href.includes(new URL(website).host)) return false
      return true
    })
    .map(href => {
      if (href.startsWith('http')) return href
      if (href.startsWith('/')) return `${base}${href}`
      return `${base}/${href}`
    })

  const scored = links.map(link => {
    const lower = link.toLowerCase()
    const score = EVENT_KEYWORDS.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0)
    return { link, score }
  }).filter(s => s.score > 0 && !isPrivateEventUrl(s.link))

  scored.sort((a, b) => b.score - a.score)

  for (const { link } of scored.slice(0, 5)) {
    if (await pathExists('', link)) return link
  }

  return null
}

async function detectIcalFeed(website: string): Promise<string | null> {
  if (!website) return null
  try {
    const base = new URL(website)
    const origin = base.origin
    const pathname = base.pathname.replace(/\/$/, '')

    const candidates = [
      `${origin}${pathname}?format=ical`,
      `${origin}/events?format=ical`,
      `${origin}/events/?ical=1`,
      `${origin}${pathname}/?ical=1`,
      `${origin}/events/feed/ical`,
      `${origin}/calendar.ics`,
      `${origin}/events.ics`,
      `${origin}/feed.ics`,
      `${origin}${pathname}.ics`,
      `${origin}/rss.aspx?CID=1`,
      `${origin}/feed/ical`,
      `${origin}/events/feed`,
    ]

    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0)' },
          signal: AbortSignal.timeout(4000),
        })
        if (!res.ok) continue
        const text = await res.text()
        if (text.includes('BEGIN:VCALENDAR') && text.includes('BEGIN:VEVENT')) return candidate
      } catch { continue }
    }

    try {
      const res = await fetch(website, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0)' },
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok) {
        const html = await res.text()
        const icsMatch = html.match(/["'](https?:\/\/[^"']+\.ics[^"']*?)["']/i)
        const webcalMatch = html.match(/["'](webcal:\/\/[^"']+?)["']/i)
        const feedUrl = icsMatch?.[1] || webcalMatch?.[1]?.replace('webcal://', 'https://')
        if (feedUrl) {
          const check = await fetch(feedUrl, { signal: AbortSignal.timeout(4000) })
          const text = await check.text()
          if (text.includes('BEGIN:VCALENDAR')) return feedUrl
        }
      }
    } catch { }
  } catch { }
  return null
}

async function assessOrg(name: string, types: string[], website: string, eventPageUrl: string | null) {
  try {
    const prompt = `You are helping build a community events calendar for a small town.

Organization: ${name}
Google Place Types: ${types.join(', ')}
Website: ${website || 'unknown'}
Events page URL: ${eventPageUrl || 'none found'}

Does this organization host or organize PUBLIC community events that any resident could attend?

IMPORTANT: Look carefully at the events page URL. If it contains words like "private", "catering", "rental", "wedding", or "banquet" — say NO. Those are private venue rental pages, not public community events.

Say YES for: library, community center, arts organization, recreation center, museum, theater, music venue, nonprofit serving the general public, civic organization, church with genuine community programming, school with public events, beer garden or restaurant with regular live music or public events open to all.

Say NO for:
- Restaurants or bars whose only events are private dining or catering
- Private event venues, wedding venues, banquet halls
- Summer camps, after-school programs, youth enrichment programs
- Yoga studios, fitness studios with paid enrolled classes only
- Youth sports leagues and travel sports teams
- Private membership clubs
- Medical offices, law firms, retail stores, gas stations
- Conference centers or retreat centers that only serve groups, not the general public

Respond in this exact format with no extra text:
LIKELY_EVENTS: yes/no
REASON: one short sentence`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const likelyMatch = text.match(/LIKELY_EVENTS:\s*(yes|no)/i)
    const reasonMatch = text.match(/REASON:\s*([^\n]+)/)

    return {
      likely: likelyMatch?.[1]?.toLowerCase() === 'yes',
      reason: reasonMatch?.[1]?.trim() || '',
    }
  } catch {
    return { likely: true, reason: '' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { town, state } = await request.json()
    if (!town) {
      return NextResponse.json({ error: 'town is required' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
    }

    const { data: existingFeeds } = await supabase
      .from('ical_feeds')
      .select('url, organization')

    const { data: orgsWithEvents } = await supabase
      .from('events')
      .select('organization')
      .eq('status', 'approved')
      .eq('town', town)

    const { data: existingOrgs } = await supabase
      .from('organizations')
      .select('name, website_url, last_extracted_at, place_id')

    // NEW: pull blocked orgs for this town so we can skip them before doing any work
    const { data: blockedOrgsData } = await supabase
      .from('blocked_orgs')
      .select('place_id')
      .eq('town', town)

    const blockedPlaceIds = new Set((blockedOrgsData || []).map((b: any) => b.place_id))

    const existingFeedUrls = new Set((existingFeeds || []).map((f: any) => f.url))
    const orgsWithEventNames = new Set((orgsWithEvents || []).map((e: any) => e.organization?.toLowerCase()))
    const existingOrgWebsites = new Set(
      (existingOrgs || []).map((o: any) => {
        try { return getBaseDomain(o.website_url) } catch { return null }
      }).filter(Boolean)
    )

    const location = `${town}, ${state || 'CA'}`

    const searchQueries = [
      'library', 'community center', 'arts center theater', 'parks and recreation',
      'chamber of commerce', 'museum', 'nonprofit organization', 'school district',
      'city government', 'church community events', 'restaurant', 'bar music venue',
      'music venue', 'bookstore', 'café', 'beer garden', 'winery', 'civic center',
      'cultural center', 'art club', 'arts association', 'art studio', 'yoga studio',
      'hiking club', 'nature club', 'outdoor club', 'trails association',
      'friends of', 'garden club', 'historical society', 'rotary club',
      'lions club', 'volunteer fire', 'neighborhood association',
    ]

    const allPlaces: any[] = []
    const seenIds = new Set<string>()

    for (const query of searchQueries) {
      const results = await searchPlaces(query, location, apiKey)
      for (const place of results.slice(0, 3)) {
        if (!seenIds.has(place.place_id)) {
          const address = place.formatted_address || ''
          if (address.toLowerCase().includes(town.toLowerCase())) {
            seenIds.add(place.place_id)
            allPlaces.push(place)
          }
        }
      }
    }

    const orgs = []
    let blockedSkipped = 0
    let alreadyKnownSkipped = 0

    const knownPlaceIds = new Set(
      (existingOrgs || []).map((o: any) => o.place_id).filter(Boolean)
    )
    const feedOrgNames = new Set(
      (existingFeeds || []).map((f: any) => f.organization?.toLowerCase())
    )
    const extractedOrgWebsites = new Set(
      (existingOrgs || [])
        .filter((o: any) => o.last_extracted_at !== null)
        .map((o: any) => { try { return getBaseDomain(o.website_url) } catch { return null } })
        .filter(Boolean)
    )
    const extractedOrgNames = new Set(
      (existingOrgs || [])
        .filter((o: any) => o.last_extracted_at !== null)
        .map((o: any) => o.name?.toLowerCase())
        .filter(Boolean)
    )

    for (const place of allPlaces) {
      try {
        // --- SKIP CHECK 1: blocked (place_id only, no fetch needed) ---
        if (blockedPlaceIds.has(place.place_id)) {
          blockedSkipped++
          continue
        }

        // --- SKIP CHECK 2: already known by place_id or by name from the text-search result ---
        // (place.name comes free from the text search — no need to call getPlaceDetails to check this)
        const searchName = (place.name || '').toLowerCase()
        const knownByPlaceId = knownPlaceIds.has(place.place_id)
        const knownByName =
          orgsWithEventNames.has(searchName) ||
          feedOrgNames.has(searchName) ||
          extractedOrgNames.has(searchName)

        if (knownByPlaceId || knownByName) {
          orgs.push({
            name: place.name,
            website: '',
            extraction_url: '',
            address: place.formatted_address || '',
            phone: '',
            reason: '',
            place_id: place.place_id,
            feed_url: null,
            already_imported: true,
            feed_already_connected: false,
          })
          alreadyKnownSkipped++
          continue
        }

        // From here on we need official details (name/website/types) — one fetch, unavoidable.
        const details = await getPlaceDetails(place.place_id, apiKey)
        const types: string[] = details.types || []
        const website = details.website || ''
        const name = details.name || place.name

        if (types.some((t: string) => SKIP_ALWAYS_TYPES.has(t))) continue

        // --- SKIP CHECK 3: already known by website, now that we have it ---
        const normalizedWebsite = website ? getBaseDomain(website) : null
        const knownByWebsite =
          (normalizedWebsite !== null && existingOrgWebsites.has(normalizedWebsite)) ||
          (normalizedWebsite !== null && extractedOrgWebsites.has(normalizedWebsite))

        if (knownByWebsite) {
          orgs.push({
            name,
            website,
            extraction_url: website,
            address: details.formatted_address || place.formatted_address || '',
            phone: details.formatted_phone_number || '',
            reason: '',
            place_id: place.place_id,
            feed_url: null,
            already_imported: true,
            feed_already_connected: false,
          })
          alreadyKnownSkipped++
          continue
        }

        // Not blocked, not already known — do the expensive work.
        const isTrusted = types.some((t: string) => TRUSTED_TYPES.has(t))
        const eventPageUrl = await findEventPageUrl(website)

        if (!isTrusted && !eventPageUrl) continue

        const { likely, reason } = await assessOrg(name, types, website, eventPageUrl)
        if (!likely) continue

        const feedUrl = await detectIcalFeed(website)
        const feedAlreadyConnected = feedUrl ? existingFeedUrls.has(feedUrl) : false

        orgs.push({
          name,
          website,
          extraction_url: eventPageUrl || website,
          address: details.formatted_address || place.formatted_address || '',
          phone: details.formatted_phone_number || '',
          reason,
          place_id: place.place_id,
          feed_url: feedUrl,
          already_imported: false,
          feed_already_connected: feedAlreadyConnected,
        })

      } catch (err) {
        console.error('Error processing place:', place.name, err)
      }
    }

    orgs.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      success: true,
      town: location,
      total_found: allPlaces.length,
      orgs_with_events: orgs.length,
      blocked_skipped: blockedSkipped,
      already_known_skipped: alreadyKnownSkipped,
      orgs,
    })

  } catch (error) {
    console.error('Discover orgs error:', error)
    return NextResponse.json({ error: 'Discovery failed' }, { status: 500 })
  }
}