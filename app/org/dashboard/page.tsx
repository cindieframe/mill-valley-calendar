'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'

export default function OrgDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [org, setOrg] = useState<any>(null)

  useEffect(() => {
    loadOrg()
  }, [])

  async function loadOrg() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/org/login')
      return
    }
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (error || !data) {
      router.push('/org/login')
      return
    }
    setOrg(data)
    setLoading(false)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo must be under 2MB')
      return
    }
    setUploadingLogo(true)
    setError('')
    const ext = file.name.split('.').pop()
    const fileName = `${org.id}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('org-logos')
      .upload(fileName, file, { upsert: true })
    if (uploadError) {
      setError('Logo upload failed: ' + uploadError.message)
      setUploadingLogo(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage
      .from('org-logos')
      .getPublicUrl(fileName)
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ logo_url: publicUrl })
      .eq('id', org.id)
    if (updateError) {
      setError('Failed to save logo URL')
      setUploadingLogo(false)
      return
    }
    setOrg({ ...org, logo_url: publicUrl })
    setUploadingLogo(false)
    setSuccess('Logo uploaded successfully!')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess('')
    const { error } = await supabase
      .from('organizations')
      .update({
        name: org.name,
        description: org.description,
        website: org.website,
        phone: org.phone,
        email: org.email,
        instagram: org.instagram,
        facebook: org.facebook,
        ical_feed_url: org.ical_feed_url,
      })
      .eq('id', org.id)
    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }
    if (org.ical_feed_url) {
      try {
        const importRes = await fetch('/api/import-ical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedUrl: org.ical_feed_url,
            organization: org.name,
          })
        })
        const importData = await importRes.json()
        if (importData.error) {
          setSuccess(`Profile saved! Note: Calendar sync had an issue — ${importData.error}`)
        } else {
          setSuccess(`Profile saved! ${importData.imported} new events imported, ${importData.skipped} already existed.`)
        }
      } catch (err) {
        setSuccess('Profile saved! Calendar sync will retry shortly.')
      }
    } else {
      setSuccess('Profile saved successfully!')
    }
    setSaving(false)
    setTimeout(() => setSuccess(''), 5000)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9ca3af' }}>
      Loading…
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a3d2b', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#e6a020', letterSpacing: '-1px', textTransform: 'uppercase' }}>STIR</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '12px' }}>{org.name}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/')}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            ← Calendar
          </button>
          <button onClick={handleLogout}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            Log Out
          </button>
        </div>
      </header>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: 900, color: '#1f2937', marginBottom: '6px' }}>
          Organization Dashboard
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '32px' }}>
          Manage your profile and connect your events calendar.
        </p>
        {error && (
          <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#16803c' }}>
            ✅ {success}
          </div>
        )}

        {/* Logo Upload Section */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1.5px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>
            Organization Logo
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
            Upload a logo to appear on your events and profile. PNG or JPG, under 2MB.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#f3f4f6', border: '2px solid #e5e7eb', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {org.logo_url ? (
                <img src={org.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }} />
              ) : (
                <span style={{ fontSize: '28px' }}>🏢</span>
              )}
            </div>
            <div>
              <label style={{ display: 'inline-block', background: '#1a3d2b', color: 'white', padding: '8px 18px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                {uploadingLogo ? 'Uploading…' : 'Choose Logo'}
                <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} disabled={uploadingLogo} />
              </label>
              {org.logo_url && (
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px' }}>Logo uploaded ✓</p>
              )}
            </div>
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '2px solid #1a3d2b' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1a3d2b', marginBottom: '4px' }}>
            📅 Connect Your Calendar
          </h2>
          <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
            Paste your iCal feed URL and your events will automatically appear on the Townstir calendar.
          </p>
          <label style={labelStyle}>iCal Feed URL</label>
          <input style={inputStyle} placeholder="https://calendar.google.com/calendar/ical/..."
            value={org.ical_feed_url || ''}
            onChange={e => setOrg({ ...org, ical_feed_url: e.target.value })} />
          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
            Google Calendar: Settings → your calendar → Integrate calendar → copy iCal link
          </div>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1.5px solid #e5e7eb' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '16px' }}>
            Organization Profile
          </h2>
          <label style={labelStyle}>Organization Name</label>
          <input style={inputStyle} value={org.name || ''}
            onChange={e => setOrg({ ...org, name: e.target.value })} />
          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            value={org.description || ''}
            onChange={e => setOrg({ ...org, description: e.target.value })} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} placeholder="https://yourorg.org"
                value={org.website || ''}
                onChange={e => setOrg({ ...org, website: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} placeholder="415-555-1234"
                value={org.phone || ''}
                onChange={e => setOrg({ ...org, phone: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Instagram</label>
              <input style={inputStyle} placeholder="@yourorg"
                value={org.instagram || ''}
                onChange={e => setOrg({ ...org, instagram: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Facebook</label>
              <input style={inputStyle} placeholder="facebook.com/yourorg"
                value={org.facebook || ''}
                onChange={e => setOrg({ ...org, facebook: e.target.value })} />
            </div>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          style={{ width: '100%', background: '#1a3d2b', color: 'white', border: 'none', padding: '14px', borderRadius: '999px', fontSize: '15px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : '✓ Save Profile'}
        </button>
      </div>
    </div>
  )
}