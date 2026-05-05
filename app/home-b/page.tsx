'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'
import { colors, fonts } from '../lib/tokens'

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

const TOWNS = [
  { value: 'mill-valley', label: 'Mill Valley', live: true },
  { value: 'fairfax', label: 'Fairfax — coming soon', live: false },
  { value: 'san-anselmo', label: 'San Anselmo — coming soon', live: false },
]

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

function buildFeatured(data: any[]): any[] {
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

  // Enforce category diversity — max one event per category
  const usedEventCats = new Set<string>()
  const diverse: any[] = []
  for (const ev of [...withImages, ...withStock]) {
    const cat = getFirstCat(ev)
    if (!usedEventCats.has(cat)) {
      usedEventCats.add(cat)
      diverse.push(ev)
    }
    if (diverse.length === 4) break
  }
  const allCats = Object.keys(CATEGORY_IMAGES)
  const result = diverse
  for (const ev of result) {
    if (!ev.fallbackImage) {
      const unusedCat = allCats.find(c => !usedStockCats.has(c)) || allCats[0]
      usedStockCats.add(unusedCat)
      ev.fallbackImage = CATEGORY_IMAGES[unusedCat]
    }
  }

  return result
}

export default function HomeBPage() {
  const router = useRouter()
  const [featuredEvents, setFeaturedEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [townOpen, setTownOpen] = useState(false)

  useEffect(() => { loadFeaturedEvents() }, [])

  async function loadFeaturedEvents() {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('events')
      .select('id, title, date, time, organization, category, image_url')
      .eq('status', 'approved')
      .or('town.ilike.mill valley,town.ilike.mill-valley')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(40)

    if (data) {
      // Check image dimensions — swap landscape-unfriendly images to portrait stock
      const checked = await Promise.all(data.map(ev => {
        if (!ev.image_url) return Promise.resolve(ev)
        return new Promise<any>(resolve => {
          const img = new window.Image()
          img.onload = () => {
            // For portrait cards, landscape images that are very wide look bad
            // Keep images that are roughly square or portrait (height >= width * 0.6)
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
      setFeaturedEvents(buildFeatured(checked))
    }
    setLoading(false)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(search.trim() ? `/?search=${encodeURIComponent(search.trim())}` : '/')
  }

  function getCardImage(ev: any): string {
    if (ev.image_url) return ev.image_url
    const cat = getFirstCat(ev)
    return CATEGORY_IMAGES[cat] || CATEGORY_IMAGES.community
  }

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
          <button onClick={() => router.push('/org/login')}
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', padding: '7px 18px', borderRadius: '999px', fontSize: '13px', cursor: 'pointer', fontFamily: fonts.sans }}>
            Log in
          </button>
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
            <button type="submit"
              style={{ background: colors.primary, color: '#fff', border: 'none', padding: '14px 26px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', borderRadius: '0 999px 999px 0', fontFamily: fonts.sans, whiteSpace: 'nowrap' }}>
              Search
            </button>
          </form>
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: colors.logoAccent, display: 'inline-block' }} />
            Mill Valley, CA &nbsp;·&nbsp;
            <span onClick={() => router.push('/')} style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}>change</span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 24px 0' }}>
        <button onClick={() => router.push('/')}
          style={{ background: colors.navBg, color: '#fff', border: 'none', padding: '13px 40px', borderRadius: '999px', fontSize: '15px', fontWeight: 500, cursor: 'pointer', fontFamily: fonts.sans }}>
          Go to Mill Valley calendar →
        </button>
      </div>

      {/* Events section */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px 60px' }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '22px', fontWeight: 500, color: colors.textPrimary }}>Things to do in</span>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <span onClick={() => setTownOpen(!townOpen)}
              style={{ fontSize: '22px', fontWeight: 500, color: colors.navBg, borderBottom: `2px solid ${colors.navBg}`, paddingBottom: '2px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Mill Valley <span style={{ fontSize: '14px' }}>⌄</span>
            </span>
            {townOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: '#fff', border: `1px solid ${colors.borderLight}`, borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '220px', overflow: 'hidden' }}>
                {TOWNS.map(t => (
                  <div key={t.value}
                    onClick={() => t.live && setTownOpen(false)}
                    style={{ padding: '11px 16px', fontSize: '14px', fontWeight: t.live ? 500 : 400, color: t.live ? colors.textPrimary : colors.textSecondary, cursor: t.live ? 'pointer' : 'default', borderBottom: `1px solid ${colors.borderLight}` }}>
                    {t.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Portrait card grid */}
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
          <button onClick={() => router.push('/')}
            style={{ background: 'none', border: `1px solid ${colors.borderLight}`, color: colors.textSecondary, padding: '11px 36px', borderRadius: '999px', fontSize: '14px', cursor: 'pointer', fontFamily: fonts.sans }}>
            See all Mill Valley events →
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