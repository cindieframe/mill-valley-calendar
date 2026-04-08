'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'

export default function OrgSignup() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    description: '', website: '', phone: '', instagram: '', facebook: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSignup() {
    if (!form.name || !form.email || !form.password) {
      setError('Organization name, email, and password are required.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          org_name: form.name,
          org_email: form.email,
          org_description: form.description,
          org_website: form.website,
          org_phone: form.phone,
          org_instagram: form.instagram,
          org_facebook: form.facebook,
        }
      }
    })

    if (authError || !authData.user) {
      setError(authError?.message || 'Account creation failed. Please try again.')
      setLoading(false)
      return
    }

    // Send welcome email
    await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: form.email,
        subject: 'Welcome to Townstir — please confirm your email 🌲',
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px;">
            <div style="margin-bottom: 24px;">
              <span style="font-weight: 800; font-size: 24px; color: #1a3d2b;">town</span><span style="font-weight: 800; font-size: 24px; color: #e6a020; text-transform: uppercase;">STIR</span>
            </div>
            <h1 style="font-size: 22px; color: #1f2937; margin-bottom: 8px;">Welcome to Townstir, ${form.name}!</h1>
            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
              Thanks for joining Townstir, Mill Valley's community events calendar. Please check your email for a confirmation link from Supabase to activate your account.
            </p>
            <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
              Once confirmed, log in to your dashboard to connect your calendar and start posting events.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
            <p style="color: #9ca3af; font-size: 12px;">
              Questions? Reply to this email and we'll help you get set up.<br>
              <strong style="color: #1a3d2b;">The Townstir Team</strong> · Mill Valley, CA
            </p>
          </div>
        `
      })
    })

    setLoading(false)
    setEmailSent(true)
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

  if (emailSent) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a3d2b', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#e6a020', letterSpacing: '-1px', textTransform: 'uppercase' }}>STIR</span>
        </div>
        <button onClick={() => router.push('/')}
          style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          ← Calendar
        </button>
      </header>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📬</div>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '26px', fontWeight: 900, color: '#1f2937', marginBottom: '12px' }}>
          Check your email
        </h1>
        <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: 1.6, marginBottom: '24px' }}>
          We sent a confirmation link to <strong>{form.email}</strong>. Click the link to activate your account, then log in to your dashboard.
        </p>
        <button onClick={() => router.push('/org/login')}
          style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
          Go to Login →
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a3d2b', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#e6a020', letterSpacing: '-1px', textTransform: 'uppercase' }}>STIR</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '12px' }}>Organization Signup</span>
        </div>
        <button onClick={() => router.push('/')}
          style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          ← Calendar
        </button>
      </header>
      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: 900, color: '#1f2937', marginBottom: '6px' }}>
          Create Organization Account
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '32px' }}>
          List your organization's events on the Mill Valley community calendar.
        </p>
        {error && (
          <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            ⚠️ {error}
          </div>
        )}
        <label style={labelStyle}>Organization Name *</label>
        <input style={inputStyle} placeholder="e.g. Mill Valley Library"
          value={form.name} onChange={e => set('name', e.target.value)} />
        <label style={labelStyle}>Email Address *</label>
        <input style={inputStyle} type="email" placeholder="you@yourorg.org"
          value={form.email} onChange={e => set('email', e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Password *</label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input style={{ ...inputStyle, marginBottom: 0, paddingRight: '44px' }}
                type={showPassword ? 'text' : 'password'}
                placeholder="Min 8 characters"
                value={form.password}
                onChange={e => set('password', e.target.value)} />
              <button onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af', padding: '0' }}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Confirm Password *</label>
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <input style={{ ...inputStyle, marginBottom: 0, paddingRight: '44px' }}
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={form.confirmPassword}
                onChange={e => set('confirmPassword', e.target.value)} />
              <button onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af', padding: '0' }}>
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        </div>
        <label style={labelStyle}>Description</label>
        <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
          placeholder="Tell the community about your organization..."
          value={form.description} onChange={e => set('description', e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Website</label>
            <input style={inputStyle} placeholder="https://yourorg.org"
              value={form.website} onChange={e => set('website', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input style={inputStyle} placeholder="415-555-1234"
              value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Instagram</label>
            <input style={inputStyle} placeholder="@yourorg"
              value={form.instagram} onChange={e => set('instagram', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Facebook</label>
            <input style={inputStyle} placeholder="facebook.com/yourorg"
              value={form.facebook} onChange={e => set('facebook', e.target.value)} />
          </div>
        </div>
        <button onClick={handleSignup} disabled={loading}
          style={{ width: '100%', background: '#1a3d2b', color: 'white', border: 'none', padding: '14px', borderRadius: '999px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px' }}>
          {loading ? 'Creating account…' : 'Create Account →'}
        </button>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#9ca3af' }}>
          Already have an account?{' '}
          <span onClick={() => router.push('/org/login')}
            style={{ color: '#1a3d2b', fontWeight: 700, cursor: 'pointer' }}>
            Log in
          </span>
        </p>
      </div>
    </div>
  )
}