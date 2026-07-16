'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from './supabase'
import { colors, fonts } from './lib/tokens'

const SUPABASE_ASSETS = 'https://uacthqlmxhslqzddfxwt.supabase.co/storage/v1/object/public/site-assets'
const HERO_IMAGE = `${SUPABASE_ASSETS}/aranxa-esteve-pOXHU0UEDcg-unsplash.jpg`

const CATEGORY_IMAGES: Record<string, string> = {
  outdoors:  `${SUPABASE_ASSETS}/category-outdoors-portrait.jpg`,
  arts:      `${SUPABASE_ASSETS}/category-arts-portrait.jpg`,
  food:      `${SUPABASE_ASSETS}/category-food-portrait.jpg`,
  community: `${SUPABASE_ASSETS}/category-community-portrait.jpg`,
  classes:   `${SUPABASE_ASSETS}/category-classes-portrait.jpg`,
  gov:       `${SUPABASE_ASSETS}/category-gov-portrait.jpg`,
  family:    `${SUPABASE_ASSETS}/category-family-portrait-2.jpg`,
  youth:     `${SUPABASE_ASSETS}/category-family-portrait-2.jpg`,
}

const CAT_PRIORITY = ['arts', 'outdoors', 'food', 'family', 'youth', 'community', 'classes', 'gov']

const DEFAULT_TOWN = 'mill-valley'
const DEFAULT_TOWN_NAME = 'Mill Valley'

// The county this aggregate covers. If Townstir ever expands beyond Marin,
// this would need to become per-town rather than a single constant.
const AGGREGATE_COUNTY = 'Marin'

function formatEventDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
}

function getFirstCat(ev: any): string {
  return ev.category ? ev.category.split(',')[0].trim() : 'community'
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + 'T12:00:00').getDay()
  return day === 0 || day === 6
}

function buildFeatured(data: any[], townSlug: string): any[] {
  const withImages = data.filter(e => e.image_url)
  const usedStockCats = new Set<string>()
  const withStock: any[] = []

  const noImage = data
    .filter(e => !e.image_url)
    .sort((a, b) => {
      const aWeekend = isWeekend(a.date) ? 0 : 1
      const bWeekend = isWeekend(b.date) ? 0 : 1
      if (aWeekend !== bWeekend) return aWeekend - bWeekend
      const aCat = getFirstCat(a)
      const bCat = getFirstCat(b)
      const aPri = CAT_PRIORITY.indexOf(aCat) === -1 ? 99 : CAT_PRIORITY.indexOf(aCat)
      const bPri = CAT_PRIORITY.indexOf(bCat) === -1 ? 99 : CAT_PRIORITY.indexOf(bCat)
      return aPri - bPri
    })

  for (const ev of noImage) {
    const cat = getFirstCat(ev)
    if (!usedStockCats.has(cat)) {
      usedStockCats.add(cat)
      withStock.push({ ...ev, fallbackImage: CATEGORY_IMAGES[cat] })
    }
  }

  const allCandidates = [...withImages, ...withStock]
  const usedEventCats = new Set<string>()
  const diverse: any[] = []

  // First pass — prefer one event per category for visual diversity
  for (const ev of allCandidates) {
    const cat = getFirstCat(ev)
    if (!usedEventCats.has(cat)) {
      usedEventCats.add(cat)
      diverse.push(ev)
    }
    if (diverse.length === 4) break
  }

  // Second pass — if fewer than 4 events (e.g. new towns), fill remaining slots
  // allowing repeat categories rather than showing an incomplete grid
  if (diverse.length < 4) {
    const usedIds = new Set(diverse.map(e => e.id))
    for (const ev of allCandidates) {
      if (!usedIds.has(ev.id)) {
        diverse.push(ev)
        usedIds.add(ev.id)
      }
      if (diverse.length === 4) break
    }
  }

  const result = diverse

  // If no real images at all, rotate stock images by town slug
  // so different towns show a different image arrangement
  const hasRealImages = result.some(e => e.image_url)
  const seed = townSlug.length % CAT_PRIORITY.length
  const rotatedCats = [...CAT_PRIORITY.slice(seed), ...CAT_PRIORITY.slice(0, seed)]

  const allCats = Object.keys(CATEGORY_IMAGES)
  for (let i = 0; i < result.length; i++) {
    const ev = result[i]
    if (!ev.fallbackImage) {
      const unusedCat = allCats.find(c => !usedStockCats.has(c)) || allCats[0]
      usedStockCats.add(unusedCat)
      ev.fallbackImage = CATEGORY_IMAGES[unusedCat]
    }
    if (!hasRealImages) {
      ev.fallbackImage = CATEGORY_IMAGES[rotatedCats[i % rotatedCats.length]] || CATEGORY_IMAGES.community
    }
  }

  return result
}

