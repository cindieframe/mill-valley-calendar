'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Header from '../components/Header'
import ReCAPTCHA from 'react-google-recaptcha'
import { colors, fonts, radii } from '@/app/lib/tokens'

export default function PostOpportunity() {
  const router = useRouter()
  const recaptchaRef = useRef<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    organization: '',
    website: '',
    is_student_opportunity: false,
    tags: [] as string[],
  })

  const update = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const toggleTag = (value: string) =>
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(value)
        ? prev.tags.filter(t => t !== value)
        : [...prev.tags, value],
    }))

  const handleSubmit = async () => {
    if (!form.title || !form.description || !form.category || !form.contact_name || !form.contact_email) {
      alert('Please fill in all required fields.')
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
    const res = await fetch('/api/submit-opportunity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        posted_by_email: form.contact_email,
        is_student_opportunity: form.tags.includes('student') || form.is_student_opportunity,
      }),
    })
    setSubmitting(false)
    if (!res.ok) { alert('Something went wrong. Please try again.'); return }
    setSubmitted(true)
  }

  const categories = [
    { value: 'volunteers', label: 'Volunteers Needed',  ex: 'Skills, time, helping hands' },
    { value: 'donations',  label: 'Donations Needed',   ex: 'Goods, supplies, or funds' },
    { value: 'icanhelp',   label: 'I Can Help',         ex: 'Offering your skills or services to the community' },
  ]

  const inputStyle = {
    width: '100%',
    border: `1.5px solid ${colors.borderLight}`,
    borderRadius: radii.categoryPill,
    padding: '10px 14px',
    fontFamily: fonts.sans,
    fontSize: '13px',
    color: colors.textPrimary,
    outline: 'none',
    background: colors.cardBg,
  }

  const labelStyle = {
    display: 'block' as const,
    fontSize: '11px',
    fontWeight: 700 as const,
    color: '#374151',
    marginBottom: '5px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.8px',
  }

  if (submitted) return (
    <div style={{ minHeight: '100vh', background: colors.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: fonts.sans, padding: '24px' }}>
      <div style={{ background: colors.cardBg, borderRadius: radii.card, padding: '48px 40px', textAlign: 'center', maxWidth: '480px' }}>
        <h2 style={{ fontFamily: fonts.serif, fontSize: '26px', fontWeight: 700, color: colors.textPrimary, marginBottom: '8px' }}>
          Opportunity Received!
        </h2>
        <p style={{ fontSize: '15px', color: colors.textPrimary, marginBottom: '6px', lineHeight: 1.6 }}>
          <strong>{form.title}</strong> has been submitted for review.
        </p>
        <p style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '24px', lineHeight: 1.6 }}>
          Our team will review it within 24 hours. Once approved it will appear on the Mill Valley Volunteering page for 30 days.
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={() => router.push('/volunteering')}
            style={{ background: colors.primary, color: colors.textWhite, border: 'none', padding: '12px 24px', borderRadius: radii.tagPill, fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: fonts.sans }}>
            View Volunteering
          </button>
          <button onClick={() => router.push('/')}
            style={{ background: colors.cardBg, color: colors.navBg, border: `1.5px solid ${colors.navBg}`, padding: '12px 24px', borderRadius: radii.tagPill, fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: fonts.sans }}>
            Back to Calendar
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: colors.pageBg, fontFamily: fonts.sans }}>
      <Header
        rightSlot={
          <a href="/org/login" style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', textDecoration: 'none' }}>
            Org Login
          </a>
        }
      />

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontFamily: fonts.serif, fontSize: '32px', fontWeight: 700, color: colors.textPrimary, marginBottom: '6px', letterSpacing: '-0.5px' }}>
          Post an Opportunity
        </h1>
        <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '32px' }}>
          Reviewed within 24 hours. Listings stay active for 30 days.
        </p>

        {/* Title */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Title *</label>
          <input style={inputStyle} placeholder="e.g. Seamstress needed for Dia de los Muertos costumes"
            value={form.title} onChange={e => update('title', e.target.value)} />
        </div>

        {/* Organization */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>
            Organization{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: colors.textSecondary }}>
              (leave blank if posting as an individual)
            </span>
          </label>
          <input style={inputStyle} placeholder="e.g. Throck Productions"
            value={form.organization} onChange={e => update('organization', e.target.value)} />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>Description *</label>
          <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
            placeholder="Describe the opportunity — what's needed, time commitment, any skills required, how to get involved…"
            value={form.description} onChange={e => update('description', e.target.value)} />
        </div>

        {/* Category */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Category *</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {categories.map(({ value, label, ex }) => {
              const isActive = form.category === value
              return (
                <label key={value}
                  style={{ display: 'block', padding: '11px 14px', borderRadius: radii.categoryPill, border: `1.5px solid ${isActive ? colors.navBg : colors.borderLight}`, background: isActive ? '#f0fdf4' : colors.cardBg, cursor: 'pointer' }}>
                  <input type="radio" name="category" value={value} checked={isActive}
                    onChange={() => update('category', value)} style={{ display: 'none' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? colors.navBg : colors.textPrimary, marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: isActive ? colors.orgGreen : colors.textSecondary }}>{ex}</div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Tags — toggle pills */}
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>Tags</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { value: 'scheduled', label: 'Scheduled',            note: 'Has a specific date and time' },
              { value: 'student',   label: 'Student Opportunities', note: 'Can count toward community service hours' },
            ].map(({ value, label, note }) => {
              const isActive = form.tags.includes(value)
              return (
                <button key={value} type="button" onClick={() => toggleTag(value)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: radii.tagPill,
                    border: `1.5px solid ${isActive ? colors.navBg : colors.borderLight}`,
                    background: isActive ? '#f0fdf4' : colors.cardBg,
                    color: isActive ? colors.navBg : colors.textSecondary,
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 400,
                    cursor: 'pointer',
                    fontFamily: fonts.sans,
                    display: 'flex',
                    flexDirection: 'column' as const,
                    alignItems: 'flex-start',
                    gap: '2px',
                    textAlign: 'left' as const,
                  }}>
                  <span>{label}</span>
                  <span style={{ fontSize: '11px', color: isActive ? colors.orgGreen : colors.textSecondary, fontWeight: 400 }}>{note}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Contact */}
        <div style={{ background: colors.pageBg, borderRadius: radii.card, padding: '20px', marginBottom: '16px', border: `1.5px solid ${colors.borderLight}` }}>
          <label style={{ ...labelStyle, marginBottom: '16px' }}>Contact Information *</label>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Contact Name *</label>
            <input style={inputStyle} placeholder="e.g. Maria Lopez"
              value={form.contact_name} onChange={e => update('contact_name', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" placeholder="you@example.com"
                value={form.contact_email} onChange={e => update('contact_email', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>
                Phone{' '}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: colors.textSecondary }}>(optional)</span>
              </label>
              <input style={inputStyle} type="tel" placeholder="(415) 555-0100"
                value={form.contact_phone} onChange={e => update('contact_phone', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Website */}
        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>
            Website{' '}
            <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: colors.textSecondary }}>(optional)</span>
          </label>
          <input style={inputStyle} type="url" placeholder="https://…"
            value={form.website} onChange={e => update('website', e.target.value)} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <ReCAPTCHA ref={recaptchaRef} sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ''} />
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          style={{ width: '100%', background: colors.primary, color: colors.textWhite, border: 'none', padding: '14px', borderRadius: radii.tagPill, fontSize: '15px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, fontFamily: fonts.sans }}>
          {submitting ? 'Submitting…' : 'Submit Opportunity for Review'}
        </button>
      </div>
    </div>
  )
}
