import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ShareButtons from './ShareButtons'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATS: Record<string, {label: string, icon: string}> = {
  outdoors:  { label: 'Outdoors, Sports & Movement', icon: '🥾' },
  arts:      { label: 'Arts & Performances',         icon: '🎭' },
  food:      { label: 'Food, Drink & Social',        icon: '🍷' },
  community: { label: 'Volunteer & Community',       icon: '🤝' },
  family:    { label: 'Family & Youth',              icon: '👨‍👩‍👧' },
  classes:   { label: 'Classes & Lectures',          icon: '📚' },
  gov:       { label: 'Local Government',            icon: '🏛️' },
}

const CAT_COLORS: Record<string, {bg: string}> = {
  outdoors:  { bg: '#16803c' },
  arts:      { bg: '#7c22ce' },
  food:      { bg: '#c2410c' },
  community: { bg: '#b45309' },
  family:    { bg: '#0e7490' },
  classes:   { bg: '#4338ca' },
  gov:       { bg: '#4b5563' },
}

const TAG_META: Record<string, {label: string, bg: string, color: string}> = {
  free:      { label: '🟢 Free',             bg: '#dcfce7', color: '#166534' },
  family:    { label: '⭐ Family-Friendly',   bg: '#fef9c3', color: '#854d0e' },
  senior:    { label: '🌟 50+ Friendly',      bg: '#ede9fe', color: '#4c1d95' },
  wellness:  { label: '🧘 Health & Wellness', bg: '#fce7f3', color: '#9d174d' },
  volunteer: { label: '🙋 Volunteer Opp.',    bg: '#fef9c3', color: '#713f12' },
  reg:       { label: '🎟️ Reg. Required',    bg: '#fff7ed', color: '#9a3412' },
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: ev } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (!ev) return { title: 'Event Not Found' }

  const date = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })
  const description = `${date}${ev.time ? ' · ' + ev.time : ''}${ev.location ? ' · ' + ev.location : ''}. ${ev.description || ''}`

  return {
    title: `${ev.title} · Townstir Mill Valley`,
    description: description.slice(0, 160),
    openGraph: {
      title: ev.title,
      description: description.slice(0, 160),
      url: `https://www.townstir.com/event/${ev.id}`,
      siteName: 'Townstir Mill Valley',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: ev.title,
      description: description.slice(0, 160),
    },
  }
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: ev } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single()

  if (!ev) notFound()

  const cats = ev.category ? ev.category.split(',').map((c: string) => c.trim()) : []
  const date = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  })
  const orgSlug = ev.organization?.toLowerCase().replace(/ /g, '-')

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', background: '#fafaf8' }}>
      <header style={{ background: '#1a3d2b', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#e6a020', letterSpacing: '-1px', textTransform: 'uppercase' }}>STIR</span>
          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '2.5px', textTransform: 'uppercase', marginTop: '2px' }}>🌲 Mill Valley, CA</div>
        </div>
        <Link href="/"
          style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}>
          ← Calendar
        </Link>
      </header>

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '40px 24px 80px' }}>
        {ev.image_url && (
          <div style={{ marginBottom: '24px', borderRadius: '12px', overflow: 'hidden', maxHeight: '320px' }}>
            <img src={ev.image_url} alt={ev.title} style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {cats.map((c: string) => (
            CATS[c] ? (
              <span key={c} style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, background: CAT_COLORS[c]?.bg || '#2d6a4f', color: 'white' }}>
                {CATS[c].icon} {CATS[c].label}
              </span>
            ) : null
          ))}
        </div>

        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '32px', fontWeight: 900, color: '#1f2937', marginBottom: '6px' }}>
          {ev.title}
        </h1>
        <p style={{ color: '#9ca3af', marginBottom: '28px', fontSize: '14px' }}>
          Presented by{' '}
          <Link href={`/org/${orgSlug}`} style={{ color: '#1a3d2b', fontWeight: 700, textDecoration: 'none' }}>
            {ev.organization}
          </Link>
          {ev.verified && (
            <span style={{ marginLeft: '6px', background: '#1a3d2b', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>
              ✓ Verified
            </span>
          )}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div>
            <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Date</div>
            <div style={{ fontWeight: 700 }}>{date}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Time</div>
            <div style={{ fontWeight: 700 }}>{ev.time || 'See organizer'}{ev.end_time ? ` – ${ev.end_time}` : ''}</div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Location</div>
            <div style={{ fontWeight: 700 }}>{ev.location}</div>
            {ev.address && <div style={{ fontSize: '12px', color: '#9ca3af' }}>{ev.address}</div>}
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Cost</div>
            <div style={{ fontWeight: 700 }}>{ev.cost || 'See organizer'}</div>
          </div>
          {ev.age && (
            <div>
              <div style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>Age</div>
              <div style={{ fontWeight: 700 }}>{ev.age}</div>
            </div>
          )}
        </div>

        {ev.description && (
          <p style={{ fontSize: '15px', color: '#4b5563', lineHeight: 1.8, marginBottom: '28px' }}>
            {ev.description}
          </p>
        )}

        {ev.tags && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '28px' }}>
            {ev.tags.split(',').map((tag: string) => {
              const t = tag.trim()
              const meta = TAG_META[t]
              return meta ? (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, background: meta.bg, color: meta.color }}>
                  {meta.label}
                </span>
              ) : null
            })}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.address || ev.location)}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '999px', border: '0.5px solid #e5e7eb', background: 'white', textDecoration: 'none', fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>
            Get Directions
          </a>
          {ev.website && (
            <a href={ev.website} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '999px', border: '0.5px solid #e5e7eb', background: 'white', textDecoration: 'none', fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Learn More
            </a>
          )}
          {ev.meeting_link && (
            <a href={ev.meeting_link} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '999px', border: '0.5px solid #e5e7eb', background: 'white', textDecoration: 'none', fontSize: '13px', fontWeight: 500, color: '#1f2937' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              Join Online
            </a>
          )}
        </div>

        <ShareButtons
          eventId={String(ev.id)}
          title={ev.title}
          date={date}
          time={ev.time || ''}
          location={ev.location || ''}
        />
      </div>
    </div>
  )
}