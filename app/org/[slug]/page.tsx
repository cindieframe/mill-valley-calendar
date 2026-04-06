'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../supabase'

export default function OrgProfilePage() {
  const params = useParams()
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
        .eq('verified', true)
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
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9ca3af' }}>
      Loading…
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9ca3af' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
        <p>Organization not found.</p>
        <a href="/" style={{ color: '#1a3d2b', fontWeight: 700 }}>← Back to Calendar</a>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a3d2b', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#e6a020', letterSpacing: '-1px', textTransform: 'uppercase' }}>STIR</span>
        </a>
        <a href="/" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', textDecoration: 'none' }}>← Back to Calendar</a>
      </header>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#f3f4f6', border: '2px solid #e5e7eb', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {org.logo_url ? (
              <img src={org.logo_url} alt={org.name} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
            ) : (
              <span style={{ fontSize: '32px' }}>🏢</span>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '26px', fontWeight: 900, color: '#1f2937', margin: 0 }}>
                {org.name}
              </h1>
              <span style={{ background: '#1a3d2b', color: 'white', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px' }}>
                ✓ Verified
              </span>
            </div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {org.website && <a href={org.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#1a3d2b', textDecoration: 'none' }}>🌐 Website</a>}
              {org.phone && <span style={{ fontSize: '13px', color: '#6b7280' }}>📞 {org.phone}</span>}
              {org.instagram && <a href={`https://instagram.com/${org.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#1a3d2b', textDecoration: 'none' }}>📸 Instagram</a>}
              {org.facebook && <a href={org.facebook.startsWith('http') ? org.facebook : `https://${org.facebook}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#1a3d2b', textDecoration: 'none' }}>👍 Facebook</a>}
            </div>
          </div>
        </div>

        {org.description && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '32px', border: '1.5px solid #e5e7eb' }}>
            <p style={{ color: '#4b5563', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>{org.description}</p>
          </div>
        )}

        <h2 style={{ fontFamily: 'Georgia,serif', fontSize: '20px', fontWeight: 700, color: '#1f2937', marginBottom: '16px' }}>
          Upcoming Events
        </h2>
        {events.length > 0 ? (
          events.map((ev: any) => (
            <a href={`/?event=${ev.id}`} key={ev.id} style={{ textDecoration: 'none' }}>
              <div style={{ background: 'white', borderRadius: '12px', padding: '16px 18px', marginBottom: '10px', border: '1.5px solid #e5e7eb', cursor: 'pointer' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', margin: '0 0 4px 0' }}>{ev.title}</h3>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>
                  📅 {new Date(ev.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                  {ev.time && <> &nbsp;·&nbsp; 🕐 {ev.time}</>}
                  {ev.location && <> &nbsp;·&nbsp; 📍 {ev.location}</>}
                </div>
              </div>
            </a>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', background: 'white', borderRadius: '12px', border: '1.5px solid #e5e7eb' }}>
            No upcoming events scheduled.
          </div>
        )}
      </div>
    </div>
  )
}