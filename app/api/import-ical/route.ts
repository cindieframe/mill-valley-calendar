import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../supabase'
import { shouldAutoReject, AUTO_REJECT_NOTE } from '../../lib/moderation'
import {
  findSquarespaceEventList,
  isSquarespaceEventList,
  parseSquarespaceEvents,
  SQUARESPACE_UID_PREFIX,
} from '../../lib/squarespace'
import { resolveTown } from '../../lib/towns'
import { categorizeEvent } from '../../lib/categorize'
import { todayPT } from '../../lib/dates'

const UA = 'Mozilla/5.0 (compatible; Townstir/1.0; +https://www.townstir.com)'

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

    if (dateStr < todayPT()) continue

    events.push({ summary, description, location, dateStr, timeStr, endTimeStr, url, image, uid })
  }

  events.sort((a, b) => new Date(a.dateStr).getTime() - new Date(b.dateStr).getTime())

  return events
}

export async function POST(request: NextRequest) {
  try {
    const { feedUrl, organization, town: rawTown } = await request.json()

    if (!feedUrl || !organization) {
      return NextResponse.json({ error: 'feedUrl and organization required' }, { status: 400 })
    }

    // Town is required and must exist in the towns table — never defaulted.
    const town = await resolveTown(rawTown)
    if (!town) {
      return NextResponse.json({
        error: rawTown ? `Unknown town "${rawTown}". Add it under Admin → Towns first.` : 'town required',
      }, { status: 400 })
    }

    const response = await fetch(feedUrl, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20000),
    })
    if (!response.ok) {
      return NextResponse.json({ error: 'Could not fetch iCal feed' }, { status: 400 })
    }

    const feedText = await response.text()

    // A source is either a real iCal feed, or a Squarespace events page
    // (read directly from the public page — see app/lib/squarespace.ts)
    let sourceUrl: string = feedUrl
    let isSquarespace = false
    let events: any[] = []

    if (feedText.includes('BEGIN:VCALENDAR')) {
      events = parseICal(feedText)
    } else {
      const listUrl = isSquarespaceEventList(feedText)
        ? feedUrl
        : await findSquarespaceEventList(feedUrl, feedText)
      if (!listUrl) {
        return NextResponse.json({
          error: 'That URL is not an iCal feed or a Squarespace events page.',
        }, { status: 400 })
      }
      isSquarespace = true
      sourceUrl = listUrl
      let pageHtml = feedText
      if (listUrl !== feedUrl) {
        const pageRes = await fetch(listUrl, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(20000),
        })
        if (!pageRes.ok) {
          return NextResponse.json({ error: 'Could not fetch the Squarespace events page' }, { status: 400 })
        }
        pageHtml = await pageRes.text()
      }
      events = parseSquarespaceEvents(pageHtml, listUrl)
    }

    // A Squarespace org with nothing upcoming is normal — keep the source connected
    if (events.length === 0 && !isSquarespace) {
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

    // Register the source once, before importing, so every event can carry
    // its feed_id. ical_feeds.url is unique; http/https variants count as
    // the same feed. A feed already connected to a different town is refused
    // rather than silently imported into the wrong calendar.
    const now = new Date().toISOString()
    const altUrl = sourceUrl.startsWith('https://')
      ? sourceUrl.replace(/^https:\/\//, 'http://')
      : sourceUrl.replace(/^http:\/\//, 'https://')
    const { data: existingFeeds, error: feedLookupError } = await supabase
      .from('ical_feeds')
      .select('id, town, organization')
      .in('url', [sourceUrl, altUrl])
      .limit(1)
    if (feedLookupError) {
      console.error('Feed lookup failed:', feedLookupError)
      return NextResponse.json({ error: 'Could not save feed' }, { status: 500 })
    }

    let feedId: number
    if (existingFeeds && existingFeeds.length > 0) {
      const existing = existingFeeds[0]
      const existingTown = await resolveTown(existing.town)
      if (existingTown && existingTown !== town) {
        return NextResponse.json({
          error: `This feed is already connected for ${existingTown} (as "${existing.organization}").`,
        }, { status: 409 })
      }
      feedId = existing.id
      // Normalizes legacy town values like "mill-valley"; never changes active/paused.
      await supabase.from('ical_feeds').update({ town, last_synced: now }).eq('id', feedId)
    } else {
      const { data: newFeed, error: feedInsertError } = await supabase
        .from('ical_feeds')
        .insert([{ url: sourceUrl, organization, town, active: true, last_synced: now }])
        .select('id')
        .single()
      if (feedInsertError || !newFeed) {
        console.error('Feed insert failed:', feedInsertError)
        return NextResponse.json({ error: 'Could not save feed' }, { status: 500 })
      }
      feedId = newFeed.id
    }

    let imported = 0
    let skipped = 0
    let updated = 0
    const results = []

    for (const ev of events) {
      try {
        // Dedup checks run BEFORE auto-moderation. Previously auto-rejected
        // events were inserted on every sync, creating a new rejected copy
        // every 6 hours.
        if (ev.uid) {
          const { data: existingEvent } = await supabase
            .from('events')
            .select('id, date, time, end_time, status, feed_id')
            .eq('ical_uid', ev.uid)
            .limit(1)

          const { data: rejectedUid } = await supabase
            .from('rejected_uids')
            .select('id')
            .eq('ical_uid', ev.uid)
            .limit(1)

          if (rejectedUid && rejectedUid.length > 0) {
            skipped++
            continue
          }

          if (existingEvent && existingEvent.length > 0) {
            // Squarespace: keep the schedule in sync if the org changed the date/time.
            // Only date/time fields — titles, descriptions and categories edited by
            // admins are never overwritten.
            const current = existingEvent[0]
            // Link events imported before feed_id existed (never re-link another feed's event)
            if (current.feed_id == null) {
              await supabase.from('events').update({ feed_id: feedId }).eq('id', current.id)
            }
            const scheduleChanged =
              current.date !== ev.dateStr ||
              (current.time || '') !== (ev.timeStr || '') ||
              (current.end_time || '') !== (ev.endTimeStr || '')
            if (isSquarespace && scheduleChanged && current.status !== 'rejected') {
              const { error: updateError } = await supabase
                .from('events')
                .update({ date: ev.dateStr, time: ev.timeStr, end_time: ev.endTimeStr || null })
                .eq('id', current.id)
              if (!updateError) {
                updated++
                continue
              }
            }
            skipped++
            continue
          }
        }

        const { data: existingEvents } = await supabase
          .from('events')
          .select('id, ical_uid')
          .eq('title', ev.summary)
          .eq('date', ev.dateStr)
          .limit(1)

        if (existingEvents && existingEvents.length > 0) {
          // Event imported earlier without a source ID (e.g. the old Squarespace
          // importer) — attach the ID so future schedule changes sync to it.
          const match = existingEvents[0]
          if (isSquarespace && !match.ical_uid && ev.uid?.startsWith(SQUARESPACE_UID_PREFIX)) {
            await supabase.from('events').update({ ical_uid: ev.uid }).eq('id', match.id)
          }
          skipped++
          continue
        }

        // Auto-moderation — new administrative events are stored once as rejected,
        // and their uid is recorded so later syncs skip them above.
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
            address: ev.address ?? ev.location ?? '',
            organization: displayName,
            category: 'gov',
            tags: '',
            description: ev.description || '',
            website: ev.url || '',
            status: 'rejected',
            rejected_note: AUTO_REJECT_NOTE,
            ical_uid: ev.uid || null,
            town,
            feed_id: feedId,
          }])
          skipped++
          continue
        }

        const { categories, tags } = await categorizeEvent({
          title: ev.summary,
          description: ev.description,
          organization: displayName,
          location: ev.location,
          town,
        })

        const { error } = await supabase.from('events').insert([
          {
            title: ev.summary,
            date: ev.dateStr,
            time: ev.timeStr,
            end_time: ev.endTimeStr || null,
            location: ev.location || displayName,
            address: ev.address ?? ev.location ?? '',
            organization: displayName,
            category: categories,
            tags,
            description: ev.description || '',
            website: ev.url || '',
            image_url: ev.image || null,
            status: 'pending',
            ical_uid: ev.uid || null,
            town,
            feed_id: feedId,
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
      .from('organizations')
      .upsert([{ name: organization, website_url: sourceUrl, town }], {
        onConflict: 'name',
        ignoreDuplicates: true,
      })

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      updated,
      total: events.length,
      results,
      source: isSquarespace ? 'squarespace' : 'ical',
      feedUrl: sourceUrl,
      feedId,
      town,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
