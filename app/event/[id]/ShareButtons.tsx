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

  return (
    <div>
      {/* Actions band */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px 28px', marginBottom: '2px' }}>
        <div style={{ fontSize: '10px', fontWeight: 600, color: ' #767e8a', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Actions
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={downloadIcs} style={primaryBtn}>
            Add to Calendar
          </button>
          
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