export default function HomeBPage() {
  const router = useRouter()
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [heroDropdownOpen, setHeroDropdownOpen] = useState(false)
  const [sectionDropdownOpen, setSectionDropdownOpen] = useState(false)
  const [towns, setTowns] = useState<{ slug: string; name: string }[]>([])
  // Every Marin town on file, active or not — used only to build the
  // aggregate query, never shown as its own switcher option.
  const [aggregateTownNames, setAggregateTownNames] = useState<string[]>([])
  const [selectedTown, setSelectedTown] = useState<{ slug: string; name: string }>({
    slug: DEFAULT_TOWN,
    name: DEFAULT_TOWN_NAME,
  })
  const heroRef = useRef<HTMLDivElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadTowns()
    loadAggregateTownNames()
  }, [])

  useEffect(() => {
    loadFeaturedEvents(selectedTown)
  }, [selectedTown])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (heroRef.current && !heroRef.current.contains(e.target as Node)) {
        setHeroDropdownOpen(false)
      }
      if (sectionRef.current && !sectionRef.current.contains(e.target as Node)) {
        setSectionDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadTowns() {
    const { data } = await supabase
      .from('towns')
      .select('slug, name')
      .eq('active', true)
      .order('name')
    const activeTowns = data || []
    // Marin is a synthetic aggregate entry, always available regardless of
    // which individual towns are active.
    setTowns([{ slug: 'marin', name: 'Marin' }, ...activeTowns])
  }

  async function loadAggregateTownNames() {
    // Deliberately no `active` filter — the aggregate should include events
    // from towns not yet ready for their own page.
    const { data } = await supabase
      .from('towns')
      .select('name')
      .eq('county', AGGREGATE_COUNTY)
    setAggregateTownNames((data || []).map((t: any) => t.name))
  }

  async function loadFeaturedEvents(town: { slug: string; name: string }) {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]

    let query = supabase
      .from('events')
      .select('id, title, date, time, organization, category, image_url')
      .eq('status', 'approved')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(40)

    if (town.slug === 'marin') {
      if (aggregateTownNames.length === 0) {
        setFeaturedEvents([])
        setLoading(false)
        return
      }
      const orParts = aggregateTownNames.map(name => `town.ilike.${name}`).join(',')
      query = query.or(orParts)
    } else {
      query = query.or(`town.ilike.${town.name},town.ilike.${town.slug}`)
    }

    const { data } = await query

    if (data) {
      const checked = await Promise.all(data.map(ev => {
        if (!ev.image_url) return Promise.resolve(ev)
        return new Promise<any>(resolve => {
          const img = new window.Image()
          img.onload = () => {
            if (img.naturalWidth < 400 || img.naturalHeight < 400 || img.naturalWidth > img.naturalHeight * 2) {
              resolve({ ...ev, image_url: null })
            } else {
              resolve(ev)
            }
          }
          img.onerror = () => resolve({ ...ev, image_url: null })
          img.src = ev.image_url
        })
      }))
      setFeaturedEvents(buildFeatured(checked, town.slug))
    }
    setLoading(false)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const q = search.trim()
    if (!q) { router.push(`/${selectedTown.slug}`); return }

    setSearching(true)
    try {
      const res = await fetch('/api/conversational-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const filters = await res.json()

      const params = new URLSearchParams()
      if (filters.cats?.length > 0) params.set('cats', filters.cats.join(','))
      if (filters.tags?.length > 0) params.set('tags', filters.tags.join(','))
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.keyword) params.set('keyword', filters.keyword)
      params.set('search', filters.keyword || q)

      router.push(`/${selectedTown.slug}?${params.toString()}`)
    } catch {
      router.push(`/${selectedTown.slug}?search=${encodeURIComponent(q)}`)
    } finally {
      setSearching(false)
    }
  }

  function getCardImage(ev: any): string {
    if (ev.image_url) return ev.image_url
    if (ev.fallbackImage) return ev.fallbackImage
    const cat = getFirstCat(ev)
    return CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.community
  }

  function selectTown(t: { slug: string; name: string }) {
    setSelectedTown(t)
    setHeroDropdownOpen(false)
    setSectionDropdownOpen(false)
  }

  const dropdownMenu = (onSelect: () => void) => (
    <div style={{
      position: 'absolute', top: '100%', left: 0, marginTop: '8px',
      background: '#fff', borderRadius: '12px',
      boxShadow: '0 8px 30px rgba(0,0,0,0.15)', zIndex: 200,
      minWidth: '200px', overflow: 'hidden',
      border: '1px solid rgba(0,0,0,0.08)'
    }}>
      {towns.map((t, i) => (
        <div key={t.slug}
          onClick={() => { selectTown(t); onSelect() }}
          style={{
            padding: '12px 18px', fontSize: '14px', fontWeight: 500,
            color: t.slug === selectedTown.slug ? colors.navBg : '#374151',
            cursor: 'pointer',
            borderBottom: i < towns.length - 1 ? '1px solid #f3f4f6' : 'none',
            background: 'white',
            display: 'flex', alignItems: 'center', gap: '8px'
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
          onMouseOut={e => (e.currentTarget.style.background = 'white')}
        >
          {t.slug === selectedTown.slug && (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: colors.navBg, flexShrink: 0, display: 'inline-block' }} />
          )}
          {t.slug !== selectedTown.slug && (
            <span style={{ width: '6px', height: '6px', flexShrink: 0, display: 'inline-block' }} />
          )}
          {t.name}
        </div>
      ))}
    </div>
  )

  return (
    <div style={{ fontFamily: fonts.sans, minHeight: '100vh', background: colors.pageBg }}>

      {/* Hero */}
      <div style={{ position: 'relative', height: 'clamp(280px, 48vh, 580px)', overflow: 'hidden' }}>
        <img src={HERO_IMAGE} alt="Community events"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.6) 100%)' }} />

        {/* Nav */}
        <div style={{ position: 'relative', zIndex: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontSize: '22px', fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' }}>town</span>
            <span style={{ fontSize: '22px', fontWeight: 400, color: colors.logoAccent, fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>stir</span>
          </div>
        </div>

        {/* Hero content */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px', paddingTop: '56px' }}>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 500, color: '#fff', lineHeight: 1.15, marginBottom: '24px' }}>
            What's happening near you
          </h1>
          <form onSubmit={handleSearch} style={{ display: 'flex', background: '#fff', borderRadius: '999px', overflow: 'hidden', width: '100%', maxWidth: '500px', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
            <input type="text" placeholder="Search events, venues or towns…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, border: 'none', outline: 'none', padding: '14px 22px', fontSize: '15px', color: '#1a2530', background: 'transparent', fontFamily: fonts.sans }} />
            <button type="submit" disabled={searching}
              style={{ background: colors.primary, color: '#fff', border: 'none', padding: '14px 26px', fontSize: '14px', fontWeight: 500, cursor: searching ? 'not-allowed' : 'pointer', borderRadius: '0 999px 999px 0', fontFamily: fonts.sans, whiteSpace: 'nowrap', opacity: searching ? 0.7 : 1 }}>
              {searching ? '…' : 'Search'}
            </button>
          </form>
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.logoAccent, display: 'inline-block' }} />
            {selectedTown.name}, CA &nbsp;·&nbsp;
            <div ref={heroRef} style={{ position: 'relative', display: 'inline-block' }}>
              <span onClick={() => setHeroDropdownOpen(!heroDropdownOpen)}
                style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px', color: 'rgba(255,255,255,0.8)' }}>
                change
              </span>
              {heroDropdownOpen && dropdownMenu(() => setHeroDropdownOpen(false))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 24px 0' }}>
        <button onClick={() => router.push(`/${selectedTown.slug}`)}
          style={{ background: colors.navBg, color: '#fff', border: 'none', padding: '13px 40px', borderRadius: '999px', fontSize: '15px', fontWeight: 500, cursor: 'pointer', fontFamily: fonts.sans }}>
          Browse all {selectedTown.name} events →
        </button>
      </div>

      {/* Events section */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px 60px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '22px', fontWeight: 500, color: colors.textPrimary }}>Featured events in</span>
          <div ref={sectionRef} style={{ position: 'relative', display: 'inline-block' }}>
            <span onClick={() => setSectionDropdownOpen(!sectionDropdownOpen)}
              style={{ fontSize: '22px', fontWeight: 500, color: colors.navBg, borderBottom: `2px solid ${colors.navBg}`, paddingBottom: '2px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              {selectedTown.name} <span style={{ fontSize: '14px' }}>⌄</span>
            </span>
            {sectionDropdownOpen && dropdownMenu(() => setSectionDropdownOpen(false))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>Loading…</div>
        ) : (
          <div className="event-grid-b" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {featuredEvents.map(ev => (
              <div key={ev.id} onClick={() => router.push(`/event/${ev.id}`)}
                style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', border: `0.5px solid ${colors.borderLight}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
                onMouseOver={e => (e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.12)')}
                onMouseOut={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)')}>
                <img
                  src={getCardImage(ev)}
                  alt={ev.title}
                  style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', objectPosition: 'center 20%', display: 'block' }}
                />
                <div style={{ padding: '12px 14px 16px' }}>
                  <div style={{ fontSize: '11px', color: colors.navBg, fontWeight: 500, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {formatEventDate(ev.date)} · {ev.time}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: colors.textPrimary, lineHeight: 1.35, marginBottom: '4px' }}>
                    {ev.title}
                  </div>
                  <div style={{ fontSize: '12px', color: colors.textSecondary }}>{ev.organization}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '28px' }}>
          <button onClick={() => router.push(`/${selectedTown.slug}`)}
            style={{ background: 'none', border: `1px solid ${colors.borderLight}`, color: colors.textSecondary, padding: '11px 36px', borderRadius: '999px', fontSize: '14px', cursor: 'pointer', fontFamily: fonts.sans }}>
            See all {selectedTown.name} events →
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) { .event-grid-b { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 420px) { .event-grid-b { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>
    </div>
  )
}

