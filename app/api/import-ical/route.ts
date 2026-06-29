import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../../supabase'
import { shouldAutoReject, AUTO_REJECT_NOTE } from '../../lib/moderation'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Returns the UTC offset in ms for America/Los_Angeles at a given UTC date
function getPacificOffsetMs(utcDate: Date): number {
  const utcStr = utcDate.toLocaleString('en-US', { timeZone: 'UTC' })
  const ptStr = utcDate.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  return new Date(utcStr).getTime() - new Date(ptStr).getTime()
}

// Parse a DTSTART or DTEND value given the TZID found in the block
function parseICalDate(value: string, tzid: string | null): Date {
  const isoStr = value.replace(
    /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2}).*/,
    '$1-$2-$3T$4:$5:$6'
  )

  if (tzid === 'America/Los_Angeles') {
    const tempDate = new Date(isoStr + 'Z')
    return new Date(tempDate.getTime() + getPacificOffsetMs(tempDate))
  }

  if (value.endsWith('Z')) {
    return new Date(isoStr + 'Z')
  }

  // No TZID, no Z — treat as Pacific (legacy feeds)
  const tempDate = new Date(isoStr + 'Z')
  return new Date(tempDate.getTime() + getPacificOffsetMs(tempDate))
}

// Parse iCal text into event objects
function parseICal(text: string) {
  const events: any[] = []
  const eventBlocks = text.split('BEGIN:VEVENT')

  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i]

    // Unfold iCal line folding: lines wrapped with newline + space/tab are continuations
    const unfoldedBlock = block.replace(/\r?\n[ \t]/g, '')

    const get = (field: string) => {
      const match = unfoldedBlock.match(new RegExp(`${field}[^:]*:([^\r\n]+)`))
      return match ? match[1].trim() : ''
    }

    const dtstart = get('DTSTART')
    const dtend = get('DTEND')
    const summary = get('SUMMARY')

    // Strip HTML entities FIRST, then convert iCal escape sequences
    const rawDescField = get('DESCRIPTION')
      .replace(/&nbsp\\;/g, ' ')   // iCal-escaped &nbsp\; (WordPress/Events Calendar)
      .replace(/&nbsp;/g, ' ')     // standard &nbsp;
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')

    const descIsUrl = /^https?:\/\/\S+$/.test(rawDescField.trim())
    const url = descIsUrl
      ? rawDescField.trim()
      : get('URL').startsWith('http')
      ? get('URL')
      : ''

    const cleanedDesc = descIsUrl
      ? ''
      : rawDescField
          .replace(/https?:\/\/\S+/g, '')
          .replace(/#\S+/g, '')
          .replace(/@\S+/g, '')

    const junkPatterns =
      /add to cart|choose an option|sign up today|enroll|quantity|price range|materials fee|non-member|ohca member|see organizer|\$\d+\.\d+/i

    // Split into paragraphs on double newlines
    const paragraphs = cleanedDesc.split(/\n{2,}/)
    const cleanParagraphs: string[] = []

    for (const para of paragraphs) {
      // Filter out blank lines and lines that are only whitespace/nbsp after trimming
      const lines = para.split('\n').map((l: string) => l.trim()).filter((l: string) => l.replace(/[\s\u00a0•]/g, '').length > 0)
      const cleanLines: string[] = []
      let hitJunk = false

      for (const line of lines) {
        if (junkPatterns.test(line)) { hitJunk = true; break }
        cleanLines.push(line)
      }

      if (cleanLines.length === 0) continue

      // Multiple lines in a paragraph = bullet list
      const paraText = cleanLines.length > 1
        ? cleanLines.map((l: string) => `• ${l}`).join('\n')
        : cleanLines[0]

      cleanParagraphs.push(paraText)
      if (hitJunk) break
    }

    const description = cleanParagraphs.join('\n\n').trim()
    const location = get('LOCATION').replace(/\\,/g, ',').replace(/<[^>]+>/g, '').trim()
    const image = get('IMAGE') || get('X-IMAGE') || ''
    const uid = get('UID') || ''

    if (!summary || !dtstart) continue

    let dateStr = ''
    let timeStr = '12:00 PM'
    let endTimeStr = ''

    if (dtstart.includes('T')) {
      const tzidMatch = unfoldedBlock.match(/DTSTART;TZID=([^:]+):/)
      const tzid = tzidMatch ? tzidMatch[1].trim() : null

      const date = parseICalDate(dtstart, tzid)

      dateStr = date.toLocaleDateString('en-CA', {
        timeZone: 'America/Los_Angeles',
      })

      timeStr = date.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })

      if (dtend && dtend.includes('T')) {
        const endDate = parseICalDate(dtend, tzid)
        endTimeStr = endDate.toLocaleTimeString('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      }
    } else {
      dateStr = dtstart.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
      timeStr = 'All day'
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const eventDate = new Date(dateStr + 'T12:00:00')
    if (eventDate < today) continue

    events.push({ summary, description, location, dateStr, timeStr, endTimeStr, url, image, uid })
  }

  events.sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime())

  return events
}

