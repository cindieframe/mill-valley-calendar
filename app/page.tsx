'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getEvents } from './events'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

const CATS: Record<string, {label: string, icon: string}> = {
  outdoors:  { label: 'Outdoors, Sports & Movement', icon: '🥾' },
  arts:      { label: 'Arts & Performances',         icon: '🎭' },
  food:      { label: 'Food, Drink & Social',        icon: '🍷' },
  community: { label: 'Volunteer & Community',       icon: '🤝' },
  family:    { label: 'Family & Youth',              icon: '👨‍👩‍👧' },
  classes:   { label: 'Classes & Lectures',          icon: '📚' },
  gov:       { label: 'Local Government',            icon: '🏛️' },
}

const CAT_COLORS: Record<string, {bg: string, border: string}> = {
  outdoors:  { bg: '#16803c', border: '#16803c' },
  arts:      { bg: '#7c22ce', border: '#7c22ce' },
  food:      { bg: '#c2410c', border: '#c2410c' },
  community: { bg: '#b45309', border: '#b45309' },
  family:    { bg: '#0e7490', border: '#0e7490' },
  classes:   { bg: '#4338ca', border: '#4338ca' },
  gov:       { bg: '#4b5563', border: '#4b5563' },
}

const TAG_META: Record<string, {label: string, bg: string, color: string, activeBg: string}> = {
  free:      { label: '🟢 Free',             bg: '#dcfce7', color: '#166534', activeBg: '#16a34a' },
  family:    { label: '⭐ Family-Friendly',   bg: '#fef9c3', color: '#854d0e', activeBg: '#b45309' },
  senior:    { label: '🌟 50+ Friendly',      bg: '#ede9fe', color: '#4c1d95', activeBg: '#6d28d9' },
  wellness:  { label: '🧘 Health & Wellness', bg: '#fce7f3', color: '#9d174d', activeBg: '#9d174d' },
  volunteer: { label: '🙋 Volunteer Opp.',    bg: '#fef9c3', color: '#713f12', activeBg: '#713f12' },
  reg:       { label: '🎟️ Reg. Required',    bg: '#fff7ed', color: '#9a3412', activeBg: '#9a3412' },
}

