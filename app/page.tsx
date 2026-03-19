'use client'

import { useEffect, useState } from 'react'
import { getEvents } from './events'

export default function Home() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadEvents() {
      const data = await getEvents()
      setEvents(data)
      setLoading(false)
    }
    loadEvents()
  }, [])

  if (loading) return <div style={{padding: '40px', fontFamily: 'sans-serif'}}>Loading events...</div>

  return (
    <main style={{padding: '40px', fontFamily: 'sans-serif'}}>
      <h1 style={{color: '#2d6a4f'}}>Mill Valley Townstir</h1>
      <p style={{color: '#666'}}>Community Calendar</p>
      {events.length === 0 ? (
        <p>No events yet. Be the first to post one!</p>
      ) : (
        <ul>
          {events.map(event => (
            <li key={event.id} style={{marginBottom: '20px'}}>
              <strong>{event.title}</strong> — {event.date} at {event.time}
              <br/>
              📍 {event.location}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}