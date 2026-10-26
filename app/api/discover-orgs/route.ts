import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin'
import { requireAdmin, canManageTown, forbiddenTown } from '../../lib/adminAuth'
import {
  TRUSTED_TYPES,
  SKIP_ALWAYS_TYPES,
  getBaseDomain,
  getPlaceDetails,
  findEventPageUrl,
  detectIcalFeed,
  assessOrg,
} from './helpers'
import { loadTowns, matchTown } from '../../lib/towns'
import { toDomain } from '../../lib/domains'

// Vercel Hobby plan's function duration ceiling — matches what we hit
// with the old synchronous route. Bounded concurrency below is sized to
// stay well under this.
export const maxDuration = 300

// Each org's own processing (findEventPageUrl, detectIcalFeed) already fires
// 12-14 concurrent requests internally. Keeping this low avoids stacking that
// up into 100+ simultaneous outbound fetches, which appears to have been
// silently timing out real orgs. 3 matches the batch size that reliably
// found real results in the old multi-stage version.
const CONCURRENCY = 3
const PER_ORG_TIMEOUT_MS = 15000
const PER_ORG_HARD_CAP_MS = 30000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    promise.then((result) => {
      clearTimeout(timer)
      resolve(result)
    }).catch(() => {
      clearTimeout(timer)
      resolve(fallback)
    })
  })
}

// Simple bounded-concurrency runner — no new dependency needed.
// Processes `items` with at most `limit` in flight at once.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const current = nextIndex++
      if (current >= items.length) return
      results[current] = await fn(items[current], current)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

type PlacesSearch = { results: any[]; failure: string | null }

// Google answers HTTP 200 even when it refuses a request (billing off, key not
// allowed, quota) — the reason is in data.status. Report it instead of treating
// a refusal as "no results".
async function searchPlaces(query: string, location: string, apiKey: string): Promise<PlacesSearch> {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + location)}&key=${apiKey}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    const data = await res.json()
    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return { results: data.results || [], failure: null }
    }
    return { results: [], failure: `${data.status || `HTTP ${res.status}`}${data.error_message ? ` — ${data.error_message}` : ''}` }
  } catch (err) {
    return { results: [], failure: `Request failed — ${err instanceof Error ? err.message : String(err)}` }
  }
}

