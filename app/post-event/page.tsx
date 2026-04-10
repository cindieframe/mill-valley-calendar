'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'

export default function PostEvent() {
  const router = useRouter()
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
    setForm(prev => ({...prev, [field]: value}))

  const toggleItem = (field: 'category' | 'tags', value: string) =>
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v: string) => v !== value)
        : [...prev[field], value]
    }))

  // Format time value for display e.g. "14:30" → "2:30 PM"
  const formatTime = (val: string) => {
    if (!val) return ''
    const [h, m] = val.split(':').map(Number)
    const ampm = h >= 12 ? 'PM' : 'AM'
    const hour = h % 12 || 12
    return `${hour}:${String(m).padStart(2,'0')} ${ampm}`
  }

  const handleSubmit = async () => {
    if (!form.title || !form.date || !form.time || !form.location || !form.organization || !form.description || form.category.length === 0) {
      alert('Please fill in all required fields and select at least one category.')
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
      status: 'pending',
    }])
    setSubmitting(false)
    if (error) {
      alert('Something went wrong. Please try again.')
      console.error(error)
    } else {
      setSubmitted(true)
    }
  }

  const cats = [
    { value: 'outdoors',  label: '🥾 Outdoors, Sports & Movement', ex: 'Hikes, yoga, leagues, races, running clubs, martial arts' },
    { value: 'arts',      label: '🎭 Arts & Performances',         ex: 'Concerts, film screenings, theater, open studios, open mic' },
    { value: 'food',      label: '🍷 Food, Drink & Social',        ex: 'Farmers markets, potlucks, mixers, wine tastings, trivia' },
    { value: 'community', label: '🤝 Volunteer & Community',       ex: 'Trail cleanups, food bank, habitat restoration, protests' },
    { value: 'family',    label: '👨‍👩‍👧 Family & Youth',             ex: 'Storytime, kids workshops, school events, family activities' },
    { value: 'classes',   label: '📚 Classes & Lectures',          ex: 'Cooking, photography, pickleball lessons, lectures, demos' },
    { value: 'gov',       label: '🏛️ Local Government',            ex: 'City council, planning commission, town halls, hearings' },
  ]

  const tags = [
    { value: 'free',      label: '🟢 Free' },
    { value: 'family',    label: '⭐ Family-Friendly' },
    { value: 'senior',    label: '🌟 50+ Friendly' },
    { value: 'wellness',  label: '🧘 Health & Wellness' },
    
    { value: 'reg',       label: '🎟️ Registration Required' },
  ]

  const timeSlots: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const ampm = h >= 12 ? 'PM' : 'AM'
      const hour = h % 12 || 12
      const label = `${hour}:${String(m).padStart(2,'0')} ${ampm}`
      const value = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
      timeSlots.push(`${value}|${label}`)
    }
  }

  if (submitted) return (
    <div style={{minHeight:'100vh',background:'#fafaf8',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'sans-serif',padding:'24px'}}>
      <div style={{background:'white',borderRadius:'16px',padding:'48px 40px',textAlign:'center',maxWidth:'480px',boxShadow:'0 4px 24px rgba(0,0,0,0.08)'}}>
        <div style={{fontSize:'52px',marginBottom:'16px'}}>🎉</div>
        <h2 style={{fontFamily:'Georgia,serif',fontSize:'26px',fontWeight:900,color:'#1f2937',marginBottom:'8px'}}>Event Received!</h2>
        <p style={{fontSize:'15px',color:'#4b5563',marginBottom:'6px',lineHeight:1.6}}>
          <strong>{form.title}</strong> has been submitted for review.
        </p>
        <p style={{fontSize:'13px',color:'#6b7280',marginBottom:'24px',lineHeight:1.6}}>
          Our team will review it within 24 hours. Once approved it will appear on the Mill Valley Townstir calendar.
        </p>
        {form.email && (
          <div style={{background:'#f0fdf4',borderRadius:'8px',padding:'12px 16px',marginBottom:'24px',fontSize:'12px',color:'#166534',fontWeight:500}}>
            A confirmation will be sent to {form.email} once the site goes live.
          </div>
        )}
        <button onClick={() => router.push('/')}
          style={{background:'#1a3d2b',color:'white',border:'none',padding:'12px 28px',borderRadius:'999px',fontSize:'14px',fontWeight:700,cursor:'pointer'}}>
          Back to Calendar
        </button>
      </div>
    </div>
  )

  const inputStyle = {
    width:'100%',border:'1.5px solid #e5e7eb',borderRadius:'8px',
    padding:'10px 14px',fontFamily:'sans-serif',fontSize:'13px',
    color:'#1f2937',outline:'none',background:'white'
  }
  const labelStyle = {
    display:'block' as const,fontSize:'11px',fontWeight:700 as const,
    color:'#374151',marginBottom:'5px',textTransform:'uppercase' as const,letterSpacing:'0.8px'
  }
  const selectStyle = {
    ...inputStyle,cursor:'pointer'
  }

  return (
    <div style={{minHeight:'100vh',background:'#fafaf8',fontFamily:'sans-serif'}}>

      {/* Header */}
      <header style={{background:'#1a3d2b',padding:'14px 40px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <span style={{fontWeight:800,fontSize:'22px',color:'white',letterSpacing:'-1px'}}>town</span>
          <span style={{fontWeight:800,fontSize:'22px',color:'#e6a020',letterSpacing:'-1px',textTransform:'uppercase'}}>STIR</span>
          <div style={{fontSize:'9px',color:'rgba(255,255,255,0.5)',letterSpacing:'2.5px',textTransform:'uppercase',marginTop:'2px'}}>🌲 Mill Valley, CA</div>
        </div>
        <button onClick={() => router.push('/')}
          style={{background:'transparent',color:'rgba(255,255,255,0.7)',border:'1.5px solid rgba(255,255,255,0.3)',padding:'8px 18px',borderRadius:'999px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
          ← Back to Calendar
        </button>
      </header>

      <div style={{maxWidth:'640px',margin:'0 auto',padding:'40px 24px 80px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'32px',fontWeight:900,color:'#1f2937',marginBottom:'6px',letterSpacing:'-0.5px'}}>
          Post a Community Event
        </h1>
        <p style={{color:'#9ca3af',fontSize:'14px',marginBottom:'32px'}}>
          Events are reviewed before going live — usually within 24 hours.
        </p>

        {/* Title */}
        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Event Title *</label>
          <input style={inputStyle} placeholder="e.g. Morning Runners — Tam Trail"
            value={form.title} onChange={e=>update('title',e.target.value)}/>
        </div>

        {/* Date */}
        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Date *</label>
          <input style={inputStyle} type="date"
            value={form.date} onChange={e=>update('date',e.target.value)}/>
        </div>

        {/* Start + End Time */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'16px'}}>
          <div>
            <label style={labelStyle}>Start Time *</label>
            <select style={selectStyle} value={form.time} onChange={e=>update('time',e.target.value)}>
              <option value=''>Select time…</option>
              {timeSlots.map(slot => {
                const [value, label] = slot.split('|')
                return <option key={value} value={value}>{label}</option>
              })}
            </select>
          </div>
          <div>
            <label style={labelStyle}>End Time</label>
            <select style={selectStyle} value={form.end_time} onChange={e=>update('end_time',e.target.value)}>
              <option value=''>No end time…</option>
              {timeSlots.map(slot => {
                const [value, label] = slot.split('|')
                return <option key={value} value={value}>{label}</option>
              })}
            </select>
          </div>
        </div>

        {/* Recurrence */}
        <div style={{marginBottom:'16px'}}>
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

        {/* Custom recurrence panel */}
        {recurrence === 'custom' && (
          <div style={{background:'#f9fafb',borderRadius:'10px',padding:'16px',marginBottom:'16px',border:'1.5px solid #e5e7eb'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
              <div>
                <label style={labelStyle}>Repeat every</label>
                <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                  <input style={{...inputStyle,width:'60px'}} type="number" min={1} max={30} defaultValue={1}/>
                  <select style={{...selectStyle,flex:1}}>
                    <option>days</option>
                    <option>weeks</option>
                    <option>months</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Ends</label>
                <select style={selectStyle} value={endsOn} onChange={e=>setEndsOn(e.target.value)}>
                  <option value='never'>Never</option>
                  <option value='on'>On a date</option>
                  <option value='after'>After occurrences</option>
                </select>
              </div>
            </div>
            {endsOn === 'on' && (
              <div>
                <label style={labelStyle}>End Date</label>
                <input style={inputStyle} type="date"
                  value={form.recurrence_end} onChange={e=>update('recurrence_end',e.target.value)}/>
              </div>
            )}
            {endsOn === 'after' && (
              <div>
                <label style={labelStyle}>Number of occurrences</label>
                <input style={{...inputStyle,width:'80px'}} type="number" min={1} max={365}
                  value={form.recurrence_count} onChange={e=>update('recurrence_count',e.target.value)}/>
              </div>
            )}
          </div>
        )}

        {/* Cost + Age */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'16px'}}>
          <div>
            <label style={labelStyle}>Cost</label>
            <input style={inputStyle} placeholder="e.g. Free, $10, $5–$15"
              value={form.cost} onChange={e=>update('cost',e.target.value)}/>
          </div>
          <div>
            <label style={labelStyle}>Age Requirements</label>
            <input style={inputStyle} placeholder="e.g. All ages, Adults only"
              value={form.age} onChange={e=>update('age',e.target.value)}/>
          </div>
        </div>

        {/* Location */}
        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Venue / Location Name *</label>
          <input style={inputStyle} placeholder="e.g. Old Mill Park"
            value={form.location} onChange={e=>update('location',e.target.value)}/>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Full Address</label>
          <input style={inputStyle} placeholder="e.g. 352 Throckmorton Ave, Mill Valley, CA"
            value={form.address} onChange={e=>update('address',e.target.value)}/>
        </div>

        {/* Online meeting link */}
        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Online Meeting Link <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'#9ca3af'}}>(optional — for hybrid or virtual events)</span></label>
          <input style={inputStyle} type="url" placeholder="https://zoom.us/j/… or https://meet.google.com/…"
            value={form.meeting_link} onChange={e=>update('meeting_link',e.target.value)}/>
        </div>

        {/* Category */}
        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Category * <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'#9ca3af'}}>(choose all that apply)</span></label>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {cats.map(({value,label,ex}) => {
              const isActive = form.category.includes(value)
              return (
                <label key={value}
                  style={{display:'block',padding:'11px 14px',borderRadius:'8px',border:`1.5px solid ${isActive?'#1a3d2b':'#e5e7eb'}`,background:isActive?'#f0fdf4':'white',cursor:'pointer',transition:'all 0.18s'}}>
                  <input type="checkbox" checked={isActive}
                    onChange={()=>toggleItem('category',value)}
                    style={{display:'none'}}/>
                  <div style={{fontSize:'13px',fontWeight:700,color:isActive?'#1a3d2b':'#1f2937',marginBottom:'2px'}}>{label}</div>
                  <div style={{fontSize:'11px',color:isActive?'#16a34a':'#9ca3af'}}>{ex}</div>
                </label>
              )
            })}
          </div>
          <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'6px'}}>Tip: pick the main reason someone would attend.</div>
        </div>

        {/* Tags */}
        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Tags</label>
          <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
            {tags.map(({value,label}) => {
              const isActive = form.tags.includes(value)
              return (
                <label key={value}
                  style={{display:'flex',alignItems:'center',gap:'5px',padding:'7px 13px',borderRadius:'999px',border:`1.5px solid ${isActive?'#1a3d2b':'#e5e7eb'}`,background:isActive?'#f0fdf4':'white',cursor:'pointer',fontSize:'12px',fontWeight:600,color:isActive?'#1a3d2b':'#6b7280',transition:'all 0.18s'}}>
                  <input type="checkbox" checked={isActive}
                    onChange={()=>toggleItem('tags',value)}
                    style={{display:'none'}}/>
                  {label}
                </label>
              )
            })}
          </div>
        </div>

        {/* Organization */}
        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Organization / Posted By *</label>
          <input style={inputStyle} placeholder="e.g. Tam Valley Running Club"
            value={form.organization} onChange={e=>update('organization',e.target.value)}/>
        </div>

        {/* Description */}
        <div style={{marginBottom:'16px'}}>
          <label style={labelStyle}>Description *</label>
          <textarea style={{...inputStyle,minHeight:'100px',resize:'vertical'}}
            placeholder="Tell the community about your event — who it's for, what to bring, what to expect…"
            value={form.description} onChange={e=>update('description',e.target.value)}/>
        </div>

        {/* Photo placeholder */}
        <div style={{marginBottom:'16px',background:'#f9fafb',borderRadius:'8px',padding:'14px 16px',border:'1.5px dashed #e5e7eb'}}>
          <label style={labelStyle}>Event Photo <span style={{fontWeight:400,textTransform:'none',letterSpacing:0,color:'#9ca3af'}}>(optional)</span></label>
          <p style={{fontSize:'12px',color:'#9ca3af',marginTop:'4px'}}>📸 Photo upload will be available when the site goes live.</p>
        </div>

        {/* Contact */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'32px'}}>
          <div>
            <label style={labelStyle}>Contact Email</label>
            <input style={inputStyle} type="email" placeholder="you@example.com"
              value={form.email} onChange={e=>update('email',e.target.value)}/>
          </div>
          <div>
            <label style={labelStyle}>Website / RSVP Link</label>
            <input style={inputStyle} type="url" placeholder="https://…"
              value={form.website} onChange={e=>update('website',e.target.value)}/>
          </div>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting}
          style={{width:'100%',background:'#1a3d2b',color:'white',border:'none',padding:'14px',borderRadius:'999px',fontSize:'15px',fontWeight:700,cursor:submitting?'not-allowed':'pointer',opacity:submitting?0.7:1}}>
          {submitting ? 'Submitting…' : 'Submit Event for Review'}
        </button>
      </div>
    </div>
  )
}