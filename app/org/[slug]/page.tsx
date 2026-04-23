'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../supabase'
import Header from '../../components/Header'

export default function OrgProfilePage() {
  const params = useParams()
  const router = useRouter()
  const [org, setOrg] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      const slug = params.slug as string
      const name = decodeURIComponent(slug).replace(/-/g, ' ')

      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .ilike('name', name)
        .single()

      if (!orgData) {
        setNotFound(true)
        setLoading(false)
        return
      }

      setOrg(orgData)
      document.title = `${orgData.name} | Townstir Mill Valley`

      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .eq('organization', orgData.name)
        .eq('status', 'approved')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })

      setEvents(eventsData || [])
      setLoading(false)
    }
    load()
  }, [params.slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9ca3af' }}>
      Loading…
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#f2f3f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9ca3af' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: '12px' }}>Organization not found.</p>
        <a href="/" style={{ color: '#1a3d2b', fontWeight: 500 }}>← Back to Calendar</a>
      </div>
    </div>
  )

  function formatWebsite(url: string) {
    if (!url) return null
    const clean = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const href = url.startsWith('http') ? url : `https://${url}`
    const display = clean.startsWith('www.') ? clean : `www.${clean}`
    return { href, display }
  }

  function stripHtml(str: string) {
    return str ? str.replace(/<[^>]+>/g, '').trim() : ''
  }

  const website = formatWebsite(org.website)
  const hasLinks = website || org.instagram || org.facebook

  return (
    <div style={{ minHeight: '100vh', background: '#f2f3f5', fontFamily: "'Helvetica Neue', Arial, sans-serif" }}>
      <Header
        rightSlot={
          <a href="/" style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', textDecoration: 'none' }}>
            ← Back to Calendar
          </a>
        }
      />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '36px 24px 60px' }}>

        {/* Org header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#f3f4f6', border: '2px solid #e5e7eb', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            ) : (
              <span style={{ fontSize: '28px', color: '#d1d5db' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </span>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#1f2937', margin: 0 }}>
                {org.name}
              </h1>
              {org.verified && (
                <span style={{ background: '#1a3d2b', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
                  ✓ Verified
                </span>
              )}
            </div>
            {hasLinks && (
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: org.phone ? '4px' : '0' }}>
                {website && (
                  <a href={website.href} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '12px', color: '#3a7d44', textDecoration: 'none' }}>
                    {website.display}
                  </a>
                )}
                {org.instagram && (
  <a href={`https://instagram.com/${org.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
    style={{ fontSize: '11px', color: '#6b7280', textDecoration: 'none' }}>
    Instagram
  </a>
)}
{org.facebook && (
  <a href={org.facebook.startsWith('http') ? org.facebook : `https://${org.facebook}`} target="_blank" rel="noopener noreferrer"
    style={{ fontSize: '11px', color: '#6b7280', textDecoration: 'none' }}>
    Facebook
  </a>
)}
              </div>
            )}
            {org.phone && (
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
  {org.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}
</div>
            )}
          </div>
        </div>

        <div style={{ height: '0.5px', background: '#e5e7eb', marginBottom: '20px' }} />

        {org.description && (
          <p style={{ fontSize: '14px', color: '#4b5563', lineHeight: 1.7, marginBottom: '28px' }}>
            {org.description}
          </p>
        )}

        {/* Events */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '15px', fontWeight: 500, color: '#1f2937' }}>Upcoming events</span>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>

        {events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', background: 'white', borderRadius: '12px', border: '0.5px solid #e5e7eb' }}>
            No upcoming events scheduled.
          </div>
        ) : (
          events.map((ev: any) => (
            <div key={ev.id}
              onClick={() => router.push(`/event/${ev.id}`)}
              style={{ background: 'white', borderRadius: '10px', padding: '12px 16px', marginBottom: '8px', border: '0.5px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: '14px', cursor: 'pointer' }}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#1a3d2b')}
              onMouseOut={e => (e.currentTarget.style.borderColor = '#e5e7eb')}>

              {/* Date */}
              <div style={{ minWidth: '40px', textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
                </div>
                <div style={{ fontSize: '20px', fontWeight: 500, color: '#2a7a55', lineHeight: 1.1 }}>
                  {new Date(ev.date + 'T12:00:00').getDate()}
                </div>
              </div>

              <div style={{ width: '0.5px', background: '#eee', alignSelf: 'stretch', flexShrink: 0 }} />

              {/* Body */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a2530', marginBottom: '3px' }}>
                  {ev.title}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: ev.description ? '3px' : '0' }}>
                  {ev.time && <span>{ev.time}</span>}
                  {ev.time && ev.location && <span style={{ color: '#ccc', margin: '0 4px' }}>·</span>}
                  {ev.location && <span>{stripHtml(ev.location)}</span>}
                </div>
                {ev.description && (
                  <div style={{ fontSize: '12px', color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {stripHtml(ev.description)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
