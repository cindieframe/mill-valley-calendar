'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'
import ReCAPTCHA from 'react-google-recaptcha'
import Header from '../components/Header'
import { colors, fonts, radii } from '@/app/lib/tokens'

export default function PostEvent() {
  const recaptchaRef = useRef<any>(null)
  const locationInputRef = useRef<any>(null)
  const autocompleteRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const loadGoogleMaps = () => {
      if ((window as any).google?.maps?.places) { initAutocomplete(); return }
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
      script.async = true
      script.onload = initAutocomplete
      document.head.appendChild(script)
    }
    const initAutocomplete = () => {
      if (!locationInputRef.current) return
      const autocomplete = new (window as any).google.maps.places.Autocomplete(
        locationInputRef.current,
        { types: ['establishment', 'geocode'], componentRestrictions: { country: 'us' } }
      )
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (place.name) update('location', place.name)
        if (place.formatted_address) update('address', place.formatted_address)
      })
      autocompleteRef.current = autocomplete
    }
    loadGoogleMaps()
  }, [])

  const router = useRouter()
  const [imageUrl, setImageUrl] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [recurrence, setRecurrence] = useState('none')
  const [endsOn, setEndsOn] = useState('never')
  const [form, setForm] = useState({
    title: '',
    date: '',
    time: '',
    end_time: '',
    location: '',
    address: '',
    meeting_link: '',
    organization: '',
    category: [] as string[],
    tags: [] as string[],
    cost: '',
    age: '',
    description: '',
    email: '',
    website: '',
    recurrence: 'none',
    recurrence_end: '',
    recurrence_count: '',
  })

  const update = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const toggleItem = (field: 'category' | 'tags', value: string) =>
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value]
    }))

  const formatTime = (val: string) => {
    if (!val) return ''
    const [h, m] = val.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return }
    setImageUploading(true)
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('event-images').upload(fileName, file, { upsert: true })
    if (uploadError) { alert('Upload failed. Please try again.'); setImageUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('event-images').getPublicUrl(fileName)
    setImageUrl(publicUrl)
    setImageUploading(false)
  }

  const handleSubmit = async () => {
    if (!form.title || !form.date || !form.time || !form.location || !form.organization || !form.description || form.category.length === 0) {
      alert('Please fill in all required fields and select at least one category.')
      return
    }
    const recaptchaToken = recaptchaRef.current?.getValue()
    if (!recaptchaToken) { alert('Please complete the reCAPTCHA verification.'); return }
    const verifyRes = await fetch('/api/verify-recaptcha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: recaptchaToken }),
    })
    if (!verifyRes.ok) {
      alert('reCAPTCHA verification failed. Please try again.')
      recaptchaRef.current?.reset()
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('events').insert([{
      title: form.title,
      date: form.date,
      time: formatTime(form.time),
      location: form.location,
      address: form.address,
      organization: form.organization,
      category: form.category.join(','),
      tags: form.tags.join(','),
      cost: form.cost,
      age: form.age,
      description: form.description,
      email: form.email,
      website: form.website,
      image_url: imageUrl || null,
      status: 'pending',
    }])
    setSubmitting(false)
    if (error) {
      alert('Something went wrong. Please try again.')
      console.error(error)
    } else {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'townstir.admin@gmail.com',
          subject: `New event submitted: ${form.title}`,
          html: `
            <p>A new event has been submitted for review.</p>
            <p><strong>Title:</strong> ${form.title}</p>
            <p><strong>Date:</strong> ${form.date}</p>
            <p><strong>Organization:</strong> ${form.organization}</p>
            <p><a href="https://www.townstir.com/admin">Review it in the admin dashboard →</a></p>
          `,
        }),
      })
      if (form.email) {
        await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: form.email,
            subject: `We received your event: ${form.title}`,
            html: `
              <p>Hi there,</p>
              <p>Thanks for submitting <strong>${form.title}</strong> to Townstir! We'll review it within 24 hours and you'll hear from us once it's approved.</p>
              <p><strong>Date:</strong> ${form.date}</p>
              <p>Thanks for helping make Mill Valley's community calendar great!</p>
              <p>— The Townstir Team</p>
            `,
          }),
        })
      }
      setSubmitted(true)
    }
  }

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: colors.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.sans, padding: '24px' }}>
      <div style={{ background: colors.cardBg, borderRadius: radii.card, padding: '48px 40px', textAlign: 'center', maxWidth: '480px' }}>
        <h2 style={{ fontFamily: fonts.serif, fontSize: '26px', fontWeight: 700, color: colors.textPrimary, marginBottom: '8px' }}>Event Received!</h2>
        <p style={{ fontSize: '15px', color: colors.textPrimary, marginBottom: '6px', lineHeight: 1.6 }}>
          <strong>{form.title}</strong> has been submitted for review.
        </p>
        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '24px', lineHeight: 1.6 }}>
          Our team will review it within 24 hours. Once approved it will appear on the Mill Valley Townstir calendar.
        </p>
        <button onClick={() => router.push('/')}
          style={{ background: colors.navBg, color: colors.textWhite, border: 'none', padding: '12px 28px', borderRadius: radii.tagPill, fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: fonts.sans }}>
          Back to Calendar
        </button>
      </div>
    </div>
  )

  const cats = [
    { value: 'outdoors',  label: 'Outdoors, Sports & Movement', ex: 'Hikes, yoga, leagues, races, running clubs, martial arts' },
    { value: 'arts',      label: 'Arts & Performances',         ex: 'Concerts, film screenings, theater, open studios, open mic' },
    { value: 'food',      label: 'Food, Drink & Social',        ex: 'Farmers markets, potlucks, mixers, wine tastings, trivia' },
    { value: 'community', label: 'Community',                   ex: 'Trail cleanups, food bank, habitat restoration, town events' },
    { value: 'family',    label: 'Family & Youth',              ex: 'Storytime, kids workshops, school events, family activities' },
    { value: 'classes',   label: 'Classes & Lectures',          ex: 'Cooking, photography, pickleball lessons, lectures, demos' },
    { value: 'gov',       label: 'Local Government',            ex: 'City council, planning commission, town halls, hearings' },
  ]

  const tags = [
    { value: 'free',      label: 'Free' },
    { value: 'family',    label: 'Family-Friendly' },
    { value: 'wellness',  label: 'Health & Wellness' },
    { value: 'reg',       label: 'Registration Required' },
    { value: 'music',     label: 'Live Music' },
    { value: 'volunteer', label: 'Volunteer' },
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

  const inputStyle = {
    width: '100%', border: `1.5px solid ${colors.borderLight}`, borderRadius: radii.categoryPill,
    padding: '10px 14px', fontFamily: fonts.sans, fontSize: '13px',
    color: colors.textPrimary, outline: 'none', background: colors.cardBg,
  }
  const labelStyle = {
    display: 'block' as const, fontSize: '11px', fontWeight: 700 as const,
    color: '#374151', marginBottom: '5px', textTransform: 'uppercase' as const, letterSpacing: '0.8px',
  }
  const selectStyle = { ...inputStyle, cursor: 'pointer' }

  return (
    <div style={{ minHeight: '100vh', background: colors.pageBg, fontFamily: fonts.sans }}>
      <Header
        rightSlot={
          <button onClick={() => router.push('/')}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: radii.tagPill, fontSize: '12px', cursor: 'pointer' }}>
            ← Back to Calendar
          </button>
        }
      />

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontFamily: fonts.serif, fontSize: '32px', fontWeight: 700, color: colors.textPrimary, marginBottom: '6px', letterSpacing: '-0.5px' }}>
          Post a Community Event
        </h1>
        <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '32px' }}>
          Events are reviewed before going live — usually within 24 hours.
        </p>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Event Title *</label>
          <input style={inputStyle} placeholder="e.g. Morning Runners — Tam Trail"
            value={form.title} onChange={e => update('title', e.target.value)} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Date *</label>
          <input style={inputStyle} type="date"
            value={form.date} onChange={e => update('date', e.target.value)}
            onFocus={e => (e.target as any).showPicker?.()} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Start Time *</label>
            <select style={selectStyle} value={form.time} onChange={e => update('time', e.target.value)}>
              <option value=''>Select time…</option>
              {timeSlots.map(slot => {
                const [value, label] = slot.split('|')
                return <option key={value} value={value}>{label}</option>
              })}
            </select>
          </div>
          <div>
            <label style={labelStyle}>End Time</label>
            <select style={selectStyle} value={form.end_time} onChange={e => update('end_time', e.target.value)}>
              <option value=''>No end time…</option>
              {timeSlots.map(slot => {
                const [value, label] = slot.split('|')
                return <option key={value} value={value}>{label}</option>
              })}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Repeats</label>
          <select style={selectStyle} value={recurrence}
            onChange={e => { setRecurrence(e.target.value); update('recurrence', e.target.value) }}>
            <option value='none'>Does not repeat</option>
            <option value='daily'>Every day</option>
            <option value='weekly'>Every week</option>
            <option value='monthly'>Every month</option>
            <option value='custom'>Custom…</option>
          </select>
        </div>

        {recurrence === 'custom' && (
          <div style={{ background: colors.pageBg, borderRadius: radii.card, padding: '16px', marginBottom: '16px', border: `1.5px solid ${colors.borderLight}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={labelStyle}>Repeat every</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input style={{ ...inputStyle, width: '60px' }} type="number" min={1} max={30} defaultValue={1} />
                  <select style={{ ...selectStyle, flex: 1 }}>
                    <option>days</option><option>weeks</option><option>months</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Ends</label>
                <select style={selectStyle} value={endsOn} onChange={e => setEndsOn(e.target.value)}>
                  <option value='never'>Never</option>
                  <option value='on'>On a date</option>
                  <option value='after'>After occurrences</option>
                </select>
              </div>
            </div>
            {endsOn === 'on' && (
              <div>
                <label style={labelStyle}>End Date</label>
                <input style={inputStyle} type="date" value={form.recurrence_end} onChange={e => update('recurrence_end', e.target.value)} />
              </div>
            )}
            {endsOn === 'after' && (
              <div>
                <label style={labelStyle}>Number of occurrences</label>
                <input style={{ ...inputStyle, width: '80px' }} type="number" min={1} max={365}
                  value={form.recurrence_count} onChange={e => update('recurrence_count', e.target.value)} />
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Cost</label>
            <input style={inputStyle} placeholder="e.g. Free, $10, $5–$15"
              value={form.cost} onChange={e => update('cost', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Age Requirements</label>
            <input style={inputStyle} placeholder="e.g. All ages, Adults only"
              value={form.age} onChange={e => update('age', e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Venue / Location Name *</label>
          <input ref={locationInputRef} style={inputStyle} placeholder="e.g. Old Mill Park"
            value={form.location} onChange={e => update('location', e.target.value)} />
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px' }}>
            Start typing a venue name and select from the dropdown to auto-fill the address.
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Full Address</label>
          <input style={inputStyle} placeholder="e.g. 352 Throckmorton Ave, Mill Valley, CA"
            value={form.address} onChange={e => update('address', e.target.value)} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Online Meeting Link <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: colors.textSecondary }}>(optional — for hybrid or virtual events)</span></label>
          <input style={inputStyle} type="url" placeholder="https://zoom.us/j/… or https://meet.google.com/…"
            value={form.meeting_link} onChange={e => update('meeting_link', e.target.value)} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Category * <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: colors.textSecondary }}>(choose all that apply)</span></label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {cats.map(({ value, label, ex }) => {
              const isActive = form.category.includes(value)
              return (
                <label key={value}
                  style={{ display: 'block', padding: '11px 14px', borderRadius: radii.categoryPill, border: `1.5px solid ${isActive ? colors.navBg : colors.borderLight}`, background: isActive ? '#f0fdf4' : colors.cardBg, cursor: 'pointer' }}>
                  <input type="checkbox" checked={isActive} onChange={() => toggleItem('category', value)} style={{ display: 'none' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? colors.navBg : colors.textPrimary, marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: isActive ? colors.orgGreen : colors.textSecondary }}>{ex}</div>
                </label>
              )
            })}
          </div>
          <div style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '6px' }}>Tip: pick the main reason someone would attend.</div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            {tags.map(({ value, label }) => {
              const isActive = form.tags.includes(value)
              return (
                <label key={value}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: radii.tagPill, border: `1.5px solid ${isActive ? colors.navBg : colors.borderLight}`, background: isActive ? '#f0fdf4' : colors.cardBg, cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: isActive ? colors.navBg : colors.textSecondary }}>
                  <input type="checkbox" checked={isActive} onChange={() => toggleItem('tags', value)} style={{ display: 'none' }} />
                  {label}
                </label>
              )
            })}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Organization / Posted By *</label>
          <input style={inputStyle} placeholder="e.g. Tam Valley Running Club"
            value={form.organization} onChange={e => update('organization', e.target.value)} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Description *</label>
          <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
            placeholder="Tell the community about your event — who it's for, what to bring, what to expect…"
            value={form.description} onChange={e => update('description', e.target.value)} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Event Photo <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: colors.textSecondary }}>(optional)</span></label>
          {imageUrl ? (
            <div style={{ marginTop: '8px' }}>
              <img src={imageUrl} alt="Event preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: radii.categoryPill, marginBottom: '8px' }} />
              <button onClick={() => setImageUrl('')}
                style={{ background: colors.cardBg, color: '#dc2626', border: '1.5px solid #dc2626', padding: '6px 14px', borderRadius: radii.tagPill, fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>
                Remove photo
              </button>
            </div>
          ) : (
            <label style={{ display: 'block', marginTop: '8px', cursor: 'pointer' }}>
              <div style={{ border: `1.5px dashed ${colors.borderLight}`, borderRadius: radii.categoryPill, padding: '24px', textAlign: 'center' as const, background: colors.pageBg }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', border: `1.5px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colors.textSecondary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: colors.textPrimary, marginBottom: '2px' }}>
                  {imageUploading ? 'Uploading…' : 'Click to upload a photo'}
                </div>
                <div style={{ fontSize: '11px', color: colors.textSecondary }}>JPG, PNG or WebP · Max 5MB</div>
              </div>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={imageUploading} />
            </label>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
          <div>
            <label style={labelStyle}>Contact Email</label>
            <input style={inputStyle} type="email" placeholder="you@example.com"
              value={form.email} onChange={e => update('email', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Website / RSVP Link</label>
            <input style={inputStyle} type="url" placeholder="https://…"
              value={form.website} onChange={e => update('website', e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <ReCAPTCHA ref={recaptchaRef} sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''} />
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', background: colors.navBg, color: colors.textWhite, border: 'none', padding: '14px', borderRadius: radii.tagPill, fontSize: '15px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: fonts.sans }}>
          {submitting ? 'Submitting…' : 'Submit Event for Review'}
        </button>
      </div>
    </div>
  )
}