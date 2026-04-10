'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'

type Event = {
  id: number
  title: string
  date: string
  time: string
  end_time: string
  location: string
  address: string
  organization: string
  category: string
  tags: string
  cost: string
  age: string
  description: string
  email: string
  website: string
  meeting_link: string
  status: string
  verified: boolean
}

const CATEGORIES = [
  { label: '🥾 Outdoors, Sports & Movement', value: 'outdoors' },
  { label: '🎭 Arts & Performances', value: 'arts' },
  { label: '🍷 Food, Drink & Social', value: 'food' },
  { label: '🤝 Volunteer & Community', value: 'community' },
  { label: '👨‍👩‍👧 Family & Youth', value: 'family' },
  { label: '📚 Classes & Lectures', value: 'classes' },
  { label: '🏛️ Local Government', value: 'gov' },
]

const timeSlots: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    const label = `${hour}:${String(m).padStart(2, '0')} ${ampm}`
    const value = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    timeSlots.push(`${value}|${label}`)
  }
}

export default function OrgDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [org, setOrg] = useState<any>(null)

  const [events, setEvents] = useState<Event[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [eventForm, setEventForm] = useState<Partial<Event>>({})
  const [eventSaving, setEventSaving] = useState(false)
  const [eventError, setEventError] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  useEffect(() => { loadOrg() }, [])

  async function loadOrg() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/org/login'); return }
    let { data, error } = await supabase
      .from('organizations').select('*').eq('user_id', user.id).single()
    if (!data && user.user_metadata?.org_name) {
      const { data: newOrg, error: insertError } = await supabase
        .from('organizations')
        .insert([{
          user_id: user.id,
          name: user.user_metadata.org_name,
          email: user.user_metadata.org_email,
          description: user.user_metadata.org_description || '',
          website: user.user_metadata.org_website || '',
          phone: user.user_metadata.org_phone || '',
          instagram: user.user_metadata.org_instagram || '',
          facebook: user.user_metadata.org_facebook || '',
        }])
        .select().single()
      if (insertError || !newOrg) { router.push('/org/login'); return }
      data = newOrg
    }
    if (error || !data) { router.push('/org/login'); return }
    setOrg(data)
    setLoading(false)
    loadEvents(data.name)
  }

  async function loadEvents(orgName: string) {
    setEventsLoading(true)
    const { data, error } = await supabase
      .from('events').select('*').ilike('organization', orgName)
      .order('date', { ascending: true })
    if (!error && data) setEvents(data)
    setEventsLoading(false)
  }

  function openAddEvent() {
    setEditingEvent(null)
    setEventForm({ organization: org.name, status: 'pending' })
    setEventError('')
    setShowEventModal(true)
  }

  function openEditEvent(event: Event) {
    setEditingEvent(event)
    setEventForm({ ...event })
    setEventError('')
    setShowEventModal(true)
  }

  function openDuplicateEvent(event: Event) {
    setEditingEvent(null)
    setEventForm({ ...event, id: undefined, status: 'pending' })
    setEventError('')
    setShowEventModal(true)
  }

  async function handleDeleteEvent(id: number) {
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) { setError('Failed to delete event: ' + error.message) }
    else { setEvents(events.filter(e => e.id !== id)); setDeleteConfirmId(null) }
  }

  async function handleSaveEvent() {
    if (!eventForm.title?.trim()) { setEventError('Title is required'); return }
    if (!eventForm.date) { setEventError('Date is required'); return }
    setEventSaving(true)
    setEventError('')

    const { data: existing } = await supabase
      .from('events').select('id')
      .ilike('organization', org.name)
      .ilike('title', eventForm.title.trim())
      .eq('date', eventForm.date)
      .neq('id', editingEvent?.id ?? 0)
      .limit(1)

    if (existing && existing.length > 0) {
      setEventError('An event with this title and date already exists. Rename it or change the date.')
      setEventSaving(false)
      return
    }

    // Format time for display
    const formatTime = (val: string) => {
      if (!val) return ''
      const [h, m] = val.split(':').map(Number)
      const ampm = h >= 12 ? 'PM' : 'AM'
      const hour = h % 12 || 12
      return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
    }

    const payload = {
      title: eventForm.title,
      date: eventForm.date,
      time: formatTime(eventForm.time || ''),
      end_time: formatTime(eventForm.end_time || ''),
      location: eventForm.location || '',
      address: eventForm.address || '',
      organization: org.name,
      category: eventForm.category || '',
      tags: eventForm.tags || '',
      cost: eventForm.cost || '',
      age: eventForm.age || '',
      description: eventForm.description || '',
      email: eventForm.email || '',
      website: eventForm.website || '',
      meeting_link: eventForm.meeting_link || '',
      status: editingEvent ? eventForm.status : 'pending',
      verified: org.verified || false,
    }

    if (editingEvent) {
      const { data, error } = await supabase
        .from('events').update(payload).eq('id', editingEvent.id).select().single()
      if (error) { setEventError(error.message); setEventSaving(false); return }
      setEvents(events.map(e => e.id === editingEvent.id ? data : e))
    } else {
      const { data, error } = await supabase
        .from('events').insert(payload).select().single()
      if (error) { setEventError(error.message); setEventSaving(false); return }
      setEvents([...events, data].sort((a, b) => a.date.localeCompare(b.date)))
    }

    setEventSaving(false)
    setShowEventModal(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Logo must be under 2MB'); return }
    setUploadingLogo(true)
    setError('')
    const ext = file.name.split('.').pop()
    const fileName = `${org.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('org-logos').upload(fileName, file, { upsert: true })
    if (uploadError) { setError('Logo upload failed: ' + uploadError.message); setUploadingLogo(false); return }
    const { data: { publicUrl } } = supabase.storage.from('org-logos').getPublicUrl(fileName)
    const { error: updateError } = await supabase
      .from('organizations').update({ logo_url: publicUrl }).eq('id', org.id)
    if (updateError) { setError('Failed to save logo URL'); setUploadingLogo(false); return }
    setOrg({ ...org, logo_url: publicUrl })
    setUploadingLogo(false)
    setSuccess('Logo uploaded successfully!')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')
    const { error } = await supabase.from('organizations').update({
      name: org.name, description: org.description, website: org.website,
      phone: org.phone, email: org.email, instagram: org.instagram,
      facebook: org.facebook, ical_feed_url: org.ical_feed_url,
    }).eq('id', org.id)
    if (error) { setError(error.message); setSaving(false); return }
    if (org.ical_feed_url) {
      try {
        const importRes = await fetch('/api/import-ical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedUrl: org.ical_feed_url, organization: org.name })
        })
        const importData = await importRes.json()
        if (importData.error) {
          setSuccess(`Profile saved! Note: Calendar sync had an issue — ${importData.error}`)
        } else {
          setSuccess(`Profile saved! ${importData.imported} new events imported, ${importData.skipped} already existed.`)
        }
      } catch { setSuccess('Profile saved! Calendar sync will retry shortly.') }
    } else { setSuccess('Profile saved successfully!') }
    setSaving(false)
    setTimeout(() => setSuccess(''), 5000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  const inputStyle = {
    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px',
    padding: '10px 14px', fontFamily: 'sans-serif', fontSize: '13px',
    color: '#1f2937', outline: 'none', background: 'white', marginBottom: '8px',
    boxSizing: 'border-box' as const
  }
  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151',
    marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.8px'
  }

  function statusBadge(status: string) {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      approved: { bg: '#f0fdf4', color: '#16803c', label: 'Approved' },
      pending: { bg: '#fffbeb', color: '#b45309', label: 'Pending' },
      rejected: { bg: '#fee2e2', color: '#dc2626', label: 'Rejected' },
    }
    const s = styles[status] || styles.pending
    return (
      <span style={{ background: s.bg, color: s.color, borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
        {s.label}
      </span>
    )
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9ca3af' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a3d2b', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#e6a020', letterSpacing: '-1px', textTransform: 'uppercase' }}>STIR</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '12px' }}>{org.name}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/')}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            ← Calendar
          </button>
          <button onClick={handleLogout}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            Log Out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: 900, color: '#1f2937', marginBottom: '6px' }}>
          Organization Dashboard
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '32px' }}>
          Manage your profile and connect your events calendar.
        </p>

        {error && (
          <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#16803c' }}>
            ✅ {success}
          </div>
        )}

        {/* Your Events */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1.5px solid #e5e7eb', overflow: 'hidden', marginBottom: '24px' }}>
          <div style={{ padding: '20px 24px 16px', borderBottom: '1.5px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', margin: 0 }}>Your Events</h2>
              <p style={{ fontSize: '13px', color: '#9ca3af', margin: '2px 0 0' }}>
                {events.length} event{events.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button onClick={openAddEvent}
              style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              + Add Event
            </button>
          </div>

          {eventsLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>Loading events…</div>
          ) : events.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📭</div>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>No events yet</div>
              <div style={{ fontSize: '13px', color: '#9ca3af' }}>Click "+ Add Event" to post your first event.</div>
            </div>
          ) : (
            <div>
              {events.map((event, i) => (
                <div key={event.id} style={{ padding: '16px 24px', borderBottom: i < events.length - 1 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: '#1f2937' }}>{event.title}</span>
                      {statusBadge(event.status)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {event.date}{event.time ? ` · ${event.time}` : ''}{event.location ? ` · ${event.location}` : ''}
                    </div>
                    {event.category && (
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{event.category}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <button onClick={() => openEditEvent(event)}
                      style={{ background: '#f3f4f6', color: '#374151', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => openDuplicateEvent(event)}
                      style={{ background: '#f3f4f6', color: '#374151', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                      Copy
                    </button>
                    {deleteConfirmId === event.id ? (
                      <>
                        <button onClick={() => handleDeleteEvent(event.id)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                          Confirm
                        </button>
                        <button onClick={() => setDeleteConfirmId(null)}
                          style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                          ✕
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(event.id)}
                        style={{ background: '#f3f4f6', color: '#dc2626', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connect Calendar */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '2px solid #1a3d2b' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1a3d2b', marginBottom: '4px' }}>📅 Connect Your Calendar</h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>Paste your iCal feed URL and your events will automatically appear on the Townstir calendar.</p>
          <label style={labelStyle}>iCal Feed URL</label>
          <input style={inputStyle} placeholder="https://calendar.google.com/calendar/ical/..."
            value={org.ical_feed_url || ''}
            onChange={e => setOrg({ ...org, ical_feed_url: e.target.value })} />
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            Google Calendar: Settings → your calendar → Integrate calendar → copy iCal link
          </div>
        </div>

        {/* Organization Profile */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1.5px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '16px' }}>Organization Profile</h2>
          <label style={labelStyle}>Organization Name</label>
          <input style={inputStyle} value={org.name || ''} onChange={e => setOrg({ ...org, name: e.target.value })} />
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            value={org.description || ''} onChange={e => setOrg({ ...org, description: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} placeholder="https://yourorg.org" value={org.website || ''} onChange={e => setOrg({ ...org, website: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} placeholder="415-555-1234" value={org.phone || ''} onChange={e => setOrg({ ...org, phone: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Instagram</label>
              <input style={inputStyle} placeholder="@yourorg" value={org.instagram || ''} onChange={e => setOrg({ ...org, instagram: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Facebook</label>
              <input style={inputStyle} placeholder="facebook.com/yourorg" value={org.facebook || ''} onChange={e => setOrg({ ...org, facebook: e.target.value })} />
            </div>
          </div>

          {/* Logo */}
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: '20px', paddingTop: '20px' }}>
            <label style={labelStyle}>Organization Logo <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: '#9ca3af' }}>(optional)</span></label>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>PNG or JPG, under 2MB. Appears on your events and profile.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f3f4f6', border: '2px solid #e5e7eb', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {org.logo_url ? (
                  <img src={org.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
                ) : (
                  <span style={{ fontSize: '22px' }}>🏢</span>
                )}
              </div>
              <div>
                <label style={{ display: 'inline-block', background: '#f3f4f6', color: '#374151', padding: '7px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: '1.5px solid #e5e7eb' }}>
                  {uploadingLogo ? 'Uploading…' : org.logo_url ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={uploadingLogo} />
                </label>
                {org.logo_url && <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>Logo uploaded ✓</p>}
              </div>
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', background: '#1a3d2b', color: 'white', border: 'none', padding: '14px', borderRadius: '999px', fontSize: '15px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : '✓ Save Profile'}
        </button>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '560px', padding: '28px', position: 'relative' }}>
            <button onClick={() => setShowEventModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', fontSize: '16px', cursor: 'pointer', color: '#6b7280' }}>
              ✕
            </button>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', marginBottom: '20px' }}>
              {editingEvent ? 'Edit Event' : 'Add Event'}
            </h2>

            {eventError && (
              <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
                ⚠️ {eventError}
              </div>
            )}

            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={eventForm.title || ''} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} />

            <label style={labelStyle}>Date *</label>
            <input type="date" style={inputStyle} value={eventForm.date || ''} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Start Time</label>
                <select style={inputStyle} value={eventForm.time || ''} onChange={e => setEventForm({ ...eventForm, time: e.target.value })}>
                  <option value=''>Select time…</option>
                  {timeSlots.map(slot => {
                    const [value, label] = slot.split('|')
                    return <option key={value} value={value}>{label}</option>
                  })}
                </select>
              </div>
              <div>
                <label style={labelStyle}>End Time</label>
                <select style={inputStyle} value={eventForm.end_time || ''} onChange={e => setEventForm({ ...eventForm, end_time: e.target.value })}>
                  <option value=''>No end time…</option>
                  {timeSlots.map(slot => {
                    const [value, label] = slot.split('|')
                    return <option key={value} value={value}>{label}</option>
                  })}
                </select>
              </div>
            </div>

            <label style={labelStyle}>Category *</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
              {CATEGORIES.map(cat => {
                const isActive = (eventForm.category || '') === cat.value
                return (
                  <label key={cat.value}
                    style={{ display: 'block', padding: '10px 14px', borderRadius: '8px', border: `1.5px solid ${isActive ? '#1a3d2b' : '#e5e7eb'}`, background: isActive ? '#f0fdf4' : 'white', cursor: 'pointer' }}>
                    <input type="radio" checked={isActive}
                      onChange={() => setEventForm({ ...eventForm, category: cat.value })}
                      style={{ display: 'none' }} />
                    <div style={{ fontSize: '13px', fontWeight: 700, color: isActive ? '#1a3d2b' : '#1f2937' }}>{cat.label}</div>
                  </label>
                )
              })}
            </div>

            <label style={labelStyle}>Location / Venue Name</label>
            <input style={inputStyle} placeholder="e.g. Mill Valley Community Center" value={eventForm.location || ''} onChange={e => setEventForm({ ...eventForm, location: e.target.value })} />

            <label style={labelStyle}>Address</label>
            <input style={inputStyle} placeholder="e.g. 180 Camino Alto, Mill Valley, CA" value={eventForm.address || ''} onChange={e => setEventForm({ ...eventForm, address: e.target.value })} />

            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              value={eventForm.description || ''} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Cost</label>
                <input style={inputStyle} placeholder="Free / $10 / Suggested donation" value={eventForm.cost || ''} onChange={e => setEventForm({ ...eventForm, cost: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Age</label>
                <input style={inputStyle} placeholder="All ages / 21+ / Kids" value={eventForm.age || ''} onChange={e => setEventForm({ ...eventForm, age: e.target.value })} />
              </div>
            </div>

            <label style={labelStyle}>Website</label>
            <input style={inputStyle} placeholder="https://..." value={eventForm.website || ''} onChange={e => setEventForm({ ...eventForm, website: e.target.value })} />

            <label style={labelStyle}>Online Meeting Link (optional)</label>
            <input style={inputStyle} placeholder="https://zoom.us/..." value={eventForm.meeting_link || ''} onChange={e => setEventForm({ ...eventForm, meeting_link: e.target.value })} />

            <label style={labelStyle}>Tags</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
              {[
                { value: 'free', label: '🟢 Free' },
                { value: 'family', label: '⭐ Family-Friendly' },
                { value: 'senior', label: '🌟 50+ Friendly' },
                { value: 'wellness', label: '🧘 Health & Wellness' },
                { value: 'reg', label: '🎟️ Reg. Required' },
              ].map(tag => {
                const selected = (eventForm.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean).includes(tag.value)
                return (
                  <button key={tag.value} type="button"
                    onClick={() => {
                      const current = (eventForm.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
                      const updated = selected ? current.filter((t: string) => t !== tag.value) : [...current, tag.value]
                      setEventForm({ ...eventForm, tags: updated.join(', ') })
                    }}
                    style={{ padding: '6px 14px', borderRadius: '999px', border: `1.5px solid ${selected ? '#1a3d2b' : '#e5e7eb'}`, background: selected ? '#1a3d2b' : 'white', color: selected ? 'white' : '#374151', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {tag.label}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setShowEventModal(false)}
                style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', padding: '12px', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSaveEvent} disabled={eventSaving}
                style={{ flex: 2, background: '#1a3d2b', color: 'white', border: 'none', padding: '12px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: eventSaving ? 'not-allowed' : 'pointer', opacity: eventSaving ? 0.7 : 1 }}>
                {eventSaving ? 'Saving…' : editingEvent ? 'Save Changes' : 'Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}