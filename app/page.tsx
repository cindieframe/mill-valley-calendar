'use client'
 
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getEvents } from './events'
import { supabase } from './supabase'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Header from './components/Header'
 
const BRAND = {
  forest:    '#1a3d2b',
  amber:     '#C9952A',
  green:     '#7EC8A4',
  darkGreen: '#3a7d44',
  navy:      '#2C3E50',
  bg:        '#f2f3f5',
  white:     '#ffffff',
  border:    '#d0d6db',
  borderLight: '#e8eaed',
}
 
const CATS: Record<string, { label: string }> = {
  outdoors:  { label: 'Outdoors, Sports & Movement' },
  arts:      { label: 'Arts & Performances' },
  food:      { label: 'Food, Drink & Social' },
  community: { label: 'Volunteer & Community' },
  youth:     { label: 'Youth' },
  classes:   { label: 'Classes & Lectures' },
  gov:       { label: "Local Gov't" },
}
 
const CAT_CARD: Record<string, { bg: string; color: string }> = {
  outdoors:  { bg: 'rgba(20,100,60,0.05)',   color: '#145a30' },
  arts:      { bg: 'rgba(100,80,200,0.05)',  color: '#4a3fa0' },
  food:      { bg: 'rgba(180,80,20,0.05)',   color: '#7a3000' },
  community: { bg: 'rgba(30,80,160,0.05)',   color: '#1a4f8a' },
  youth:     { bg: 'rgba(40,120,60,0.05)',   color: '#1e6b30' },
  family:    { bg: 'rgba(40,120,60,0.05)',   color: '#1e6b30' },
  classes:   { bg: 'rgba(160,30,30,0.05)',   color: '#7a1a1a' },
  gov:       { bg: 'rgba(60,60,80,0.05)',    color: '#3a3a50' },
}
 
const CAT_LABELS: Record<string, string> = {
  outdoors:  'Outdoors',
  arts:      'Arts',
  food:      'Food & Drink',
  community: 'Vol. & Comm.',
  youth:     'Youth',
  family:    'Youth',
  classes:   'Classes',
  gov:       "Gov't",
}
 
const TAG_CARD: Record<string, { bg: string; color: string; label: string }> = {
  free:     { bg: 'rgba(180,130,0,0.06)',  color: '#7a5500', label: 'Free' },
  family:   { bg: 'rgba(0,0,0,0.04)',      color: '#555',    label: 'Family-friendly' },
  wellness: { bg: 'rgba(0,0,0,0.04)',      color: '#555',    label: 'Wellness' },
  reg:      { bg: 'rgba(0,0,0,0.04)',      color: '#555',    label: 'Reg. Required' },
  music:    { bg: 'rgba(100,80,200,0.06)', color: '#4a3fa0', label: 'Live Music' },
}
 
function getDateStrings() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const day = today.getDay()
  const satOffset = ((6 - day + 7) % 7) || 7
  const sat = new Date(today); sat.setDate(today.getDate() + satOffset)
  const sun = new Date(today); sun.setDate(today.getDate() + satOffset + 1)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return {
    todayStr,
    tomorrowStr: tomorrow.toISOString().split('T')[0],
    satStr: sat.toISOString().split('T')[0],
    sunStr: sun.toISOString().split('T')[0],
    todayLabel:    fmt(today),
    tomorrowLabel: fmt(tomorrow),
    satLabel:      fmt(sat),
    sunLabel:      fmt(sun),
  }
}
 
function formatDayHeader(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })
}
 
