'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'
import Header from '../components/Header'
import { colors, fonts, radii, styles, BOARD_CATEGORIES, STUDENT_TAG } from '@/app/lib/tokens'

type Opportunity = {
  id: number
  title: string
  description: string
  category: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  organization: string | null
  website: string | null
  is_student_opportunity: boolean
  tags: string | null
  created_at: string
  town: string
}


const FILTER_CATEGORIES = [
  { value: 'all',        label: 'All' },
  { value: 'volunteers', label: 'Volunteers Needed' },
  { value: 'donations',  label: 'Donations Needed' },
  { value: 'icanhelp',   label: 'I Can Help' },
]

function CategoryIcon({ category }: { category: string }) {
  const cat = BOARD_CATEGORIES[category]
  const color = cat?.iconColor || colors.textSecondary
  const bg = cat?.iconBg || colors.pageBg
  return (
    <div style={{ width: '40px', height: '40px', borderRadius: radii.tagPill, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
      {category === 'volunteers' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      )}
      {category === 'donations' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
          <path d="M20 12V22H4V12"/>
          <path d="M22 7H2v5h20V7z"/>
          <path d="M12 22V7"/>
          <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/>
          <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
        </svg>
      )}
      {category === 'icanhelp' && (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
          <line x1="6" y1="1" x2="6" y2="4"/>
          <line x1="10" y1="1" x2="10" y2="4"/>
          <line x1="14" y1="1" x2="14" y2="4"/>
        </svg>
      )}
    </div>
  )
}

function isNew(created_at: string) {
  return Date.now() - new Date(created_at).getTime() < 3 * 24 * 60 * 60 * 1000
}

export default function Volunteering() {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [studentOnly, setStudentOnly] = useState(false)
  const [scheduledOnly, setScheduledOnly] = useState(false)

  useEffect(() => { loadOpportunities() }, [])

  async function loadOpportunities() {
    setLoading(true)
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('status', 'approved')
      .eq('town', 'mill-valley')
      .order('created_at', { ascending: false })
    if (!error) setOpportunities(data || [])
    setLoading(false)
  }

  const filtered = opportunities.filter(o => {
    if (activeCategory !== 'all' && o.category !== activeCategory) return false
    if (studentOnly && !o.is_student_opportunity) return false
    if (scheduledOnly && !o.tags?.includes('scheduled')) return false
    return true
  })

  return (
    <div style={styles.page}>
      <Header
        rightSlot={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a href="/org/login" style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', textDecoration: 'none' }}>
              Org Login
            </a>
            <button onClick={() => router.push('/post-opportunity')} style={styles.buttonPrimary}>
              + Post Opportunity
            </button>
          </div>
        }
      />

      <div style={styles.container}>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 400, color: colors.textPrimary, margin: 0, fontFamily: fonts.sans }}>
            Volunteering &mdash;{' '}
            <em style={{ fontFamily: fonts.serif, fontStyle: 'italic', color: colors.navBg }}>Mill Valley</em>
          </h1>
          <p style={{ fontSize: '14px', color: colors.textSecondary, marginTop: '6px' }}>
            Volunteer opportunities, donations needed, and neighbors offering help
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginBottom: '8px' }}>
          {FILTER_CATEGORIES.map(cat => (
            <button key={cat.value}
              style={activeCategory === cat.value ? { ...styles.categoryPill, ...styles.pillActive } : styles.categoryPill}
              onClick={() => setActiveCategory(cat.value)}>
              {cat.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px', paddingTop: '8px', borderTop: `1px solid ${colors.divider}` }}>
          <button
            style={studentOnly ? { ...styles.tagPill, ...styles.pillActive } : styles.tagPill}
            onClick={() => setStudentOnly(!studentOnly)}>
            Student Opportunities
          </button>
          <button
            style={scheduledOnly ? { ...styles.tagPill, ...styles.pillActive } : styles.tagPill}
            onClick={() => setScheduledOnly(!scheduledOnly)}>
            Show Up & Help
          </button>
        </div>

        <div style={styles.sectionLabel}>
          {loading ? 'Loading…' : `${filtered.length} opportunit${filtered.length === 1 ? 'y' : 'ies'}`}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>
            <p style={{ marginBottom: '12px' }}>No opportunities found.</p>
            <button onClick={() => router.push('/post-opportunity')} style={styles.buttonPrimary}>Post the first one</button>
          </div>
        ) : filtered.map(opp => {
          const cat = BOARD_CATEGORIES[opp.category]
          return (
            <div key={opp.id}
              onClick={() => router.push(`/volunteering/${opp.id}`)}
              style={{ ...styles.card, display: 'flex', alignItems: 'flex-start', gap: '16px', cursor: 'pointer' }}>

              <CategoryIcon category={opp.category} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '15px', fontWeight: 500, color: colors.textPrimary, marginBottom: '3px' }}>
                  {opp.title}
                  {isNew(opp.created_at) && <span style={styles.newBadge}>New</span>}
                </div>
                <div style={{ fontSize: '13px', color: colors.orgGreen, marginBottom: '5px' }}>
                  {opp.organization || 'Community Member'}
                </div>
                <div style={{ fontSize: '13px', color: colors.textSecondary, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '520px', marginBottom: '8px' }}>
                  {opp.description}
                </div>
                <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                  {opp.contact_name && <span>{opp.contact_name}</span>}
                  {opp.contact_email && <span> &middot; {opp.contact_email}</span>}
                  {opp.contact_phone && <span> &middot; {opp.contact_phone}</span>}
                  <span> &middot; Posted {new Date(opp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end', flexShrink: 0, minWidth: '130px' }}>
                {cat && (
                  <div style={{ background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`, borderRadius: radii.categoryPill, padding: '3px 10px', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {cat.label}
                  </div>
                )}
               {opp.is_student_opportunity && (
                  <div style={{ background: STUDENT_TAG.bg, color: STUDENT_TAG.text, border: `1px solid ${STUDENT_TAG.border}`, borderRadius: radii.tagPill, padding: '3px 10px', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    Student Opp.
                  </div>
                )}
                {opp.tags?.includes('scheduled') && (
                  <div style={{ background: '#f0fdf4', color: colors.navBg, border: `1px solid #bbf7d0`, borderRadius: radii.tagPill, padding: '3px 10px', fontSize: '11px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    Show Up
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
