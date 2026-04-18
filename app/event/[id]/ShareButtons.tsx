'use client'
import { useState } from 'react'

export default function ShareButtons({ eventId, title, date, time, location, description, address, website, meetingLink }: {
  eventId: string, title: string, date: string, time: string, location: string,
  description?: string, address?: string, website?: string, meetingLink?: string
}) {
  const [copied, setCopied] = useState(false)
  const url = `https://www.townstir.com/event/${eventId}`
  const text = `Check out this event!\n\n${title}\n${date}${time ? ' · ' + time : ''}\n${location}\n\n${url}`

  function copyLink() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function downloadIcs() {
    const formatDate = (dateStr: string, timeStr: string) => {
      const d = new Date(dateStr + 'T12:00:00')
      if (!timeStr || timeStr === 'All day' || timeStr === 'See organizer') {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0].slice(0, 8)
      }
      const combined = new Date(`${dateStr} ${timeStr}`)
      if (isNaN(combined.getTime())) return d.toISOString().replace(/[-:]/g, '').split('.')[0].slice(0, 8)
      return combined.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }

    const isAllDay = !time || time === 'All day' || time === 'See organizer'
    const dtStart = isAllDay
      ? `DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`
      : `DTSTART:${formatDate(date, time)}`

    const endDate = new Date(date + 'T12:00:00')
    endDate.setDate(endDate.getDate() + 1)
    const dtEnd = isAllDay
      ? `DTEND;VALUE=DATE:${endDate.toISOString().split('T')[0].replace(/-/g, '')}`
      : `DTEND:${formatDate(date, time)}`

    const escape = (s: string) => (s || '').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Townstir//Mill Valley Calendar//EN',
      'BEGIN:VEVENT',
      `UID:${eventId}@townstir.com`,
      dtStart,
      dtEnd,
      `SUMMARY:${escape(title)}`,
      `DESCRIPTION:${escape(description || '')}\\n\\n${escape(url)}`,
      `LOCATION:${escape(address || location)}`,
      website ? `URL:${website}` : '',
      `STATUS:CONFIRMED`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n')

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`
    link.click()
  }

  const pill: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '9px 18px', borderRadius: '999px',
    border: '0.5px solid #e5e7eb', background: 'white',
    cursor: 'pointer', fontSize: '13px', fontWeight: 500,
    color: '#1f2937', textDecoration: 'none',
  }

    return (
    <div style={{ marginTop: '32px', borderTop: '0.5px solid #e5e7eb' }}>

      {/* Action buttons band */}
      <div style={{ padding: '20px 0 20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={downloadIcs} style={pill}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Add to Calendar
        </button>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address || location)}`}
          target="_blank" rel="noopener noreferrer" style={pill}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Get Directions
        </a>
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" style={pill}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Learn More
          </a>
        )}
        {meetingLink && (
          <a href={meetingLink} target="_blank" rel="noopener noreferrer" style={pill}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            Join Online
          </a>
        )}
      </div>

      {/* Share band */}
      <div style={{ borderTop: '0.5px solid #e5e7eb', padding: '16px 0 0', background: 'transparent' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>Share</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <a href={`sms:?body=${encodeURIComponent(text)}`} style={{ ...pill, fontSize: '12px', padding: '7px 14px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Text
          </a>
          <button onClick={copyLink} style={{ ...pill, fontSize: '12px', padding: '7px 14px', border: copied ? '1.5px solid #1a3d2b' : '0.5px solid #e5e7eb', background: copied ? '#f0fdf4' : 'white', color: copied ? '#16803c' : '#1f2937' }}>
            {copied
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16803c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            }
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
          <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`} style={{ ...pill, fontSize: '12px', padding: '7px 14px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Email
          </a>
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" style={{ ...pill, fontSize: '12px', padding: '7px 14px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </a>
          <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" style={{ ...pill, fontSize: '12px', padding: '7px 14px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X
          </a>
        </div>
      </div>

    </div>
  )
}