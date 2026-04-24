import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Search Google Places for orgs of a specific type in a town
async function searchPlaces(query: string, location: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query + ' ' + location)}&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()
  return data.results || []
}

// Get place details including website
async function getPlaceDetails(placeId: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_address,formatted_phone_number,types&key=${apiKey}`
  const res = await fetch(url)
  const data = await res.json()
  return data.result || {}
}

// Ask Claude to assess if an org is likely to have public events
async function assessOrg(name: string, types: string[], website: string) {
  try {
    const prompt = `You are helping build a community events calendar. 

Organization: ${name}
Google Place Types: ${types.join(', ')}
Website: ${website || 'unknown'}

Is this organization likely to host or organize PUBLIC community events that residents would want to know about?
Examples of YES: library, community center, arts organization, school, church, park, museum, theater, venue, nonprofit
Examples of NO: restaurant (unless event venue), retail store, gas station, medical office, law firm

Also suggest what category their events would likely fall into:
- outdoors, arts, food, community, family, classes, gov

Respond in this exact format:
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
    return { likely: true, reason: '', categories: 'community' }
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

    const location = `${town}, ${state || 'CA'}`

    // Search for different types of community orgs
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
    ]

    const allPlaces: any[] = []
    const seenIds = new Set<string>()

    for (const query of searchQueries) {
      const results = await searchPlaces(query, location, apiKey)
      for (const place of results.slice(0, 3)) {
        if (!seenIds.has(place.place_id)) {
          seenIds.add(place.place_id)
          allPlaces.push(place)
        }
      }
    }

    // Get details and assess each org
    const orgs = []
    for (const place of allPlaces) {
      try {
        const details = await getPlaceDetails(place.place_id, apiKey)
        const { likely, reason, categories } = await assessOrg(
          details.name || place.name,
          details.types || [],
          details.website || ''
        )

        if (likely) {
          orgs.push({
            name: details.name || place.name,
            website: details.website || '',
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

    // Sort by name
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