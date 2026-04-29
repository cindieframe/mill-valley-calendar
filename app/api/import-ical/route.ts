import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../../supabase'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Parse iCal text into event objects
function parseICal(text: string, feedUrl?: string) {
  const events: any[] = []
  const eventBlocks = text.split('BEGIN:VEVENT')
  
  for (let i = 1; i < eventBlocks.length; i++) {
    const block = eventBlocks[i]
    const get = (field: string) => {
      const match = block.match(new RegExp(`${field}[^:]*:([^\r\n]+)`))
      return match ? match[1].trim() : ''
    }
    
    const dtstart = get('DTSTART')
    const dtend = get('DTEND')   // NEW — reads the end time from the iCal block
    const summary = get('SUMMARY')
    const description = get('DESCRIPTION').replace(/\\n/g, ' ').replace(/\\,/g, ',').replace(/https?:\/\/\S+/g, '').replace(/#\S+/g, '').replace(/@\S+/g, '').replace(/\s+/g, ' ').trim()
    const location = get('LOCATION').replace(/\\,/g, ',')
    const url = get('URL')
    const image = get('IMAGE') || get('X-IMAGE') || ''
    
    if (!summary || !dtstart) continue
    
    let dateStr = ''
    let timeStr = '12:00 PM'
    let endTimeStr = ''   // NEW — will hold the parsed end time if one exists

    if (dtstart.includes('T')) {
      const hasTZID = block.includes('DTSTART;TZID=')
      const fullDate = (hasTZID || feedUrl?.includes('ical=1'))
  ? dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6')
  : dtstart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6Z')

      const date = new Date(fullDate)

      dateStr = date.toLocaleDateString('en-CA', {
        timeZone: 'America/Los_Angeles'
      })

      timeStr = date.toLocaleTimeString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })

      // NEW — parse the end time using the same timezone logic as the start time
      if (dtend && dtend.includes('T')) {
        const fullEndDate = hasTZID
          ? dtend.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6')
          : dtend.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2}).*/, '$1-$2-$3T$4:$5:$6Z')
        const endDate = new Date(fullEndDate)
        endTimeStr = endDate.toLocaleTimeString('en-US', {
          timeZone: 'America/Los_Angeles',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
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

    // NEW — endTimeStr added to the pushed object
    events.push({ summary, description, location, dateStr, timeStr, endTimeStr, url, image })
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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
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
    const { feedUrl, organization } = await request.json()
    
    if (!feedUrl || !organization) {
      return NextResponse.json({ error: 'feedUrl and organization required' }, { status: 400 })
    }
    
    // Fetch iCal feed
    const response = await fetch(feedUrl)
    if (!response.ok) {
      return NextResponse.json({ error: 'Could not fetch iCal feed' }, { status: 400 })
    }
    
    const icalText = await response.text()
const events = parseICal(icalText, feedUrl)

if (events.length === 0) {
  return NextResponse.json({ error: 'No upcoming events found in feed' }, { status: 400 })
}

// Check if an org account exists with this canonical name
// If so, use their display name for events and save canonical_name
const { data: matchingOrg } = await supabase
  .from('organizations')
  .select('id, name, canonical_name')
  .ilike('canonical_name', organization)
  .single()

// Also check if org exists with this exact name but no canonical_name set yet
const { data: exactOrg } = !matchingOrg ? await supabase
  .from('organizations')
  .select('id, name, canonical_name')
  .ilike('name', organization)
  .single() : { data: null }

const linkedOrg = matchingOrg || exactOrg

// If we found a linked org, save canonical_name if not already set
if (linkedOrg && !linkedOrg.canonical_name) {
  await supabase
    .from('organizations')
    .update({ canonical_name: organization })
    .eq('id', linkedOrg.id)
}

// Use display name if org is linked, otherwise use feed name
const displayName = linkedOrg ? linkedOrg.name : organization
    
    // Process each event
    let imported = 0
    let skipped = 0
    const results = []
    
    for (const ev of events) {
      try {
        // Check if event already exists BEFORE calling Claude
       const { data: existingEvents } = await supabase
  .from('events')
  .select('id')
  .eq('title', ev.summary)
  .eq('date', ev.dateStr)

if (existingEvents && existingEvents.length > 0) {
  skipped++
  continue
}
        
  

        // Auto-categorize with Claude (only for new events)
        const { categories, tags } = await categorizeEvent(ev.summary, ev.description)
        
        // Insert into events table as pending
        const { error } = await supabase.from('events').insert([{
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
}])
        
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
    
    // Update last_synced
    await supabase
      .from('ical_feeds')
      .upsert([{ url: feedUrl, organization, last_synced: new Date().toISOString() }])

    // Ensure org exists in organizations table so discovery can find it
    await supabase
      .from('organizations')
      .upsert([{ name: organization, website_url: feedUrl }], { onConflict: 'name', ignoreDuplicates: true })
    
    return NextResponse.json({ 
      success: true, 
      imported, 
      skipped,
      total: events.length,
      results 
    })
    
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}