import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const TRUSTED_TYPES = new Set([
  'library', 'city_hall', 'school', 'primary_school', 'secondary_school',
  'university', 'hindu_temple', 'mosque', 'synagogue', 'museum', 'art_gallery',
  'performing_arts_theater', 'music_venue', 'stadium', 'community_center', 'civic_center',
])

export const SKIP_ALWAYS_TYPES = new Set([
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

export function getBaseDomain(website: string): string {
  try {
    const url = new URL(website)
    return `${url.protocol}//${url.host}`
  } catch {
    return website
  }
}

export async function getPlaceDetails(placeId: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_address,formatted_phone_number,types&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()
  return data.result || {}
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

// PARALLELIZED: all candidate paths are checked concurrently instead of one at a time.
// Worst case drops from ~12 x 4s sequential (48s) to ~4s total.
export async function findEventPageUrl(website: string): Promise<string | null> {
  if (!website) return null
  const base = getBaseDomain(website)

  const pathChecks = EVENT_PAGE_PATHS
    .map(path => `${base}${path}`)
    .filter(candidate => !isPrivateEventUrl(candidate))

  const pathResults = await Promise.all(
    pathChecks.map(async candidate => ({
      candidate,
      exists: await pathExists('', candidate),
    }))
  )
  const directHit = pathResults.find(r => r.exists)
  if (directHit) return directHit.candidate

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
  const topCandidates = scored.slice(0, 5)

  const scoredResults = await Promise.all(
    topCandidates.map(async ({ link }) => ({ link, exists: await pathExists('', link) }))
  )
  const scoredHit = scoredResults.find(r => r.exists)
  return scoredHit ? scoredHit.link : null
}

// PARALLELIZED: all candidate feed URLs are checked concurrently instead of one at a time.
export async function detectIcalFeed(website: string): Promise<string | null> {
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

    const results = await Promise.all(
      candidates.map(async candidate => {
        try {
          const res = await fetch(candidate, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0)' },
            signal: AbortSignal.timeout(4000),
          })
          if (!res.ok) return null
          const text = await res.text()
          if (text.includes('BEGIN:VCALENDAR') && text.includes('BEGIN:VEVENT')) return candidate
          return null
        } catch {
          return null
        }
      })
    )
    const directHit = results.find(Boolean)
    if (directHit) return directHit

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

export async function assessOrg(name: string, types: string[], website: string, eventPageUrl: string | null) {
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