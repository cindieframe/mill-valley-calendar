'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'
import Header from '../../components/Header'
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
  created_at: string
  town: string
}

export default function OpportunityDetail({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [opp, setOpp] = useState<Opportunity | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => { loadOpportunity() }, [params.id])

  async function loadOpportunity() {
    setLoading(true)
    const { data, error } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', params.id)
      .eq('status', 'approved')
      .single()
    if (error || !data) setNotFound(true)
    else setOpp(data)
    setLoading(false)
  }

  const backButton = (
    <button onClick={() => router.push('/community-board')} style={styles.buttonGhost}>← Back</button>
  )

  if (loading) return (
    <div style={styles.page}>
      <Header rightSlot={backButton} />
      <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary }}>Loading…</div>
    </div>
  )

  if (notFound || !opp) return (
    <div style={styles.page}>
      <Header rightSlot={backButton} />
      <div style={{ textAlign: 'center', padding: '80px', color: colors.textSecondary }}>
        <p style={{ marginBottom: '16px' }}>Opportunity not found.</p>
        <button onClick={() => router.push('/community-board')} style={styles.buttonPrimary}>
          Back to Community Board
        </button>
      </div>
    </div>
  )

  const cat = BOARD_CATEGORIES[opp.category]
  const postedDate = new Date(opp.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  return (
    <div style={styles.page}>
      <Header rightSlot={backButton} />

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* Pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {cat && (
            <span style={{ background: cat.bg, color: cat.text, border: `1px solid ${cat.border}`, borderRadius: radii.categoryPill, padding: '4px 12px', fontSize: '12px', fontWeight: 500 }}>
              {cat.label}
            </span>
          )}
          {opp.is_student_opportunity && (
            <span style={{ background: STUDENT_TAG.bg, color: STUDENT_TAG.text, border: `1px solid ${STUDENT_TAG.border}`, borderRadius: radii.tagPill, padding: '4px 12px', fontSize: '12px', fontWeight: 500 }}>
              Student Opportunities
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: fonts.serif, fontSize: '28px', fontWeight: 700, color: colors.textPrimary, marginBottom: '6px', lineHeight: 1.3 }}>
          {opp.title}
        </h1>

        <div style={{ fontSize: '14px', color: colors.orgGreen, marginBottom: '4px', fontWeight: 500 }}>
          {opp.organization || 'Community Member'}
        </div>
        <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '28px' }}>
          Posted {postedDate}
        </div>

        {/* Description */}
        <div style={{ ...styles.card, marginBottom: '16px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
            About this opportunity
          </h2>
          <p style={{ fontSize: '14px', color: colors.textPrimary, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
            {opp.description}
          </p>
        </div>

        {/* Contact */}
        <div style={{ ...styles.card, marginBottom: '24px' }}>
          <h2 style={{ fontSize: '11px', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '16px' }}>
            Contact
          </h2>
          {opp.contact_name && (
            <div style={{ fontSize: '14px', color: colors.textPrimary, fontWeight: 500, marginBottom: '12px' }}>{opp.contact_name}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {opp.contact_email && (
              <a href={`mailto:${opp.contact_email}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: colors.navBg, textDecoration: 'none', fontWeight: 500 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.navBg} strokeWidth="1.8">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {opp.contact_email}
              </a>
            )}
            {opp.contact_phone && (
              <a href={`tel:${opp.contact_phone}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: colors.navBg, textDecoration: 'none', fontWeight: 500 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.navBg} strokeWidth="1.8">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.38 2 2 0 0 1 3.58 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.73a16 16 0 0 0 6.29 6.29l1.62-1.62a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {opp.contact_phone}
              </a>
            )}
            {opp.website && (
              <a href={opp.website} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: colors.navBg, textDecoration: 'none', fontWeight: 500 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.navBg} strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                {opp.website.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {opp.contact_email && (
            <a href={`mailto:${opp.contact_email}`} style={styles.buttonPrimary}>
              Get in Touch
            </a>
          )}
          <button onClick={() => router.push('/community-board')}
            style={{ background: colors.cardBg, color: colors.navBg, border: `1.5px solid ${colors.navBg}`, padding: '12px 24px', borderRadius: radii.tagPill, fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: fonts.sans }}>
            ← Back to Board
          </button>
        </div>

      </div>
    </div>
  )
}
