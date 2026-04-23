import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '../../supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
- wellness (if health or wellness focused)
- reg (if registration required)
- music (if live music)

Respond in this exact format:
CATEGORIES: category1,category2
TAGS: tag1,tag2`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const catMatch = text.match(/CATEGORIES:\s*([^\n]+)/)
    const tagMatch = text.match(/TAGS:\s*([^\n]*)/)
    return {
      categories: catMatch ? catMatch[1].trim() : 'community',
      tags: tagMatch ? tagMatch[1].trim() : ''
    }
  } catch {
    return { categories: 'community', tags: '' }
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function mapHeader(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (['title', 'name', 'eventname', 'eventtitle', 'subject'].includes(h)) return 'title'
  if (['date', 'eventdate', 'startdate', 'start'].includes(h)) return 'date'
  if (['time', 'starttime', 'eventtime'].includes(h)) return 'time'
  if (['endtime', 'end', 'ends'].includes(h)) return 'end_time'
  if (['location', 'venue', 'place', 'where'].includes(h)) return 'location'
  if (['address', 'streetaddress'].includes(h)) return 'address'
  if (['description', 'details', 'about', 'notes', 'body'].includes(h)) return 'description'
  if (['cost', 'price', 'fee', 'admission'].includes(h)) return 'cost'
  if (['website', 'url', 'link', 'eventurl'].includes(h)) return 'website'
  if (['age', 'ages', 'agerequirement'].includes(h)) return 'age'
  return ''
}

function parseDate(raw: string): string {
  if (!raw) return ''
  // Try common formats: MM/DD/YYYY, YYYY-MM-DD, Month DD YYYY
  const cleaned = raw.trim()
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
  // MM/DD/YYYY or M/D/YYYY
  const mdy = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`
  // Try native Date parse as fallback
  const d = new Date(cleaned)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return ''
}

function parseTime(raw: string): string {
  if (!raw) return ''
  const cleaned = raw.trim()
  // Already formatted like "10:00 AM"
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(cleaned)) return cleaned
  // 24hr format HH:MM
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (match24) {
    const h = parseInt(match24[1])
    const m = match24[2]
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${m} ${ampm}`
  }
  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    const { csvText, organization, town } = await request.json()
    if (!csvText || !organization) {
      return NextResponse.json({ error: 'csvText and organization required' }, { status: 400 })
    }

    const lines = csvText.split(/\r?\n/).filter((l: string) => l.trim())
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one event' }, { status: 400 })
    }

    // Map headers
    const headers = parseCSVLine(lines[0]).map(mapHeader)
    const today = new Date().toISOString().split('T')[0]

    let imported = 0
    let skipped = 0
    let errors = 0

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { if (h) row[h] = values[idx] || '' })

      const title = row.title?.trim()
      const date = parseDate(row.date)

      if (!title || !date) { errors++; continue }
      if (date < today) { skipped++; continue }

      // Duplicate check
      const { data: existing } = await supabase
        .from('events').select('id')
        .eq('title', title).eq('date', date).limit(1)
      if (existing && existing.length > 0) { skipped++; continue }

      const { categories, tags } = await categorizeEvent(title, row.description || '')

      const { error } = await supabase.from('events').insert([{
        title,
        date,
        time: parseTime(row.time) || '',
        end_time: parseTime(row.end_time) || '',
        location: row.location || '',
        address: row.address || '',
        organization,
        category: categories,
        tags,
        description: row.description || '',
        cost: row.cost || '',
        age: row.age || '',
        website: row.website || '',
        status: 'pending',
        town: town || 'mill-valley',
      }])

      if (!error) imported++
      else errors++
    }

    return NextResponse.json({ success: true, imported, skipped, errors, total: lines.length - 1 })
  } catch (error) {
    console.error('CSV import error:', error)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}