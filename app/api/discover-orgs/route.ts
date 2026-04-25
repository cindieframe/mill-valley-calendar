import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// =============================================================================
// TRUSTED PLACE TYPES
// These Google place types go straight to Claude Haiku without needing to prove
// they have an events page. The reasoning is that these organizations almost
// always host public community events by their very nature. Requiring an events
// page check for a library or music venue would cause us to miss orgs whose
// websites are outdated or structured unusually.
//
// Note: churches were intentionally removed from this list after real-world
// testing showed too many small congregations appearing whose "events" were
// just private Sunday services. Churches now must prove a public events page
// exists, just like restaurants and bars.
// =============================================================================
const TRUSTED_TYPES = new Set([
  'library',
  'city_hall',
  'school',
  'primary_school',
  'secondary_school',
  'university',
  'hindu_temple',
  'mosque',
  'synagogue',
  'museum',
  'art_gallery',
  'performing_arts_theater',
  'music_venue',
  'stadium',
  'community_center',
  'civic_center',
])

// =============================================================================
// SKIP ALWAYS TYPES
// Parks and natural features are LOCATIONS for events, not organizers of them.
// Wedding venues are private hire spaces. We drop these immediately without
// any further checks — no events page check, no Claude call.
// =============================================================================
const SKIP_ALWAYS_TYPES = new Set([
  'park',
  'natural_feature',
  'campground',
  'rv_park',
  'cemetery',
])

// =============================================================================
// EVENT PAGE PATHS
// For orgs that aren't in our trusted list, we try fetching each of these
// paths on their domain. If any returns HTTP 200, they have a real public
// events page and advance to Claude.
//
// This list is intentionally SHORT and specific. Early versions included
// generic paths like /schedule, /classes, /programs, and /community, which
// caused false positives — a travel baseball league has a /schedule page,
// a restaurant might have a /programs page for loyalty rewards. We keep only
// paths that are unambiguous signals of a public events calendar. Almost
// nobody creates a /live-music or /performances page unless they actually
// have public events.
// =============================================================================
const EVENT_PAGE_PATHS = [
  '/events',
  '/live-music',
  '/calendar',
  '/whats-on',
  '/shows',
  '/performances',
  '/public-events',   // Added specifically for Outdoor Art Club pattern
]

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

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

// Extracts just the protocol and host from a full URL so we can append our
// own test paths. For example "https://www.thejunc.com/about" becomes
// "https://www.thejunc.com" so we can then try "https://www.thejunc.com/live-music"
function getBaseDomain(website: string): string {
  try {
    const url = new URL(website)
    return `${url.protocol}//${url.host}`
  } catch {
    return website
  }
}

// Tries to fetch a specific path using a GET request and returns true if
// the server responds with HTTP 200. We use GET rather than HEAD because
// many servers (particularly those on Squarespace and similar platforms)
// block HEAD requests and return 405 even when the page genuinely exists.
// We only read the first 500 bytes — enough to confirm the page exists
// without downloading the whole thing, which keeps this fast.
async function pathExists(base: string, path: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}${path}`, {
      method: 'GET',
      signal: AbortSignal.timeout(4000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0)',
        'Range': 'bytes=0-500',
      },
      redirect: 'follow',
    })
    return res.ok
  } catch {
    return false
  }
}

// Loops through our EVENT_PAGE_PATHS and returns true as soon as any one
// of them responds with 200. Returns false if none match, meaning this org
// has no detectable public events page.
// Important: for ambiguous orgs like restaurants and bars, returning false
// here means exclusion — we do NOT give benefit of the doubt. Most
// restaurants don't have public events, so silence means no.
async function findPublicEventPage(website: string): Promise<boolean> {
  if (!website) return false
  const base = getBaseDomain(website)
  for (const path of EVENT_PAGE_PATHS) {
    const exists = await pathExists(base, path)
    if (exists) {
      // Temporary: log exactly which path matched so we can identify the culprit
     
      return true
    }
  }
  return false
}

// Stage 2 — asks Claude Haiku to make the final yes/no assessment.
// By the time we reach this function, ambiguous orgs have already proven
// they have a public events page. Haiku handles the nuanced cases our
// rules can't catch in code: summer camps, private membership clubs,
// global nonprofits with a local PO Box, youth sports leagues, and so on.
async function assessOrg(name: string, types: string[], website: string) {
  try {
    const prompt = `You are helping build a community events calendar for a small town.

Organization: ${name}
Google Place Types: ${types.join(', ')}
Website: ${website || 'unknown'}

Does this organization host or organize PUBLIC community events that any resident could attend?

Say YES for: library, community center, arts organization, recreation center, museum, theater, music venue, nonprofit serving the general public, civic organization, church with genuine community programming, school with public events, beer garden or restaurant with regular live music or public events open to all.

