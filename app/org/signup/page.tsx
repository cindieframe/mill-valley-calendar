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
  const [matchingOrgs, setMatchingOrgs] = useState<string[]>([])
  const [claimedOrg, setClaimedOrg] = useState('')
  const [showClaimWarning, setShowClaimWarning] = useState<string>('')
  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '',
    description: '', website: '', phone: '', instagram: '', facebook: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function searchMatchingOrgs(name: string) {
    if (name.length < 3) { setMatchingOrgs([]); return }

    const { data: eventData } = await supabase
      .from('events')
      .select('organization')
      .ilike('organization', `%${name}%`)
      .eq('status', 'approved')
    if (!eventData) return

    const allNames = [...new Set(eventData.map((e: any) => e.organization).filter(Boolean))] as string[]

    const { data: orgData } = await supabase
      .from('organizations')
      .select('name, user_id')

    const claimedWithAccount = new Set(
      (orgData || [])
        .filter((o: any) => o.user_id)
        .map((o: any) => o.name?.toLowerCase())
        .filter(Boolean)
    )

    const unclaimed = allNames.filter(n => !claimedWithAccount.has(n.toLowerCase()))
    const alreadyClaimed = allNames.filter(n => claimedWithAccount.has(n.toLowerCase()))

    const results = [
      ...unclaimed.slice(0, 5).map(n => `UNCLAIMED:${n}`),
      ...alreadyClaimed.slice(0, 3).map(n => `CLAIMED:${n}`),
    ]
    setMatchingOrgs(results)
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
    if (!claimedOrg && !showClaimWarning) {
      const { data: eventData } = await supabase
        .from('events')
        .select('organization')
        .ilike('organization', `%${form.name.trim()}%`)
        .eq('status', 'approved')
      if (eventData && eventData.length > 0) {
        const names = [...new Set(eventData.map((e: any) => e.organization).filter(Boolean))] as string[]
        const { data: orgData } = await supabase.from('organizations').select('name, user_id')
        const claimedNames = new Set(
          (orgData || [])
            .filter((o: any) => o.user_id)
            .map((o: any) => o.name?.toLowerCase())
            .filter(Boolean)
        )
        const available = names.filter(n => !claimedNames.has(n.toLowerCase()))
        if (available.length > 0) {
          setShowClaimWarning(available[0])
          setLoading(false)
          return
        }
      }
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

    const { error: orgError } = await supabase
      .from('organizations')
      .insert([{
        user_id: authData.user.id,
        name: form.name,
        email: form.email,
        description: form.description || '',
        website: form.website || '',
        phone: form.phone || '',
        instagram: form.instagram || '',
        facebook: form.facebook || '',
      }])

    if (orgError) {
      console.error('Org creation error:', orgError)
    }

    // If org claimed existing events, rename those events to match the new org name
    if (claimedOrg && claimedOrg !== form.name) {
      await supabase
        .from('events')
        .update({ organization: form.name })
        .ilike('organization', claimedOrg)
    }

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

      {showClaimWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '8px' }}>
              Before you continue…
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', lineHeight: 1.6 }}>
              We found an existing org on Townstir that looks similar to yours:
            </p>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #16803c', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', fontWeight: 700, color: '#16803c' }}>
              {showClaimWarning}
            </div>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '20px' }}>
              Is this your organization? If so, we'll link your account and update all existing events to use your org name.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setClaimedOrg(showClaimWarning); setShowClaimWarning(''); handleSignup() }}
                style={{ flex: 2, background: '#16803c', color: 'white', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                ✓ Yes, that's us
              </button>
              <button onClick={() => { setShowClaimWarning(''); handleSignup() }}
                style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                No, we're different
              </button>
            </div>
          </div>
        </div>
      )}

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
          value={form.name} onChange={e => { set('name', e.target.value); setClaimedOrg(''); searchMatchingOrgs(e.target.value) }} />

        {matchingOrgs.length > 0 && !claimedOrg && (
          <div style={{ marginBottom: '8px' }}>
            {matchingOrgs.some(o => o.startsWith('UNCLAIMED:')) && (
              <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                <div style={{ padding: '8px 14px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.8px', background: '#f9fafb' }}>
                  Is your org already on Townstir? Click to claim it:
                </div>
                {matchingOrgs.filter(o => o.startsWith('UNCLAIMED:')).map(entry => {
                  const orgName = entry.replace('UNCLAIMED:', '')
                  return (
                    <div key={entry} onClick={() => { setClaimedOrg(orgName); setMatchingOrgs([]); set('name', orgName) }}
                      style={{ padding: '10px 14px', fontSize: '13px', color: '#1f2937', cursor: 'pointer', borderTop: '1px solid #f3f4f6', fontWeight: 600 }}
                      onMouseOver={e => (e.currentTarget.style.background = '#f0fdf4')}
                      onMouseOut={e => (e.currentTarget.style.background = 'white')}>
                      ✓ {orgName}
                    </div>
                  )
                })}
                <div onClick={() => setMatchingOrgs([])}
                  style={{ padding: '10px 14px', fontSize: '12px', color: '#9ca3af', cursor: 'pointer', borderTop: '1px solid #f3f4f6' }}>
                  None of these — we're new to Townstir
                </div>
              </div>
            )}
            {matchingOrgs.some(o => o.startsWith('CLAIMED:')) && (
              <div style={{ background: '#fff7ed', border: '1.5px solid #f59e0b', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#b45309', marginBottom: '4px' }}>
                  ⚠️ This organization already has an account on Townstir.
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  If you are a member, please contact your account administrator or email <strong>townstir.admin@gmail.com</strong> for access.
                </div>
              </div>
            )}
          </div>
        )}

        {claimedOrg && (
          <div style={{ background: '#f0fdf4', border: '1.5px solid #16803c', borderRadius: '8px', padding: '10px 14px', marginBottom: '8px', fontSize: '13px', color: '#16803c', fontWeight: 600 }}>
            ✅ Your account will be linked to existing events for: {claimedOrg}
          </div>
        )}

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