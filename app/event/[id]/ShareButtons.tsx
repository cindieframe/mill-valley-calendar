'use client'
import { useEffect, useRef, useState } from 'react'

// Calendar links are built on the server (app/lib/calendar.ts) so times are
// always correct Pacific time, regardless of the visitor's browser or timezone.
export default function ShareButtons({ eventId, title, date, time, location, address, website, meetingLink, googleCalendarUrl, icsUrl }: {
  eventId: string, title: string, date: string, time: string, location: string,
  address?: string, website?: string, meetingLink?: string,
  googleCalendarUrl: string, icsUrl: string
}) {
  const [copied, setCopied] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const calendarRef = useRef<HTMLDivElement>(null)
  const url = `https://www.townstir.com/event/${eventId}`
  const text = `Check out this event!\n\n${title}\n${date}${time ? ' · ' + time : ''}\n${location}\n\n${url}`

  // Close the calendar menu on outside click or Escape
  useEffect(() => {
    if (!calendarOpen) return
    const onClick = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) setCalendarOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCalendarOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [calendarOpen])

  function copyLink() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const primaryBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '9px 18px', borderRadius: '8px',
    background: '#1a3d2b', color: '#fff',
    border: 'none', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
    textDecoration: 'none',
  }

  const secondaryBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '7px',
    padding: '9px 18px', borderRadius: '8px',
    background: '#fff', color: '#1a2530',
    border: '1px solid #d0d6db', cursor: 'pointer',
    fontSize: '13px', fontWeight: 500,
    textDecoration: 'none',
  }

  const shareBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', borderRadius: '8px',
    background: '#fff', color: '#444',
    border: '1px solid #d0d6db', cursor: 'pointer',
    fontSize: '12px', fontWeight: 400,
    textDecoration: 'none',
  }

  const menuItem: React.CSSProperties = {
    display: 'block', padding: '10px 14px',
    fontSize: '13px', color: '#1a2530',
    textDecoration: 'none', whiteSpace: 'nowrap',
  }

  return (
    <div>
      {/* Actions band */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px 28px', marginBottom: '2px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: ' #767e8a', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Actions
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>

          <div ref={calendarRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setCalendarOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={calendarOpen}
              style={primaryBtn}
            >
              Add to Calendar <span aria-hidden="true" style={{ fontSize: '10px' }}>▾</span>
            </button>

            {calendarOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                  background: '#fff', border: '1px solid #e8eaed', borderRadius: '10px',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.12)', overflow: 'hidden', minWidth: '200px',
                }}
              >
                <a
                  role="menuitem"
                  href={googleCalendarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setCalendarOpen(false)}
                  style={menuItem}
                >
                  Google Calendar
                </a>
                <a
                  role="menuitem"
                  href={icsUrl}
                  onClick={() => setCalendarOpen(false)}
                  style={{ ...menuItem, borderTop: '1px solid #f0f1f3' }}
                >
                  Apple / Outlook (.ics)
                </a>
              </div>
            )}
          </div>

         <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || location)}`} target="_blank" rel="noopener noreferrer" style={secondaryBtn}>Get Directions</a>
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" style={secondaryBtn}>
              Learn More
            </a>
          )}
          {meetingLink && (
            <a href={meetingLink} target="_blank" rel="noopener noreferrer" style={secondaryBtn}>
              Join Online
            </a>
          )}
        </div>
      </div>

      {/* Share band */}
      <div style={{ background: '#f8f9fa', borderRadius: '12px', padding: '20px 28px 24px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: ' #767e8a', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Share this event
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a href={`sms:?body=${encodeURIComponent(text)}`} style={shareBtn}>
            Text
          </a>
          <button
            onClick={copyLink}
            style={{ ...shareBtn, border: copied ? '1px solid #1a3d2b' : '1px solid #d0d6db', background: copied ? '#f0fdf4' : '#fff', color: copied ? '#1a3d2b' : '#444' }}
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`} style={shareBtn}>
            Email
          </a>

            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" style={{ ...shareBtn, background: '#1877f2', color: '#fff', border: 'none' }}>Facebook</a>

            <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" style={{ ...shareBtn, background: '#000', color: '#fff', border: 'none' }}>X</a>

        </div>
      </div>
    </div>
  )
}
