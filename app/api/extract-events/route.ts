import { NextRequest, NextResponse } from 'next/server'
import ICAL from 'ical.js'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../../supabase'
 
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
 
async function detectIcalFeed(url: string): Promise<string | null> {
  const base = new URL(url)
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
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0; +https://www.townstir.com)' },
        signal: AbortSignal.timeout(5000),
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
 
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0; +https://www.townstir.com)' },
      signal: AbortSignal.timeout(10000),
    })
    if (res.ok) {
      const html = await res.text()
      const icsMatch = html.match(/["'](https?:\/\/[^"']+\.ics[^"']*?)["']/i)
      const webcalMatch = html.match(/["'](webcal:\/\/[^"']+?)["']/i)
      const feedUrl = icsMatch?.[1] || webcalMatch?.[1]?.replace('webcal://', 'https://')
      if (feedUrl) {
        const check = await fetch(feedUrl, { signal: AbortSignal.timeout(5000) })
        const text = await check.text()
        if (text.includes('BEGIN:VCALENDAR')) return feedUrl
      }
    }
  } catch {
    // ignore
  }
 
  return null
}
 
export async function POST(request: NextRequest) {
  try {
    const { websiteUrl, organization, isAggregator: isAggregatorParam } = await request.json()
 
    if (!websiteUrl || !organization) {
      return NextResponse.json({ error: 'websiteUrl and organization required' }, { status: 400 })
    }
 
    // Check if this org is flagged as an aggregator in the organizations table
    // or if the caller explicitly passed isAggregator: true
    let isAggregator = isAggregatorParam === true
    if (!isAggregator) {
      const { data: orgData } = await supabase
        .from('organizations')
        .select('is_aggregator')
        .ilike('name', organization)
        .single()
      if (orgData?.is_aggregator) isAggregator = true
    }
 
    // Step 1 — try to find an iCal feed first
    const detectedFeed = await detectIcalFeed(websiteUrl)
    if (detectedFeed) {
      try {
        const feedRes = await fetch(detectedFeed, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0; +https://www.townstir.com)' },
          signal: AbortSignal.timeout(10000),
        })
        const feedText = await feedRes.text()
        const jcalData = ICAL.parse(feedText)
        const comp = new ICAL.Component(jcalData)
        const vevents = comp.getAllSubcomponents('vevent')
        const today = new Date().toISOString().split('T')[0]
        let imported = 0
        let skipped = 0
        const results = []
 
        for (const vevent of vevents) {
          const ev = new ICAL.Event(vevent)
          const start = ev.startDate?.toJSDate()
          const dateStr = start ? new Date(start).toISOString().split('T')[0] : null
          if (!dateStr || dateStr < today) { skipped++; continue }
 
          const { data: existing } = await supabase
            .from('events').select('id').eq('title', ev.summary || '').eq('date', dateStr).single()
          if (existing) { skipped++; continue }
 
          const timeStr = start ? new Date(start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null
 
          const { error } = await supabase.from('events').insert([{
            title: ev.summary || 'Untitled Event',
            date: dateStr,
            time: timeStr,
            location: ev.location || organization,
            address: ev.location || '',
            organization: organization,
            category: 'community',
            tags: '',
            description: ev.description || '',
            website: vevent.getFirstPropertyValue('url') || websiteUrl,
            status: 'pending',
            is_aggregator: isAggregator,
            extracted_organizer: null,
          }])
 
          if (!error) {
            imported++
            results.push({ title: ev.summary, date: dateStr, time: timeStr, categories: 'community', tags: '' })
          } else {
            skipped++
          }
        }
 
        return NextResponse.json({
          success: true, imported, skipped,
          total: imported + skipped, results, errors: [],
          feedDetected: detectedFeed,
          message: `✅ Found iCal feed automatically! Used ${detectedFeed} instead of scraping.`
        })
      } catch {
        // iCal parse failed — fall through to Claude
      }
    }
 
    // Step 2 — no feed found, fall back to Claude extraction
    let pageText = ''
    try {
      const response = await fetch(websiteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Townstir/1.0; +https://www.townstir.com)',
        },
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) {
        return NextResponse.json({ error: `Could not fetch that URL (HTTP ${response.status}). Check the address and try again.` }, { status: 400 })
      }
      const html = await response.text()
      pageText = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<svg[\s\S]*?<\/svg>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60000)
    } catch (err) {
      return NextResponse.json({ error: `Could not reach that URL. Make sure it is correct and publicly accessible.` }, { status: 400 })
    }
 
    const today = new Date().toISOString().split('T')[0]
 
    // If this is an aggregator, ask Claude to also identify the real organizer per event
    const aggregatorInstructions = isAggregator ? `
IMPORTANT: "${organization}" is an event aggregator, not an event organizer. For each event, try to identify the actual organization hosting the event (e.g. the theater, school, nonprofit, or business running it). Put the real organizer name in the "extracted_organizer" field. If you cannot determine the real organizer, leave "extracted_organizer" as null.
` : ''
 
    const aggregatorField = isAggregator ? `
      "extracted_organizer": "Name of the actual organizing org, or null if unknown",` : ''
 
    const prompt = `You are extracting upcoming community events from a website for a local calendar in Mill Valley, CA.
 
Today's date is ${today}. Extract ONLY upcoming events (today or future). Ignore past events.
 
WEBSITE URL: ${websiteUrl}
ORGANIZATION: ${organization}
${aggregatorInstructions}
PAGE TEXT:
${pageText}
 
Extract every event you can find. For each event return a JSON object.
 
Also assign categories (pick all that apply):
- outdoors (hikes, sports, yoga, fitness, nature, running, dance)
- arts (concerts, theater, film, art, music, performances)
- food (farmers markets, food events, wine, mixers, potlucks)
- community (volunteering, cleanups, neighborhood, nonprofit)
- family (kids, children, youth, storytime, school)
- classes (workshops, lectures, lessons, classes, learning)
- gov (city council, planning, town hall, government meetings)
 
And tags (pick all that apply):
- free (if the event is free)
- family (if family-friendly)
- wellness (if health or wellness focused)
- reg (if registration required)
 
Return ONLY valid JSON, no markdown, no explanation. Use this exact shape:
{
  "events": [
    {
      "title": "Event name",
      "date": "YYYY-MM-DD",
      "time": "7:00 PM",
      "location": "Venue name or address, or null",
      "description": "1-2 sentence description, or null",
      "website": "Direct URL to event page if available, or null",
      "category": "outdoors,arts",
      "tags": "free,family",
      "image_url": "https://... or null",${aggregatorField}
    }
  ],
  "errors": ["reason if any events were skipped or uncertain"]
}
 
Rules:
- date must be YYYY-MM-DD format
- time should be human-readable like "7:00 PM" or "All day" or null if unknown
- If a date is ambiguous or you cannot determine the year, skip that event and note it in errors
- If you find no upcoming events, return an empty events array`
 
    const aiResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
 
    const rawText = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : ''
    const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
 
    let parsed: { events: any[]; errors: string[] }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({
        error: 'Claude could not parse the page into events. Try a more specific events page URL (e.g. /events or /calendar).',
      }, { status: 422 })
    }
 
    if (!parsed.events || parsed.events.length === 0) {
      return NextResponse.json({
        imported: 0, skipped: 0, total: 0, results: [],
        errors: parsed.errors || [],
        message: 'No upcoming events found on that page. Try linking directly to the events or calendar page.',
      })
    }
 
    let imported = 0
    let skipped = 0
    const results = []
 
    for (const ev of parsed.events) {
      if (!ev.date || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) { skipped++; continue }
      if (ev.date < today) { skipped++; continue }
 
      const { data: existing } = await supabase
        .from('events').select('id').eq('title', ev.title).eq('date', ev.date).single()
      if (existing) { skipped++; continue }
 
      const { error } = await supabase.from('events').insert([{
        title: ev.title,
        date: ev.date,
        time: ev.time || null,
        location: ev.location || organization,
        address: ev.location || '',
        organization: organization,
        category: ev.category || 'community',
        tags: ev.tags || '',
        description: ev.description || '',
        website: ev.website || websiteUrl,
        image_url: ev.image_url || null,
        status: 'pending',
        is_aggregator: isAggregator,
        extracted_organizer: isAggregator ? (ev.extracted_organizer || null) : null,
      }])
 
      if (!error) {
        imported++
        results.push({ title: ev.title, date: ev.date, time: ev.time, categories: ev.category, tags: ev.tags })
      } else {
        skipped++
      }
    }
 
    return NextResponse.json({ success: true, imported, skipped, total: parsed.events.length, results, errors: parsed.errors || [] })
 
  } catch (error) {
    console.error('Extract events error:', error)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}