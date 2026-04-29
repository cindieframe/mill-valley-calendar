
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
 
const EVENT_PAGE_PATHS = [
  '/events', '/live-music', '/calendar', '/whats-on',
  '/shows', '/performances', '/public-events',
]
 
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
 

async function findPublicEventPage(website: string): Promise<boolean> {
  if (!website) return false
  const base = getBaseDomain(website)
  for (const path of EVENT_PAGE_PATHS) {
    if (await pathExists(base, path)) return true
  }
  return false
}
 
// Try to find an iCal feed URL for a given website
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
    ]
 
    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0)' },
          signal: AbortSignal.timeout(4000),
        })
        if (!res.ok) continue
        const text = await res.text()
        if (text.includes('BEGIN:VCALENDAR') && text.includes('BEGIN:VEVENT')) {
          return candidate
        }
      } catch {
        continue
      }
    }
 
    // Also scan the page source for .ics or webcal links
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
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
  return null
}
 
async function assessOrg(name: string, types: string[], website: string) {
  try {
    const prompt = `You are helping build a community events calendar for a small town.
 
Organization: ${name}
Google Place Types: ${types.join(', ')}
Website: ${website || 'unknown'}
 
Does this organization host or organize PUBLIC community events that any resident could attend?
 
Say YES for: library, community center, arts organization, recreation center, museum, theater, music venue, nonprofit serving the general public, civic organization, church with genuine community programming, school with public events, beer garden or restaurant with regular live music or public events open to all.
 
Say NO for:
- Summer camps, after-school programs, youth enrichment programs, creative camps
- Yoga studios, fitness studios whose events are paid classes for enrolled students
- Youth sports leagues and travel sports teams
- Private membership clubs
- Wedding venues or private event rental spaces
- Organizations headquartered in the town but serving a global audience with no local public events
- Medical offices, law firms, retail stores, gas stations
- Restaurants or bars whose "events" page is powered by Toast or similar reservation systems showing only private dining bookings
- Any venue where the events page requires a reservation or is clearly for private parties only
 
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
 
    // Load existing sources so we can mark already-imported orgs
    const { data: existingFeeds } = await supabase
      .from('ical_feeds')
      .select('url, organization')
    const { data: existingOrgs } = await supabase
      .from('organizations')
      .select('name, website_url')
 
    const existingFeedUrls = new Set((existingFeeds || []).map((f: any) => f.url))
    const existingOrgNames = new Set((existingOrgs || []).map((o: any) => o.name?.toLowerCase()))
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
      'cultural center', 'art club', 'arts association', 'art studio', 'yoga studio','hiking club', 'nature club', 'outdoor club', 'trails association',
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
 
    for (const place of allPlaces) {
      try {
        const details = await getPlaceDetails(place.place_id, apiKey)
        const types: string[] = details.types || []
        const website = details.website || ''
        const name = details.name || place.name
 
        if (types.some((t: string) => SKIP_ALWAYS_TYPES.has(t))) continue
 
        const isTrusted = types.some((t: string) => TRUSTED_TYPES.has(t))
        if (!isTrusted) {
          const hasPublicEvents = await findPublicEventPage(website)
          if (!hasPublicEvents) continue
        }
 
        const { likely, reason } = await assessOrg(name, types, website)
        if (!likely) continue
 
        const normalizedWebsite = website ? getBaseDomain(website) : null
        const alreadyImported =
          existingOrgNames.has(name.toLowerCase()) ||
          (normalizedWebsite !== null && existingOrgWebsites.has(normalizedWebsite))
 
        // Try to detect iCal feed
        const feedUrl = await detectIcalFeed(website)
        const feedAlreadyConnected = feedUrl ? existingFeedUrls.has(feedUrl) : false
 
        orgs.push({
          name,
          website,
          address: details.formatted_address || place.formatted_address || '',
          phone: details.formatted_phone_number || '',
          reason,
          place_id: place.place_id,
          feed_url: feedUrl,
          already_imported: alreadyImported,
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
      orgs,
    })
 
  } catch (error) {
    console.error('Discover orgs error:', error)
    return NextResponse.json({ error: 'Discovery failed' }, { status: 500 })
  }
}