export default function Home() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilters, setCatFilters] = useState<string[]>([])
  const [tagFilters, setTagFilters] = useState<string[]>([])
  const [orgFilter, setOrgFilter] = useState('')
  const [orgList, setOrgList] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [aiFilters, setAiFilters] = useState<any>(null)
  const [currentView, setCurrentView] = useState('today')
  const [fromDate, setFromDate] = useState<Date | null>(null)
  const [toDate, setToDate] = useState<Date | null>(null)
  const [showFilterDrawer, setShowFilterDrawer] = useState(false)
  const [hasSpeech, setHasSpeech] = useState(false)
 
  useEffect(() => {
    if (window.location.hash?.includes('access_token')) {
      router.push('/auth/confirm' + window.location.hash)
    }
  }, [])
 
  useEffect(() => {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    setHasSpeech(!isSafari && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition))
  }, [])
 
  useEffect(() => {
    async function loadEvents() {
      const data = await getEvents()
      setEvents(data)
      setLoading(false)
    }
    loadEvents()
    async function loadOrgList() {
      const { data } = await supabase
        .from('events')
        .select('organization')
        .eq('status', 'approved')
      if (data) {
        const counts: Record<string, number> = {}
        data.forEach((e: any) => {
          if (e.organization) counts[e.organization] = (counts[e.organization] || 0) + 1
        })
        setOrgList(Object.keys(counts).filter(o => counts[o] >= 2).sort())
      }
    }
    loadOrgList()
  }, [])
 
  const {
    todayStr, tomorrowStr, satStr, sunStr,
    todayLabel, tomorrowLabel, satLabel, sunLabel,
  } = getDateStrings()
 
  const filtered = events.filter(ev => {
    if (currentView === 'today'    && ev.date !== todayStr) return false
    if (currentView === 'tomorrow' && ev.date !== tomorrowStr) return false
    if (currentView === 'weekend'  && ev.date !== satStr && ev.date !== sunStr) return false
    if (currentView === 'pick') {
      if (!fromDate) return false
      const evDate = new Date(ev.date + 'T12:00:00')
      const end = new Date(toDate || fromDate); end.setHours(23, 59, 59, 999)
      if (evDate < fromDate || evDate > end) return false
    }
    if (catFilters.length > 0 && !catFilters.some(f => (ev.cats || []).includes(f))) return false
    if (tagFilters.length > 0 && !tagFilters.every(t =>
      ev.tags?.split(',').map((x: string) => x.trim()).includes(t)
    )) return false
    if (orgFilter && ev.organization !== orgFilter) return false
    if (!aiFilters && search &&
      !ev.title?.toLowerCase().includes(search.toLowerCase()) &&
      !ev.location?.toLowerCase().includes(search.toLowerCase()) &&
      !ev.description?.toLowerCase().includes(search.toLowerCase())
    ) return false
 
    if (aiFilters && aiFilters.keyword) {
      const kw = aiFilters.keyword.toLowerCase()
      const musicTerms = ['music', 'musical', 'concert', 'band', 'jazz', 'folk', 'rock', 'acoustic', 'singer', 'song', 'perform', 'ensemble', 'orchestra', 'symphony', 'choir', 'violin', 'guitar', 'flute', 'rhythm', 'melody', 'tune', 'gong', 'drum']
      const isMusicRelated = musicTerms.some(term => kw.includes(term) || term.includes(kw))
      const searchTerms = isMusicRelated ? musicTerms : [kw]
      const haystack = `${ev.title} ${ev.description} ${ev.location}`.toLowerCase()
      if (!searchTerms.some(term => haystack.includes(term))) return false
    }
 
    return true
  })
 
  const grouped: Record<string, any[]> = {}
  filtered.forEach(ev => {
    if (!grouped[ev.date]) grouped[ev.date] = []
    grouped[ev.date].push(ev)
  })
  const sortedDates = Object.keys(grouped).sort()
 
  async function handleSearch() {
    if (!search.trim()) { setAiFilters(null); return }
    setIsSearching(true)
    try {
      const res = await fetch('/api/conversational-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: search }),
      })
      const filters = await res.json()
      setAiFilters(filters)
      if (filters.cats?.length > 0) setCatFilters(filters.cats)
      if (filters.tags?.length > 0) setTagFilters(filters.tags)
      if (filters.dateFrom) {
        const isToday    = filters.dateFrom === todayStr    && (!filters.dateTo || filters.dateTo === todayStr)
        const isTomorrow = filters.dateFrom === tomorrowStr && (!filters.dateTo || filters.dateTo === tomorrowStr)
        const isWeekend  = filters.dateFrom === satStr      && filters.dateTo === sunStr
        if (isToday)         setCurrentView('today')
        else if (isTomorrow) setCurrentView('tomorrow')
        else if (isWeekend)  setCurrentView('weekend')
        else {
          setCurrentView('pick')
          setFromDate(new Date(filters.dateFrom + 'T12:00:00'))
          setToDate(filters.dateTo ? new Date(filters.dateTo + 'T12:00:00') : null)
        }
      }
      if (filters.keyword) setSearch(filters.keyword)
    } catch (e) { console.error(e) }
    setIsSearching(false)
  }
 
  function clearSearch() {
    setSearch(''); setAiFilters(null); setCatFilters([]); setTagFilters([])
    setCurrentView('today'); setFromDate(null); setToDate(null)
  }
 
  function toggleCat(key: string) {
    setCatFilters(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
 
  function toggleTag(key: string) {
    setTagFilters(prev => prev.includes(key) ? prev.filter(t => t !== key) : [...prev, key])
  }
 
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#1a3d2b', fontSize: '18px' }}>
      Loading Townstir…
    </div>
  )
 
  const shortcuts = [
    { label: `Today · ${todayLabel}`,                   value: 'today' },
    { label: `Tomorrow · ${tomorrowLabel}`,             value: 'tomorrow' },
    { label: `This Weekend · ${satLabel}–${sunLabel}`,  value: 'weekend', shortLabel: 'This Weekend' },
    { label: 'All Dates',                               value: 'all' },
    { label: 'Custom Dates',                            value: 'pick' },
  ]
 
  return (
    <div style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", minHeight: '100vh', background: '#f2f3f5' }}>
 
      {/* Nav */}
      <Header
        rightSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a href="/org/login" style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', textDecoration: 'none' }}>
              Org Login
            </a>
            <button onClick={() => router.push('/post-event')}
              style={{ background: '#C9952A', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              + Post Event
            </button>
          </div>
        }
      />
 
      {/* Hero */}
      <div style={{ background: '#f2f3f5', padding: '20px 20px 18px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', fontWeight: 400, color: '#1a2530', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          What's happening in
          <span style={{ border: '1.5px solid #c8d0d8', borderRadius: '10px', padding: '4px 16px', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '28px', color: '#1a3d2b', background: '#fff', display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
            Mill Valley
            <span style={{ fontSize: '13px', color: '#888', fontStyle: 'normal' }}>&#8964;</span>
          </span>
        </div>
 
        {/* Search */}
        <div style={{ maxWidth: '540px', margin: '0 auto 18px', background: '#fff', border: '1px solid #d0d6db', borderRadius: '999px', display: 'flex', alignItems: 'center', padding: '6px 6px 6px 22px' }}>
          <input
            type="text"
            placeholder="Find an event…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#333', background: 'transparent', fontFamily: 'inherit' }}
          />
          {aiFilters && (
            <button onClick={clearSearch} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', padding: '0 8px', cursor: 'pointer', lineHeight: 1 }}>×</button>
          )}
          {hasSpeech && (
            <button
              onClick={() => {
                const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
                const r = new SR(); r.lang = 'en-US'
                r.onresult = (e: any) => {
                  setSearch(e.results[0][0].transcript)
                  setTimeout(handleSearch, 100)
                }
                r.start()
              }}
              style={{ background: 'none', border: 'none', padding: '0 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" height="18" viewBox="0 0 24 24" width="18" fill="#9ca3af">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
            </button>
          )}
          <button
            onClick={handleSearch}
            style={{ background: '#C9952A', color: '#fff', border: 'none', borderRadius: '999px', padding: '10px 26px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit', opacity: isSearching ? 0.7 : 1 }}>
            {isSearching ? '…' : 'Search'}
          </button>
        </div>
 
        {/* Date shortcuts */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {shortcuts.map(({ label, value, shortLabel }) => (
            <button key={value} onClick={() => setCurrentView(value)}
              style={{
                border: `1.5px solid ${currentView === value ? '#1a3d2b' : '#d0d6db'}`,
                background: currentView === value ? '#1a3d2b' : '#fff',
                color: currentView === value ? '#fff' : '#444',
                borderRadius: '8px', padding: '7px 14px', fontSize: '13px',
                fontWeight: currentView === value ? 600 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}>
              <span className="date-label-full">{label}</span>
              <span className="date-label-short">{shortLabel || label}</span>
            </button>
          ))}
        </div>
      </div>
 
      {/* Custom date picker */}
      {currentView === 'pick' && (
        <div style={{ background: '#fff', borderBottom: '1px solid #e8eaed', padding: '12px 40px', display: 'flex', justifyContent: 'center' }}>
          <DatePicker
            selected={fromDate}
            onChange={(dates) => { const [s, e] = dates as [Date | null, Date | null]; setFromDate(s); setToDate(e) }}
            startDate={fromDate} endDate={toDate}
            selectsRange inline className="date-picker-input"
          />
        </div>
      )}
 
      {/* Desktop filters */}
      <div className="desktop-filters">
        <div style={{ background: '#f2f3f5', padding: '10px 20px 8px', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => setCatFilters([])}
            style={{ border: `1.5px solid ${catFilters.length === 0 ? '#1a3d2b' : '#d0d6db'}`, background: catFilters.length === 0 ? '#1a3d2b' : '#fff', color: catFilters.length === 0 ? '#fff' : '#444', borderRadius: '8px', padding: '5px 14px', fontSize: '13px', fontWeight: catFilters.length === 0 ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            All
          </button>
          {Object.entries(CATS).map(([key, cat]) => {
            const active = catFilters.includes(key)
            return (
              <button key={key} onClick={() => toggleCat(key)}
                style={{ border: `1.5px solid ${active ? '#1a3d2b' : '#d0d6db'}`, background: active ? '#1a3d2b' : '#fff', color: active ? '#fff' : '#444', borderRadius: '8px', padding: '5px 14px', fontSize: '13px', fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                {cat.label}
              </button>
            )
          })}
        </div>
        <div style={{ margin: '0 20px', borderTop: '1px solid #e8eaed' }} />
        <div style={{ background: '#f2f3f5', padding: '8px 20px 14px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          {Object.entries(TAG_CARD).map(([key, tag]) => {
            const active = tagFilters.includes(key)
            return (
              <button key={key} onClick={() => toggleTag(key)}
                style={{ border: `1px solid ${active ? '#1a3d2b' : '#e8eaed'}`, background: active ? '#1a3d2b' : '#fff', color: active ? '#fff' : '#666', borderRadius: '999px', padding: '4px 14px', fontSize: '12px', fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                {tag.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Mobile filters */}
      <div className="mobile-filters">
        <div style={{ background: '#f2f3f5', padding: '6px 20px 4px', display: 'flex', justifyContent: 'center' }}>
          <button onClick={() => setShowFilterDrawer(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: (catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)) > 0 ? '#1a3d2b' : '#fff', border: `1px solid ${(catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)) > 0 ? '#1a3d2b' : '#d0d6db'}`, borderRadius: '999px', padding: '7px 18px', cursor: 'pointer', fontFamily: 'inherit' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={(catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)) > 0 ? '#fff' : '#555'} strokeWidth="2" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            <span style={{ fontSize: '13px', fontWeight: 500, color: (catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)) > 0 ? '#fff' : '#444' }}>
              {(catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)) > 0 ? `Filters · ${catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)}` : 'Filters'}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showFilterDrawer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200 }}>
          <div onClick={() => setShowFilterDrawer(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '16px 16px 0 0', padding: '0 0 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: '36px', height: '4px', background: '#e0e0e0', borderRadius: '999px' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 14px' }}>
              <span style={{ fontSize: '15px', fontWeight: 500, color: '#1a1a1a' }}>
                {(catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)) > 0 ? `Filters · ${catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)}` : 'Filters'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {(catFilters.length + tagFilters.length + (orgFilter ? 1 : 0)) > 0 && (
                  <button onClick={() => { setCatFilters([]); setTagFilters([]); setOrgFilter('') }}
                    style={{ background: 'none', border: 'none', fontSize: '13px', color: '#3a7d44', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Clear all
                  </button>
                )}
                <button onClick={() => setShowFilterDrawer(false)}
                  style={{ background: '#1a3d2b', color: '#fff', border: 'none', borderRadius: '999px', padding: '7px 20px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Done
                </button>
              </div>
            </div>
            <div style={{ height: '1px', background: '#e5e7eb', margin: '0 20px 16px' }} />

            {/* Category */}
            <div style={{ padding: '0 20px 16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 10px' }}>Category</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(CATS).map(([key, cat]) => {
                  const active = catFilters.includes(key)
                  return (
                    <button key={key} onClick={() => toggleCat(key)}
                      style={{ border: `1.5px solid ${active ? '#1a3d2b' : '#d0d6db'}`, background: active ? '#1a3d2b' : '#fff', color: active ? '#fff' : '#444', borderRadius: '8px', padding: '6px 14px', fontSize: '13px', fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                      {cat.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ height: '1px', background: '#e5e7eb', margin: '0 20px 16px' }} />

            {/* Tag */}
            <div style={{ padding: '0 20px 16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 10px' }}>Tag</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(TAG_CARD).map(([key, tag]) => {
                  const active = tagFilters.includes(key)
                  return (
                    <button key={key} onClick={() => toggleTag(key)}
                      style={{ border: `1px solid ${active ? '#1a3d2b' : '#e8eaed'}`, background: active ? '#1a3d2b' : '#fff', color: active ? '#fff' : '#666', borderRadius: '999px', padding: '6px 16px', fontSize: '13px', fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                      {tag.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ height: '1px', background: '#e5e7eb', margin: '0 20px 16px' }} />

            {/* Organization */}
            {orgList.length > 0 && (
              <div style={{ padding: '0 20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 10px' }}>Organization</p>
                <select
                  value={orgFilter}
                  onChange={e => setOrgFilter(e.target.value)}
                  style={{ width: '100%', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', border: `1.5px solid ${orgFilter ? '#1a3d2b' : '#d0d6db'}`, color: '#444', background: '#fff' }}>
                  <option value=''>All Organizations</option>
                  {orgList.map(org => (
                    <option key={org} value={org}>{org}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
 
      {/* Events list */}
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '4px 16px 40px' }}>

        {/* Org dropdown — desktop only */}
        {orgList.length > 0 && (
          <div className="org-dropdown" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-34px', position: 'relative', zIndex: 1 }}>
            <select
              value={orgFilter}
              onChange={e => setOrgFilter(e.target.value)}
              style={{ borderRadius: '8px', padding: '5px 14px', fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer', outline: 'none', border: `1.5px solid ${orgFilter ? '#1a3d2b' : '#d0d6db'}`, color: '#444', background: '#fff' }}>
              <option value=''>All Organizations</option>
              {orgList.map(org => (
                <option key={org} value={org}>{org}</option>
              ))}
            </select>
          </div>
        )}

        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <p style={{ fontSize: '15px' }}>No events found. Try a different filter or search.</p>
          </div>
        ) : (
          sortedDates.map(dateStr => (
            <div key={dateStr}>
              {/* Day header — hidden on mobile */}
              <div className="day-header" style={{ fontSize: '11px', fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.7px', padding: '16px 4px 7px', borderBottom: '1px solid #ddd', marginBottom: '6px' }}>
                {formatDayHeader(dateStr)}
              </div>
              {grouped[dateStr].map(ev => {
                const catKeys: string[] = ev.cats || (ev.category ? ev.category.split(',').map((c: string) => c.trim()) : [])
                const tagKeys: string[] = ev.tags ? ev.tags.split(',').map((t: string) => t.trim()).filter((t: string) => !catKeys.includes(t)) : []
                const desc = ev.description?.trim()
                return (
                  <div key={ev.id}
                    onClick={() => router.push(`/event/${ev.id}`)}
                    className="event-card-outer"
                    style={{ background: '#fff', borderRadius: '10px', padding: '11px 14px', marginBottom: '6px', display: 'flex', alignItems: 'flex-start', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', cursor: 'pointer' }}
                    onMouseOver={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.11)')}
                    onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.07)')}>

                    {/* Date top row — mobile only */}
                    <div className="event-card-date-top" style={{ display: 'none', alignItems: 'baseline', gap: '4px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 500, color: '#2a7a55', lineHeight: 1 }}>
                        {new Date(dateStr + 'T12:00:00').getDate()}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span style={{ color: '#ccc', fontSize: '10px' }}>·</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#2C3E50' }}>{ev.time}</span>
                    </div>

                    {/* Date col — desktop only */}
                    <div className="event-card-date-col" style={{ minWidth: '50px', textAlign: 'center', flexShrink: 0, paddingRight: '14px', borderRight: '1px solid #eee', paddingTop: '1px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                      <div style={{ fontSize: '22px', fontWeight: 500, color: '#2a7a55', lineHeight: 1.1, marginBottom: '3px' }}>
                        {new Date(dateStr + 'T12:00:00').getDate()}
                      </div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#2C3E50', whiteSpace: 'nowrap' }}>
  {ev.time}
</div>
                    </div>

                    {/* Body */}
                    <div className="event-card-body" style={{ flex: 1, minWidth: 0, padding: '0 14px' }}>
                      <div style={{ fontSize: '15px', fontWeight: 500, color: '#1a2530', marginBottom: '2px' }}>
                        {ev.title}
                        {ev.verified && (
                          <span style={{ marginLeft: '6px', background: '#1a3d2b', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px', verticalAlign: 'middle' }}>✓ Verified</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', marginBottom: '4px' }}>
  {ev.is_aggregator ? (
    <span style={{ color: '#9ca3af' }}>
      {ev.extracted_organizer && (
        <>
          <span style={{ color: '#3a7d44' }}>{ev.extracted_organizer}</span>
          <span style={{ color: '#ccc', margin: '0 4px' }}>·</span>
        </>
      )}
      via {ev.organization}
    </span>
  ) : (
    <a href={`/org/${encodeURIComponent(ev.organization.toLowerCase().replace(/ /g, '-'))}`}
      style={{ color: '#3a7d44', textDecoration: 'none' }}
      onClick={e => e.stopPropagation()}>
      {ev.organization}
    </a>
  )}
</div>
                      {desc && (
                        <div style={{ fontSize: '12px', color: '#767e8a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {desc}
                        </div>
                      )}
                      {/* Pills — mobile only, below description */}
                      <div className="event-card-pills-mobile" style={{ display: 'none', flexDirection: 'row', gap: '4px', marginTop: '6px', overflow: 'hidden' }}>
                        {[...catKeys, ...tagKeys].map((key: string) => {
                          const catStyle = CAT_CARD[key]
                          const catLabel = CAT_LABELS[key]
                          const tagMeta = TAG_CARD[key]
                          if (catStyle && catLabel) return (
                            <span key={key} style={{ background: catStyle.bg, color: catStyle.color, fontSize: '10px', borderRadius: '5px', padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {catLabel}
                            </span>
                          )
                          if (tagMeta) return (
                            <span key={key} style={{ background: tagMeta.bg, color: tagMeta.color, fontSize: '10px', borderRadius: '999px', padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {tagMeta.label}
                            </span>
                          )
                          return null
                        })}
                      </div>
                    </div>

                    {/* Pills — desktop only, right column */}
                    <div className="event-card-pills" style={{ flexShrink: 0, paddingLeft: '12px', borderLeft: '1px solid #eee', display: 'flex', flexDirection: 'row', gap: '6px', alignItems: 'flex-start' }}>
                      {catKeys.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {catKeys.map((c: string) => {
                            const s = CAT_CARD[c]
                            const lbl = CAT_LABELS[c]
                            if (!s || !lbl) return null
                            return (
                              <span key={c} style={{ background: s.bg, color: s.color, fontSize: '11px', borderRadius: '5px', padding: '3px 8px', whiteSpace: 'nowrap', display: 'inline-block', width: '82px', textAlign: 'center' }}>
                                {lbl}
                              </span>
                            )
                          })}
                        </div>
                      )}
                      {tagKeys.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '90px' }}>
                          {tagKeys.map((t: string) => {
                            const meta = TAG_CARD[t]
                            if (!meta) return null
                            return (
                              <span key={t} style={{ background: meta.bg, color: meta.color, fontSize: '11px', borderRadius: '999px', padding: '3px 8px', whiteSpace: 'nowrap', display: 'inline-block', width: '88px', textAlign: 'center' }}>
                                {meta.label}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}