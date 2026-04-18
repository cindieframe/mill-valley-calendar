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
  const nextSun = new Date(sun); sun.setDate(sun.getDate() + 7)

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
  try {
    const { query } = await req.json()
    if (!query) return NextResponse.json({ error: 'No query' }, { status: 400 })

    const dates = getDateContext()

    const systemPrompt = `You are a search assistant for Townstir, a community events calendar for Mill Valley, CA.
Today's date is ${dates.today}.

Given a natural language search query, extract structured search filters as JSON.

Available categories (use the key values only):
- outdoors (Outdoors, Sports & Movement)
- arts (Arts & Performances)
- food (Food, Drink & Social)
- community (Volunteer & Community)
- family (Family & Youth)
- classes (Classes & Lectures)
- gov (Local Government)

Available tags (use the key values only):
- free
- family
- wellness
- reg

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
- keyword: any remaining search term not covered by cats/tags/dates, or empty string
- "kids", "children", "toddler", "baby" → add "family" tag and "family" category
- "free" → add "free" tag
- "yoga", "meditation", "fitness", "hike", "run", "trail" → "outdoors" or "wellness" as appropriate
- "concert", "music", "theater", "art" → "arts"
- "dinner", "wine", "beer", "tasting", "restaurant" → "food"
- If the query is vague (e.g. "fun things") return all empty filters`
- "tonight", "this evening", "this morning", "this afternoon" → dateFrom and dateTo should both be ${dates.today}

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''
const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
const filters = JSON.parse(cleaned)

    return NextResponse.json(filters)
  } catch (err) {
    console.error('Conversational search error:', err)
    return NextResponse.json({ cats: [], tags: [], dateFrom: null, dateTo: null, keyword: '' })
  }
}