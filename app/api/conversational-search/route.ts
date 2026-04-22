import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

function getDateContext() {
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const day = TODAY.getDay()

  const tomorrow = new Date(TODAY)
  tomorrow.setDate(TODAY.getDate() + 1)

  const satOffset = ((6 - day + 7) % 7) || 7
  const sat = new Date(TODAY); sat.setDate(TODAY.getDate() + satOffset)
  const sun = new Date(TODAY); sun.setDate(TODAY.getDate() + satOffset + 1)

  const nextSat = new Date(sat); nextSat.setDate(sat.getDate() + 7)
  const nextSun = new Date(sun); nextSun.setDate(sun.getDate() + 7)

  const weekEnd = new Date(TODAY)
  weekEnd.setDate(TODAY.getDate() + (7 - day))

  return {
    today: fmt(TODAY),
    tomorrow: fmt(tomorrow),
    thisWeekendSat: fmt(sat),
    thisWeekendSun: fmt(sun),
    nextWeekendSat: fmt(nextSat),
    nextWeekendSun: fmt(nextSun),
    thisWeekEnd: fmt(weekEnd),
  }
}

export async function POST(req: NextRequest) {
  let query = ''
  try {
    const body = await req.json()
    query = body.query
    if (!query) return NextResponse.json({ error: 'No query' }, { status: 400 })

    const dates = getDateContext()

    const systemPrompt = `You are a search assistant for Townstir, a community events calendar for Mill Valley, CA.
Today's date is ${dates.today}.

Given a natural language search query, extract structured search filters as JSON.

Available categories (use the key values only):
- outdoors (Outdoors, Sports & Movement — hiking, running, biking, yoga, fitness, swimming, sports, trails, nature, movement, exercise, dance, martial arts, tai chi, pilates)
- arts (Arts & Performances — music, concerts, bands, live music, theater, theatre, dance performance, art, gallery, film, movies, opera, symphony, choir, singing, poetry, readings, comedy, improv, storytelling, crafts, painting, drawing, sculpture, photography)
- food (Food, Drink & Social — dinner, lunch, brunch, wine, beer, cocktails, tasting, restaurant, food, cooking, baking, mixology, happy hour, social, networking, meetup, gathering)
- community (Volunteer & Community — volunteer, cleanup, donation, fundraiser, charity, community service, activism, advocacy, neighborhood, civic, environmental, gardening, stewardship)
- youth (Family & Youth — kids, children, toddler, baby, infant, family, storytime, youth, teen, teenager, after school, summer camp, field trip, playground)
- classes (Classes & Lectures — class, workshop, seminar, lecture, course, lesson, training, tutorial, talk, presentation, panel, discussion, demonstration, learn, education, certification)
- gov (Local Government — city council, town hall, planning commission, board meeting, government, public hearing, zoning, elections, vote, mayor, supervisor)

Available tags (use the key values only):
- free (free, no cost, no charge, complimentary)
- family (family-friendly, all ages, kids welcome, family event)
- wellness (health, wellness, mental health, meditation, mindfulness, healing, therapy)
- reg (registration required, RSVP, ticketed, reserve, sign up)

Date reference:
- today = ${dates.today}
- tomorrow = ${dates.tomorrow}
- tonight = ${dates.today}
- this evening = ${dates.today}
- this morning = ${dates.today}
- this afternoon = ${dates.today}
- this weekend = ${dates.thisWeekendSat} to ${dates.thisWeekendSun}
- next weekend = ${dates.nextWeekendSat} to ${dates.nextWeekendSun}
- this week = ${dates.today} to ${dates.thisWeekEnd}

Respond ONLY with a valid JSON object, no explanation, no markdown. Use this exact shape:
{
  "cats": [],
  "tags": [],
  "dateFrom": null,
  "dateTo": null,
  "keyword": ""
}

Rules:
- cats: array of matching category keys, or empty array
- tags: array of matching tag keys, or empty array  
- dateFrom / dateTo: YYYY-MM-DD strings or null
- keyword: any specific remaining search term not covered by cats/tags/dates (e.g. a specific band name, venue, or topic). Keep this SHORT — 1-3 words max. If the category mapping already covers the concept, leave keyword empty.
- When in doubt about category, include it — it's better to show more results than none
- If query mentions a specific named event or performer, put that name in keyword
- "kids", "children", "toddler", "baby" -> add "family" tag AND "youth" category
- "free" -> add "free" tag
- "music", "concert", "band", "live music", "singer", "musician", "orchestra", "symphony", "choir", "jazz", "opera", "acoustic" -> DO NOT set cats. Set keyword = the most specific music term from the query (e.g. "music", "concert", "jazz", "band")
- "hike", "hiking", "trail" -> "outdoors" category AND keyword = "hike" or "trail"
- "yoga", "pilates", "tai chi" -> "outdoors" category AND keyword = the specific activity
- "painting", "drawing", "sculpture", "pottery", "ceramics" -> "arts" category AND keyword = the specific activity
- "book club", "book" -> "classes" category AND keyword = "book"
- "cooking", "baking" -> "food" category AND keyword = "cooking" or "baking"- "hike", "run", "trail", "bike", "swim", "sport" -> "outdoors" category
- "dinner", "wine", "beer", "tasting", "restaurant", "brunch" -> "food" category
- "volunteer", "cleanup", "fundraiser" -> "community" category
- "class", "workshop", "lecture", "seminar", "talk" -> "classes" category
- "city council", "planning", "government" -> "gov" category
- If the query is vague (e.g. "fun things", "what's happening") return all empty filters and empty keyword
- "tonight", "this evening", "this morning", "this afternoon" -> dateFrom and dateTo = ${dates.today}
- Always return valid JSON even if uncertain — never return an error`

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const filters = JSON.parse(cleaned)

    // Safety fallback — if cats/tags/keyword all empty and no dates, 
    // use the original query as keyword so text search still runs
    const hasFilters = 
      (filters.cats?.length > 0) || 
      (filters.tags?.length > 0) || 
      filters.dateFrom || 
      filters.keyword

    if (!hasFilters) {
      filters.keyword = query.trim()
    }

    return NextResponse.json(filters)
  } catch (err) {
    console.error('Conversational search error:', err)
    // On any error, fall back to treating the whole query as a keyword
    return NextResponse.json({ 
      cats: [], 
      tags: [], 
      dateFrom: null, 
      dateTo: null, 
      keyword: query || '' 
    })
  }
}