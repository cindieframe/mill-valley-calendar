'use client'
import { useState } from 'react'

export default function ShareButtons({ eventId, title, date, time, location }: {
  eventId: string, title: string, date: string, time: string, location: string
}) {
  const [copied, setCopied] = useState(false)
  const url = `https://www.townstir.com/event/${eventId}`
  const text = `Check out this event!\n\n${title}\n${date}${time ? ' · ' + time : ''}\n${location}\n\n${url}`

  function copyLink() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pill: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '9px 18px', borderRadius: '999px',
    border: '0.5px solid #e5e7eb', background: 'white',
    cursor: 'pointer', fontSize: '13px', fontWeight: 500,
    color: '#1f2937', textDecoration: 'none',
  }

  return (
    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1.5px solid #e5e7eb' }}>
      <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>Share</p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <a href={`sms:?body=${encodeURIComponent(text)}`} style={pill}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Text
        </a>
        <button onClick={copyLink} style={{ ...pill, border: copied ? '1.5px solid #1a3d2b' : '0.5px solid #e5e7eb', background: copied ? '#f0fdf4' : 'white', color: copied ? '#16803c' : '#1f2937' }}>
          {copied
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16803c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          }
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
        <a href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`} style={pill}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Email
        </a>
        <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" style={pill}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          Facebook
        </a>
        <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" style={pill}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          X
        </a>
      </div>
    </div>
  )
}