function getDateStrings() {
  const today = new Date()
  today.setHours(0,0,0,0)
  const todayStr = today.toISOString().split('T')[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate()+1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  const day = today.getDay()
  const satOffset = (6-day+7)%7||7
  const sat = new Date(today); sat.setDate(today.getDate()+satOffset)
  const sun = new Date(today); sun.setDate(today.getDate()+satOffset+1)
  const satStr = sat.toISOString().split('T')[0]
  const sunStr = sun.toISOString().split('T')[0]
  const fmt = (d: Date) => d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  return { todayStr, tomorrowStr, satStr, sunStr,
    todayLabel: fmt(today),
    tomorrowLabel: fmt(tomorrow),
    weekendLabel: `${fmt(sat)}–${fmt(sun)}`
  }
}

export default function Home() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilters, setCatFilters] = useState<string[]>([])
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [orgFilter, setOrgFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [currentView, setCurrentView] = useState('today')
  const [fromDate, setFromDate] = useState<Date|null>(null)
  const [toDate, setToDate] = useState<Date|null>(null)

  useEffect(() => {
    async function loadEvents() {
      const data = await getEvents()
      setEvents(data)
      setLoading(false)
    }
    loadEvents()
  }, [])

  const { todayStr, tomorrowStr, satStr, sunStr, todayLabel, tomorrowLabel, weekendLabel } = getDateStrings()

  const filtered = events.filter(ev => {
    if (currentView==='today' && ev.date !== todayStr) return false
    if (currentView==='tomorrow' && ev.date !== tomorrowStr) return false
    if (currentView==='weekend' && ev.date !== satStr && ev.date !== sunStr) return false
    if (currentView==='pick' && fromDate && toDate) {
      const evDate = new Date(ev.date+'T12:00:00')
      if (evDate < fromDate || evDate > toDate) return false
    }
    if (catFilters.length > 0 && !catFilters.some(f => (ev.cats||[]).includes(f))) return false
    if (tagFilters.length > 0 && !tagFilters.every(t => ev.tags?.split(',').map((x:string)=>x.trim()).includes(t))) return false
    if (orgFilter && ev.organization !== orgFilter) return false
    if (search && !ev.title?.toLowerCase().includes(search.toLowerCase()) &&
        !ev.location?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'sans-serif',color:'#2d6a4f',fontSize:'18px'}}>
      🌲 Loading Mill Valley Townstir...
    </div>
  )

  if (selectedEvent) return (
    <div style={{fontFamily:'sans-serif',maxWidth:'700px',margin:'0 auto',padding:'24px'}}>
      <button onClick={() => setSelectedEvent(null)}
        style={{background:'#2d6a4f',color:'white',border:'none',padding:'8px 18px',borderRadius:'999px',cursor:'pointer',marginBottom:'20px',fontSize:'13px',fontWeight:700}}>
        ← Back to Calendar
      </button>
      <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginBottom:'10px'}}>
        {(selectedEvent.cats||[]).map((c: string) => (
          CATS[c] ? (
            <span key={c} style={{display:'inline-block',padding:'4px 12px',borderRadius:'999px',fontSize:'11px',fontWeight:700,background:CAT_COLORS[c]?.bg||'#d1fae5',color:'white'}}>
              {CATS[c].icon} {CATS[c].label}
            </span>
          ) : null
        ))}
      </div>
      <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',fontWeight:900,color:'#1f2937',marginBottom:'6px'}}>{selectedEvent.title}</h1>
      <p style={{color:'#9ca3af',marginBottom:'24px',fontSize:'14px'}}>Presented by {selectedEvent.organization}</p>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',background:'white',borderRadius:'12px',padding:'20px',marginBottom:'16px',boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
        <div><div style={{fontSize:'10px',color:'#9ca3af',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'3px'}}>Date</div>
          <div style={{fontWeight:700}}>{new Date(selectedEvent.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</div></div>
        <div><div style={{fontSize:'10px',color:'#9ca3af',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'3px'}}>Time</div><div style={{fontWeight:700}}>{selectedEvent.time}</div></div>
        <div><div style={{fontSize:'10px',color:'#9ca3af',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'3px'}}>Location</div><div style={{fontWeight:700}}>{selectedEvent.location}</div><div style={{fontSize:'12px',color:'#9ca3af'}}>{selectedEvent.address}</div></div>
        <div><div style={{fontSize:'10px',color:'#9ca3af',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'3px'}}>Cost</div><div style={{fontWeight:700}}>{selectedEvent.cost||'See organizer'}</div></div>
      </div>
      <p style={{fontSize:'15px',color:'#4b5563',lineHeight:1.8,marginBottom:'24px'}}>{selectedEvent.description}</p>
      <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedEvent.address||selectedEvent.location)}`}
          target="_blank" rel="noopener noreferrer"
          style={{background:'#4285f4',color:'white',padding:'10px 20px',borderRadius:'999px',textDecoration:'none',fontSize:'13px',fontWeight:700}}>
          🗺 Get Directions
        </a>
        {selectedEvent.website && (
          <a href={selectedEvent.website} target="_blank" rel="noopener noreferrer"
            style={{background:'white',color:'#1f2937',padding:'10px 20px',borderRadius:'999px',textDecoration:'none',fontSize:'13px',fontWeight:700,border:'1.5px solid #e5e7eb'}}>
            🎟 Learn More
          </a>
        )}
      </div>
    </div>
  )

  const shortcuts = [
    { label: `Today  ${todayLabel}`,         value: 'today' },
    { label: `Tomorrow  ${tomorrowLabel}`,   value: 'tomorrow' },
    { label: `This Weekend  ${weekendLabel}`,value: 'weekend' },
    { label: 'All Dates',                    value: 'all' },
    { label: '📆 Pick a Date',               value: 'pick' },
  ]

  return (
    <div style={{fontFamily:'sans-serif',minHeight:'100vh',background:'#fafaf8'}}>

      {/* Header */}
      <header style={{background:'#1a3d2b',padding:'14px 40px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100}}>
        <div>
          <span style={{fontWeight:800,fontSize:'22px',color:'white',letterSpacing:'-1px'}}>town</span>
          <span style={{fontWeight:800,fontSize:'22px',color:'#e6a020',letterSpacing:'-1px',textTransform:'uppercase'}}>STIR</span>
          <div style={{fontSize:'9px',color:'rgba(255,255,255,0.5)',letterSpacing:'2.5px',textTransform:'uppercase',marginTop:'2px'}}>🌲 Mill Valley, CA</div>
        </div>
        <button onClick={() => router.push('/post-event')}
          style={{background:'#e6a020',color:'white',border:'none',padding:'8px 18px',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
          + Post Event
        </button>
      </header>

      {/* Hero */}
      <div style={{background:'linear-gradient(160deg,#1a3d2b 0%,#2d6a4f 60%,#1a4a30 100%)',padding:'40px',textAlign:'center'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(24px,4vw,44px)',color:'white',fontWeight:800,marginBottom:'8px',letterSpacing:'-0.5px'}}>
          What&apos;s happening in <em style={{color:'#e6a020'}}>Mill Valley</em>
        </h1>
        <p style={{color:'rgba(255,255,255,0.7)',marginBottom:'20px',fontSize:'14px'}}>Your community — all in one place</p>
        <div style={{display:'flex',maxWidth:'540px',margin:'0 auto',background:'white',borderRadius:'999px',overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}}>
          <input type="text" placeholder="Search events, venues, organizers…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{flex:1,border:'none',padding:'12px 20px',fontSize:'14px',outline:'none',background:'transparent'}}/>
          <button style={{background:'#e05d2b',color:'white',border:'none',padding:'10px 22px',margin:'4px',borderRadius:'999px',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
            Search
          </button>
        </div>
      </div>

      {/* Date shortcuts */}
      <div style={{background:'white',borderBottom:'1px solid #f3f4f6',padding:'10px 40px',display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'center'}}>
        {shortcuts.map(({label,value}) => (
          <button key={value} onClick={() => setCurrentView(value)}
            style={{padding:'8px 18px',borderRadius:'999px',border:`1.5px solid ${currentView===value?'#1a3d2b':'#e5e7eb'}`,background:currentView===value?'#1a3d2b':'white',color:currentView===value?'white':'#6b7280',fontWeight:600,fontSize:'13px',cursor:'pointer',transition:'all 0.18s',whiteSpace:'nowrap'}}>
            {label}
          </button>
        ))}
      </div>

      {/* Date range picker */}
      {currentView==='pick' && (
        <div style={{background:'white',borderBottom:'1px solid #f3f4f6',padding:'12px 40px',display:'flex',justifyContent:'center'}}>
          <DatePicker
            selected={fromDate}
            onChange={(dates) => {
              const [start, end] = dates as [Date|null, Date|null]
              setFromDate(start)
              setToDate(end)
            }}
            startDate={fromDate}
            endDate={toDate}
            selectsRange
            inline
            className="date-picker-input"
          />
        </div>
      )}

      {/* Category filters */}
      <div style={{background:'white',borderBottom:'1px solid #f3f4f6',padding:'10px 40px',display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'center',alignItems:'center'}}>
        <span style={{fontSize:'10px',fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'1px',marginRight:'4px'}}>Category</span>
        <button onClick={() => setCatFilters([])}
          style={{padding:'7px 14px',borderRadius:'999px',border:'1.5px solid',borderColor:catFilters.length===0?'#1a3d2b':'#e5e7eb',background:catFilters.length===0?'#1a3d2b':'white',color:catFilters.length===0?'white':'#6b7280',fontWeight:600,fontSize:'12px',cursor:'pointer'}}>
          📅 All
        </button>
        {Object.entries(CATS).map(([key, cat]) => {
          const isActive = catFilters.includes(key)
          const c = CAT_COLORS[key]
          return (
            <button key={key}
              onClick={() => setCatFilters(prev =>
                prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
              )}
              style={{padding:'7px 14px',borderRadius:'999px',border:`1.5px solid ${isActive?c.border:'#e5e7eb'}`,background:isActive?c.bg:'white',color:isActive?'white':'#6b7280',fontWeight:600,fontSize:'12px',cursor:'pointer',transition:'all 0.18s'}}>
              {cat.icon} {cat.label}
            </button>
          )
        })}
      </div>

      {/* Tag filters */}
      <div style={{background:'#f9fafb',borderBottom:'1px solid #f3f4f6',padding:'8px 40px',display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'center',alignItems:'center'}}>
        <span style={{fontSize:'10px',fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'1px',marginRight:'4px'}}>Tags</span>
        {Object.entries(TAG_META).map(([value, meta]) => {
          const isActive = tagFilters.includes(value)
          return (
            <button key={value}
              onClick={() => setTagFilters(prev =>
                prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
              )}
              style={{padding:'5px 12px',borderRadius:'999px',border:`1.5px solid ${isActive?meta.activeBg:'#e5e7eb'}`,background:isActive?meta.activeBg:'white',color:isActive?'white':'#6b7280',fontWeight:600,fontSize:'11px',cursor:'pointer',transition:'all 0.18s'}}>
              {meta.label}
            </button>
          )
        })}
      </div>

      {/* Organization filter */}
      <div style={{background:'white',borderBottom:'1px solid #f3f4f6',padding:'8px 40px',display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'center',alignItems:'center'}}>
        <span style={{fontSize:'10px',fontWeight:700,color:'#374151',textTransform:'uppercase',letterSpacing:'1px',marginRight:'4px'}}>Organization</span>
        <select value={orgFilter} onChange={e=>setOrgFilter(e.target.value)}
          style={{border:'1.5px solid #e5e7eb',borderRadius:'999px',padding:'5px 14px',fontSize:'12px',fontWeight:600,color:'#6b7280',background:'white',cursor:'pointer',outline:'none'}}>
          <option value=''>All Organizations</option>
          <option>Chamber of Commerce</option>
          <option>City of Mill Valley</option>
          <option>MV Library</option>
          <option>MV Little League</option>
        </select>
      </div>

      {/* Events list */}
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'24px 40px'}}>
        {filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:'60px 20px',color:'#9ca3af'}}>
            <div style={{fontSize:'40px',marginBottom:'12px'}}>📭</div>
            <p style={{fontSize:'15px'}}>No events found. Try a different filter or search.</p>
          </div>
        ) : (
          filtered.map(ev => (
            <div key={ev.id} onClick={() => setSelectedEvent(ev)}
              style={{background:'white',borderRadius:'12px',padding:'16px 18px',marginBottom:'10px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',cursor:'pointer',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'14px',borderLeft:`4px solid ${CAT_COLORS[ev.cats?.[0]]?.bg||'#2d6a4f'}`,transition:'all 0.2s'}}
              onMouseOver={e => (e.currentTarget.style.transform='translateY(-2px)')}
              onMouseOut={e => (e.currentTarget.style.transform='translateY(0)')}>
              <div style={{flex:1}}>
                <h3 style={{fontSize:'14px',fontWeight:700,color:'#1f2937',margin:'0 0 4px 0'}}>{ev.title}</h3>
                <div style={{fontSize:'13px',color:'#6b7280',marginBottom:'6px'}}>
                  📅 {new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric'})} &nbsp;·&nbsp; 🕐 {ev.time} &nbsp;·&nbsp; 📍 {ev.location}
                  <br/>
                  👥 {ev.organization}{ev.cost && <>&nbsp;·&nbsp; 💰 {ev.cost}</>}
                </div>
                {ev.tags && ev.tags.split(',').map((tag: string) => {
                  const t = tag.trim()
                  const meta = TAG_META[t]
                  return meta ? (
                    <span key={t} style={{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:'999px',fontSize:'10px',fontWeight:700,background:meta.bg,color:meta.color,marginRight:'4px'}}>
                      {meta.label}
                    </span>
                  ) : null
                })}
              </div>
              <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:'4px',alignItems:'flex-end'}}>
                {(ev.cats||[]).map((c: string) => (
                  CATS[c] ? (
                    <span key={c} style={{display:'inline-block',padding:'4px 10px',borderRadius:'999px',fontSize:'10px',fontWeight:700,background:CAT_COLORS[c]?.bg||'#d1fae5',color:'white',whiteSpace:'nowrap'}}>
                      {CATS[c].icon} {CATS[c].label}
                    </span>
                  ) : null
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
