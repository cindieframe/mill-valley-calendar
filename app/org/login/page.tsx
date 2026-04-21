'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'
import Header from '../../components/Header'

export default function OrgLogin() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin() {
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setLoading(true)
    setError('')
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    setLoading(false)
    router.push('/org/dashboard')
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

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>
      <Header
  rightSlot={
    <button onClick={() => router.push('/')}
      style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer' }}>
      ← Calendar
    </button>
  }
/>
      <div style={{ maxWidth: '400px', margin: '0 auto', padding: '80px 24px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: 900, color: '#1f2937', marginBottom: '6px' }}>
          Organization Login
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '32px' }}>
          Log in to manage your events and profile.
        </p>
        {error && (
          <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            ⚠️ {error}
          </div>
        )}
        <label style={labelStyle}>Email Address</label>
        <input style={inputStyle} type="email" placeholder="you@yourorg.org"
          value={email} onChange={e => setEmail(e.target.value)} />
        <label style={labelStyle}>Password</label>
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <input style={{ ...inputStyle, marginBottom: 0, paddingRight: '44px' }}
            type={showPassword ? 'text' : 'password'}
            placeholder="Your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          <button onClick={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af', padding: '0' }}>
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        <button onClick={handleLogin} disabled={loading}
          style={{ width: '100%', background: '#1a3d2b', color: 'white', border: 'none', padding: '14px', borderRadius: '999px', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px' }}>
          {loading ? 'Logging in…' : 'Log In →'}
        </button>
        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#9ca3af' }}>
          Don't have an account?{' '}
          <span onClick={() => router.push('/org/signup')}
            style={{ color: '#1a3d2b', fontWeight: 700, cursor: 'pointer' }}>
            Sign up
          </span>
        </p>
      </div>
    </div>
  )
}