// Ask Claude to categorize an event
async function categorizeEvent(summary: string, description: string) {
  try {
    const prompt = `You are categorizing a community event for a local calendar in Mill Valley, CA.

Event title: ${summary}
Description: ${description || 'No description provided'}

Choose from these categories (you may select more than one, comma-separated):
- outdoors (hikes, sports, yoga, fitness, nature walks, running, martial arts, dance)
- arts (concerts, theater, film, art, music, open studios, performances)
- food (farmers markets, restaurants, food events, wine, mixers, potlucks)
- community (volunteering, cleanups, neighborhood, activism, nonprofit)
- family (kids, children, youth, storytime, school, family activities)
- classes (workshops, lectures, lessons, classes, demos, learning)
- gov (city council, planning, town hall, government meetings, public hearings)

Also choose applicable tags (comma-separated, or leave blank):
- free (if the event is free)
- family (if family-friendly)
- senior (if good for 50+ crowd)
- wellness (if health or wellness focused)
- volunteer (if volunteer opportunity)
- reg (if registration required)

Respond in this exact format:
CATEGORIES: category1,category2
TAGS: tag1,tag2`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    const catMatch = text.match(/CATEGORIES:\s*([^\n]+)/)
    const tagMatch = text.match(/TAGS:\s*([^\n]*)/)

    const categories = catMatch ? catMatch[1].trim() : 'community'
    const tags = tagMatch ? tagMatch[1].trim() : ''

    return { categories, tags }
  } catch (err) {
    console.error('Categorization failed for:', summary, err)
    return { categories: 'community', tags: '' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { feedUrl, organization, town } = await request.json()

    if (!feedUrl || !organization) {
      return NextResponse.json({ error: 'feedUrl and organization required' }, { status: 400 })
    }

    const response = await fetch(feedUrl)
    if (!response.ok) {
      return NextResponse.json({ error: 'Could not fetch iCal feed' }, { status: 400 })
    }

    const icalText = await response.text()
    const events = parseICal(icalText)

    if (events.length === 0) {
      return NextResponse.json({ error: 'No upcoming events found in feed' }, { status: 400 })
    }

    const { data: matchingOrg } = await supabase
      .from('organizations')
      .select('id, name, canonical_name')
      .ilike('canonical_name', organization)
      .single()

    const { data: exactOrg } = !matchingOrg
      ? await supabase
          .from('organizations')
          .select('id, name, canonical_name')
          .ilike('name', organization)
          .single()
      : { data: null }

    const linkedOrg = matchingOrg || exactOrg

    if (linkedOrg && !linkedOrg.canonical_name) {
      await supabase
        .from('organizations')
        .update({ canonical_name: organization })
        .eq('id', linkedOrg.id)
    }

    const displayName = linkedOrg ? linkedOrg.name : organization

    let imported = 0
    let skipped = 0
    const results = []

     for (const ev of events) {
      try {
        // Auto-moderation — reject administrative events before dedup check
        if (shouldAutoReject(ev.summary)) {
          if (ev.uid) {
            await supabase.from('rejected_uids').upsert(
              [{ ical_uid: ev.uid, organization: displayName }],
              { onConflict: 'ical_uid', ignoreDuplicates: true }
            )
          }
          await supabase.from('events').insert([{
            title: ev.summary,
            date: ev.dateStr,
            time: ev.timeStr,
            end_time: ev.endTimeStr || null,
            location: ev.location || displayName,
            address: ev.location || '',
            organization: displayName,
            category: 'gov',
            tags: '',
            description: ev.description || '',
            website: ev.url || '',
            status: 'rejected',
            rejected_note: AUTO_REJECT_NOTE,
            ical_uid: ev.uid || null,
            town: town || 'Mill Valley',
          }])
          skipped++
          continue
        }

        if (ev.uid) {
  const { data: existingEvent } = await supabase
    .from('events')
    .select('id')
    .eq('ical_uid', ev.uid)
    .limit(1)

  const { data: rejectedUid } = await supabase
    .from('rejected_uids')
    .select('id')
    .eq('ical_uid', ev.uid)
    .limit(1)

  if ((existingEvent && existingEvent.length > 0) || (rejectedUid && rejectedUid.length > 0)) {
    skipped++
    continue
  }
}

        const { data: existingEvents } = await supabase
          .from('events')
          .select('id')
          .eq('title', ev.summary)
          .eq('date', ev.dateStr)
          .limit(1)

        if (existingEvents && existingEvents.length > 0) {
          skipped++
          continue
        }

        const { categories, tags } = await categorizeEvent(ev.summary, ev.description)

        const { error } = await supabase.from('events').insert([
          {
            title: ev.summary,
            date: ev.dateStr,
            time: ev.timeStr,
            end_time: ev.endTimeStr || null,
            location: ev.location || displayName,
            address: ev.location || '',
            organization: displayName,
            category: categories,
            tags,
            description: ev.description || '',
            website: ev.url || '',
            image_url: ev.image || null,
            status: 'pending',
            ical_uid: ev.uid || null,
            town: town || 'Mill Valley',
          },
        ])

        if (!error) {
          imported++
          results.push({ title: ev.summary, date: ev.dateStr, categories, tags })
        } else {
          console.error('Insert error for:', ev.summary, error)
        }
      } catch (err) {
        console.error('Error processing event:', ev.summary, err)
      }
    }

    await supabase
      .from('ical_feeds')
      .upsert([{ url: feedUrl, organization, last_synced: new Date().toISOString() }])

    await supabase
      .from('organizations')
      .upsert([{ name: organization, website_url: feedUrl }], {
        onConflict: 'name',
        ignoreDuplicates: true,
      })

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: events.length,
      results,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
