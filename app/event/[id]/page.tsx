import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ShareButtons from './ShareButtons'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const CATS: Record<string, { label: string }> = {
  outdoors:  { label: 'Outdoors, Sports & Movement' },
  arts:      { label: 'Arts & Performances' },
  food:      { label: 'Food, Drink & Social' },
  community: { label: 'Volunteer & Community' },
  youth:     { label: 'Youth' },
  family:    { label: 'Youth' },
  classes:   { label: 'Classes & Lectures' },
  gov:       { label: "Local Gov't" },
}

const CAT_CARD: Record<string, { bg: string; color: string }> = {
  outdoors:  { bg: 'rgba(20,100,60,0.07)',   color: '#145a30' },
  arts:      { bg: 'rgba(100,80,200,0.07)',  color: '#4a3fa0' },
  food:      { bg: 'rgba(180,80,20,0.07)',   color: '#7a3000' },
  community: { bg: 'rgba(30,80,160,0.07)',   color: '#1a4f8a' },
  youth:     { bg: 'rgba(40,120,60,0.07)',   color: '#1e6b30' },
  family:    { bg: 'rgba(40,120,60,0.07)',   color: '#1e6b30' },
  classes:   { bg: 'rgba(160,30,30,0.07)',   color: '#7a1a1a' },
  gov:       { bg: 'rgba(60,60,80,0.07)',    color: '#3a3a50' },
}

const TAG_META: Record<string, { label: string; bg: string; color: string }> = {
  free:     { label: 'Free',              bg: 'rgba(180,130,0,0.06)',  color: '#7a5500' },
  family:   { label: 'Family-friendly',   bg: 'rgba(0,0,0,0.04)',      color: '#555' },
  wellness: { label: 'Health & Wellness', bg: 'rgba(0,0,0,0.04)',      color: '#555' },
  reg:      { label: 'Reg. Required',     bg: 'rgba(0,0,0,0.04)',      color: '#555' },
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
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
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

  const cats = ev.category
    ? ev.category.split(',').map((c: string) => c.trim())
    : (ev.cats || [])
  const date = new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  })
  const orgSlug = ev.organization?.toLowerCase().replace(/ /g, '-')
  const tags = ev.tags ? ev.tags.split(',').map((t: string) => t.trim()) : []

  const infoCell = (label: string, value: string, sub?: string) => (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: '0.6px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a2530' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{sub}</div>}
    </div>
  )

  

  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", minHeight: '100vh', background: '#f2f3f5' }}>
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Event",
    "name": ev.title,
    "startDate": ev.time ? `${ev.date}T${ev.time}` : ev.date,
    "endDate": ev.end_time ? `${ev.date}T${ev.end_time}` : undefined,
    "location": {
      "@type": "Place",
      "name": ev.location || "Mill Valley, CA",
      "address": ev.address || "Mill Valley, CA"
    },
    "description": ev.description || "",
    "organizer": {
      "@type": "Organization",
      "name": ev.organization
    },
    "url": `https://www.townstir.com/event/${ev.id}`,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": ev.meeting_link
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode"
  })}}
/>
      <header style={{ background: '#1a3d2b', padding: '0 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'baseline' }}>
          <span style={{ color: '#fff', fontSize: '21px', fontWeight: 400 }}>town</span>
          <span style={{ color: '#7EC8A4', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '21px', fontWeight: 400 }}>stir</span>
        </div>
        <Link
          href="/"
          style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '999px', padding: '7px 16px' }}
        >
          ← Back
        </Link>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 16px 60px' }}>

        {ev.image_url && (
          <div style={{ position: 'relative', height: '260px', background: '#1a2530', borderRadius: '12px 12px 0 0', overflow: 'hidden', marginTop: '24px' }}>
    <img
      src={ev.image_url}
      alt=""
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(20px) brightness(0.4)', transform: 'scale(1.15)' }}
    />
    <img
      src={ev.image_url}
      alt={ev.title}
      style={{ position: 'absolute', zIndex: 1, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxHeight: '220px', maxWidth: '100%', objectFit: 'contain' }}
    />
  </div>
        )}

        <div style={{
          background: '#fff',
          borderRadius: ev.image_url ? '0 0 12px 12px' : '12px',
          marginTop: ev.image_url ? '0' : '24px',
          padding: '28px 28px 24px',
          marginBottom: '2px',
        }}>

          {cats.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {cats.map((c: string) => {
                const s = CAT_CARD[c]
                const label = CATS[c]?.label
                if (!s || !label) return null
                return (
                  <span key={c} style={{ background: s.bg, color: s.color, fontSize: '12px', borderRadius: '6px', padding: '4px 10px', fontWeight: 500 }}>
                    {label}
                  </span>
                )
              })}
            </div>
          )}

          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 700, color: '#1a2530', marginBottom: '6px', lineHeight: 1.25 }}>
            {ev.title}
          </h1>

          <div style={{ fontSize: '13px', color: '#888', marginBottom: '24px' }}>
            {ev.is_aggregator ? (
              <>
                {ev.extracted_organizer && (
                  <><Link href={`/org/${encodeURIComponent(ev.extracted_organizer.toLowerCase().replace(/ /g, '-'))}`} style={{ color: '#3a7d44', fontWeight: 500, textDecoration: 'none' }}>{ev.extracted_organizer}</Link>{' · '}</>
                )}
                via {ev.organization}
              </>
            ) : (
              <>Presented by{' '}
                <Link href={`/org/${orgSlug}`} style={{ color: '#3a7d44', fontWeight: 500, textDecoration: 'none' }}>
                  {ev.organization}
                </Link>
              </>
            )}

            {ev.verified && (
              <span style={{ marginLeft: '6px', background: '#1a3d2b', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>
                ✓ Verified
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #e8eaed', borderRadius: '10px', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ borderRight: '1px solid #e8eaed', borderBottom: '1px solid #e8eaed' }}>
              {infoCell('Date', date)}
            </div>
            <div style={{ borderBottom: '1px solid #e8eaed' }}>
              {infoCell('Time', ev.time ? (ev.end_time ? `${ev.time} – ${ev.end_time}` : ev.time) : 'See organizer')}
            </div>
            <div style={{ borderRight: '1px solid #e8eaed' }}>
              {infoCell('Location', ev.location, ev.address && ev.address !== ev.location ? ev.address : undefined)}
            </div>
            <div>
              {infoCell('Cost', ev.cost || 'See organizer')}
            </div>
            {ev.age && (
              <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e8eaed' }}>
                {infoCell('Age', ev.age)}
              </div>
            )}
          </div>

          {ev.description && (
            <p style={{ fontSize: '15px', color: '#4b5563', lineHeight: 1.75, marginBottom: '24px' }}>
              {ev.description}
            </p>
          )}

          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {tags.map((t: string) => {
                const meta = TAG_META[t]
                if (!meta) return null
                return (
                  <span key={t} style={{ background: meta.bg, color: meta.color, fontSize: '12px', borderRadius: '999px', padding: '4px 12px' }}>
                    {meta.label}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        

       <ShareButtons
          eventId={String(ev.id)}
          title={ev.title}
          date={ev.date}
          time={ev.time || ''}
          location={ev.location || ''}
          description={ev.description || ''}
          address={ev.address || ''}
          website={ev.website || ''}
          meetingLink={ev.meeting_link || ''}
        />

      </div>
    </div>
  )
}