export async function POST(request: NextRequest) {
  // Admin-only: each run spends Google Places and Claude credits.
  const auth = await requireAdmin(request)
  if (auth.response) return auth.response
  try {
    const { town, state } = await request.json()
    if (!town) {
      return NextResponse.json({ error: 'town is required' }, { status: 400 })
    }
    if (!(await canManageTown(auth.admin, town))) return forbiddenTown(town)

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
    }

    // --- Reads only. No writes happen anywhere in this route. ---
    const [
      { data: existingFeeds },
      { data: orgsWithEvents },
      { data: existingOrgs },
      { data: blockedOrgsData },
    ] = await Promise.all([
      supabase.from('ical_feeds').select('url, organization'),
      supabase.from('events').select('organization').eq('status', 'approved').eq('town', town),
      supabase.from('organizations').select('name, website_url, last_extracted_at, place_id'),
      supabase.from('blocked_orgs').select('place_id, domain, name, town'),
    ])

    // Blocks match the town however it was typed ("San Anselmo", "San Anselmo, CA", "san-anselmo").
    const allTowns = await loadTowns()
    const searchTown = matchTown(allTowns, town)?.name ?? town
    const blockedHere = (blockedOrgsData || []).filter((b: any) =>
      (matchTown(allTowns, b.town)?.name ?? b.town) === searchTown
    )
    const blockedPlaceIds = new Set(blockedHere.map((b: any) => b.place_id).filter(Boolean))
    const blockedDomains = new Set(blockedHere.map((b: any) => b.domain).filter(Boolean))
    const blockedNames = new Set(blockedHere.map((b: any) => b.name?.toLowerCase()).filter(Boolean))
    const existingFeedUrls = new Set((existingFeeds || []).map((f: any) => f.url))
    const orgsWithEventNames = new Set((orgsWithEvents || []).map((e: any) => e.organization?.toLowerCase()))
    const knownPlaceIds = new Set((existingOrgs || []).map((o: any) => o.place_id).filter(Boolean))
    const feedOrgNames = new Set((existingFeeds || []).map((f: any) => f.organization?.toLowerCase()))
    const existingOrgWebsites = new Set(
      (existingOrgs || []).map((o: any) => {
        try { return getBaseDomain(o.website_url) } catch { return null }
      }).filter(Boolean)
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

    // Places searches run with the same bounded concurrency as org processing,
    // rather than sequentially — this was one of the two loops the old route
    // ran one-at-a-time.
    const searchResults = await mapWithConcurrency(searchQueries, CONCURRENCY, (query) =>
      searchPlaces(query, location, apiKey)
    )

    const failures = searchResults.map(r => r.failure).filter((f): f is string => f !== null)
    if (failures.length === searchResults.length) {
      console.error('[discover-orgs] Every Google Places search failed:', failures[0])
      return NextResponse.json({
        error: `Google Places refused every search: ${failures[0]}`,
      }, { status: 502 })
    }
    if (failures.length > 0) {
      console.warn(`[discover-orgs] ${failures.length} of ${searchResults.length} Places searches failed:`, failures[0])
    }

    const allPlaces: any[] = []
    const seenIds = new Set<string>()
    for (const { results } of searchResults) {
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

    let blockedSkipped = 0
    let alreadyKnownSkipped = 0
    let timedOut = 0

    async function processOneInner(place: any) {
      if (blockedPlaceIds.has(place.place_id) || blockedNames.has((place.name || '').toLowerCase())) {
        blockedSkipped++
        return null
      }

      const searchName = (place.name || '').toLowerCase()
      const knownByPlaceId = knownPlaceIds.has(place.place_id)
      const knownByName =
        orgsWithEventNames.has(searchName) ||
        feedOrgNames.has(searchName) ||
        extractedOrgNames.has(searchName)

      if (knownByPlaceId || knownByName) {
        alreadyKnownSkipped++
        return {
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
        }
      }

      try {
        const details = await withTimeout(getPlaceDetails(place.place_id, apiKey!), 10000, {})
        const types: string[] = details.types || []
        const website = details.website || ''
        const name = details.name || place.name

        if (types.some((t: string) => SKIP_ALWAYS_TYPES.has(t))) return null

        // Orgs removed with "Remove org" are blocked by website domain too.
        const domain = toDomain(website)
        if (domain && blockedDomains.has(domain)) {
          blockedSkipped++
          return null
        }

        const normalizedWebsite = website ? getBaseDomain(website) : null
        const knownByWebsite =
          (normalizedWebsite !== null && existingOrgWebsites.has(normalizedWebsite)) ||
          (normalizedWebsite !== null && extractedOrgWebsites.has(normalizedWebsite))

        if (knownByWebsite) {
          alreadyKnownSkipped++
          return {
            name, website, extraction_url: website,
            address: details.formatted_address || place.formatted_address || '',
            phone: details.formatted_phone_number || '',
            reason: '', place_id: place.place_id, feed_url: null,
            already_imported: true, feed_already_connected: false,
          }
        }

        const isTrusted = types.some((t: string) => TRUSTED_TYPES.has(t))
        const eventPageUrl = await withTimeout(findEventPageUrl(website), PER_ORG_TIMEOUT_MS, null)

        if (!isTrusted && !eventPageUrl) return null

        const { likely, reason } = await assessOrg(name, types, website, eventPageUrl)
        if (!likely) return null

        const feedUrl = await withTimeout(detectIcalFeed(website), PER_ORG_TIMEOUT_MS, null)
        const feedAlreadyConnected = feedUrl ? existingFeedUrls.has(feedUrl) : false

        return {
          name, website, extraction_url: eventPageUrl || website,
          address: details.formatted_address || place.formatted_address || '',
          phone: details.formatted_phone_number || '',
          reason, place_id: place.place_id, feed_url: feedUrl,
          already_imported: false, feed_already_connected: feedAlreadyConnected,
        }
      } catch (err) {
        console.error('Error processing place:', place.name, err)
        return null
      }
    }

    async function processOne(place: any) {
      const result = await withTimeout<Awaited<ReturnType<typeof processOneInner>> | undefined>(
        processOneInner(place),
        PER_ORG_HARD_CAP_MS,
        undefined
      )
      if (result === undefined) {
        timedOut++
        console.warn(`[discover-orgs] Org hit hard timeout cap: ${place.name} (${place.place_id})`)
        return null
      }
      return result
    }

    const processedResults = await mapWithConcurrency(allPlaces, CONCURRENCY, processOne)
    const orgs = processedResults.filter((o): o is NonNullable<typeof o> => o !== null)

    orgs.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      success: true,
      town: location,
      total_found: allPlaces.length,
      orgs_with_events: orgs.length,
      blocked_skipped: blockedSkipped,
      already_known_skipped: alreadyKnownSkipped,
      timed_out: timedOut,
      searches_failed: failures.length,
      searches_total: searchResults.length,
      search_failure: failures[0] || null,
      orgs,
    })

  } catch (error) {
    console.error('Discover orgs error:', error)
    return NextResponse.json({
      error: `Discovery failed: ${error instanceof Error ? error.message : String(error)}`
    }, { status: 500 })
  }
}