Say NO for:
- Summer camps, after-school programs, youth enrichment programs, creative camps (these serve enrolled children not the general public)
- Yoga studios, fitness studios, or wellness centers whose events are paid classes for enrolled students rather than open community events
- Youth sports leagues and travel sports teams
- Private membership clubs where events are only for members
- Wedding venues or private event rental spaces with no public programming
- Organizations headquartered in the town but serving a global or national audience with no local public events
- Medical offices, law firms, retail stores, gas stations

Also suggest what category their events would likely fall into from this list:
- outdoors, arts, food, community, youth, classes, gov

Respond in this exact format with no extra text:
LIKELY_EVENTS: yes/no
REASON: one short sentence
CATEGORIES: category1,category2`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const likelyMatch = text.match(/LIKELY_EVENTS:\s*(yes|no)/i)
    const reasonMatch = text.match(/REASON:\s*([^\n]+)/)
    const catMatch = text.match(/CATEGORIES:\s*([^\n]+)/)

    return {
      likely: likelyMatch?.[1]?.toLowerCase() === 'yes',
      reason: reasonMatch?.[1]?.trim() || '',
      categories: catMatch?.[1]?.trim() || 'community'
    }
  } catch {
    // If Claude fails for any reason, default to including the org.
    // Better to include a false positive a human can remove than to
    // silently drop a genuine community organization.
    return { likely: true, reason: '', categories: 'community' }
  }
}

// =============================================================================
// MAIN ROUTE HANDLER
// =============================================================================

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

    const location = `${town}, ${state || 'CA'}`

    // We cast a deliberately wide net including restaurants, bars, beer gardens,
    // and cafés because some of them genuinely host public community events —
    // The Depot and The Junction are perfect examples. The ambiguous ones get
    // filtered in Gate 3 by the events page check, so casting wide at Stage 1
    // only costs us a few extra network requests, not false positives in results.
    const searchQueries = [
      'library',
      'community center',
      'arts center theater',
      'parks and recreation',
      'chamber of commerce',
      'museum',
      'nonprofit organization',
      'school district',
      'city government',
      'church community events',
      'restaurant',
      'bar music venue',
      'music venue',
      'bookstore',
      'café',
      'beer garden',          // Added: catches The Junction specifically
      'winery',               // Added: important for Napa/Sonoma expansion
      'civic center',
      'cultural center',
      'art club',             // Added: catches Outdoor Art Club
      'arts association',     // Added: catches similar orgs
      'art studio',           // Added: catches Mystic and similar
      'yoga studio',          // Added: many yoga studios have public classes
    ]

    const allPlaces: any[] = []
    const seenIds = new Set<string>()

    for (const query of searchQueries) {
      const results = await searchPlaces(query, location, apiKey)
      // We take up to 5 results per query rather than 3, giving lower-ranked
      // but genuinely relevant venues like The Junction a chance to appear.
      // Google's rankings shift slightly between runs which causes some
      // variability in results — this is a known limitation of querying
      // a live search engine rather than a fixed database.
      for (const place of results.slice(0, 5)) {
        if (!seenIds.has(place.place_id)) {
          // City name filter — only accept places whose Google address contains
          // the town name. This prevents drift into neighboring towns like
          // Sausalito or Tiburon. Note that PO Boxes in the town will pass
          // this filter, but that's acceptable — human review handles those
          // edge cases better than any code filter we could write.
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


        // --- GATE 1: Hard skip for parks and natural features ---
        // These are venues, not organizers. We drop them immediately.
        if (types.some(t => SKIP_ALWAYS_TYPES.has(t))) continue

        // --- GATE 2: Trusted types skip the events page check ---
        // Libraries, music venues, city halls etc. go straight to Claude.
        // We trust Google's classification enough that requiring an events
        // page would cause more false negatives than it prevents.
        const isTrusted = types.some(t => TRUSTED_TYPES.has(t))

        if (!isTrusted) {
          // --- GATE 3: Everything else must prove a public events page ---
          // This is the heart of the inclusion model. We don't assume
          // restaurants, bars, nonprofits, or generic establishments have
          // events. They must show us a real page at a specific path.
          // If nothing is found, we skip them — no benefit of the doubt
          // for ambiguous types, because most of them don't have events.
          const hasPublicEvents = await findPublicEventPage(website)
          if (!hasPublicEvents) continue
        }

        // --- GATE 4: Claude Haiku makes the final nuanced assessment ---
        // Trusted orgs passed Gate 2. Ambiguous orgs proved a real events
        // page in Gate 3. Now Claude handles the cases our rules can't:
        // summer camps, travel sports leagues, membership clubs, and global
        // nonprofits with a local mailing address.
        const { likely, reason, categories } = await assessOrg(
          details.name || place.name,
          types,
          website
        )

        if (likely) {
          orgs.push({
            name: details.name || place.name,
            website,
            address: details.formatted_address || place.formatted_address || '',
            phone: details.formatted_phone_number || '',
            categories,
            reason,
            place_id: place.place_id,
          })
        }

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