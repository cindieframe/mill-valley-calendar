'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'

const ADMIN_EMAIL = 'admin@townstir.com'

export default function Admin() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [editingEvent, setEditingEvent] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    checkSession()
  }, [])

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email === ADMIN_EMAIL) {
      setAuthed(true)
    }
    setAuthLoading(false)
  }

  useEffect(() => {
    if (!authed) return
    if (filter === 'organizations') {
      loadOrgs()
    } else {
      loadEvents()
      setSelected(new Set())
    }
  }, [filter, authed])

  async function handleLogin() {
    if (!email || !password) { setLoginError('Please enter your email and password.'); return }
    setLoginLoading(true)
    setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) {
      setLoginError('Invalid email or password.')
      setLoginLoading(false)
      return
    }
    if (data.user.email !== ADMIN_EMAIL) {
      await supabase.auth.signOut()
      setLoginError('You do not have admin access.')
      setLoginLoading(false)
      return
    }
    setAuthed(true)
    setLoginLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setAuthed(false)
    setEmail('')
    setPassword('')
  }

  async function loadEvents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', filter)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    if (!error) setEvents(data || [])
    setLoading(false)
  }

  async function loadOrgs() {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('name', { ascending: true })
    if (!error) setOrgs(data || [])
    setLoading(false)
  }

  async function toggleVerify(org: any) {
    const newVerified = !org.verified
    const { error } = await supabase
      .from('organizations')
      .update({ verified: newVerified })
      .eq('id', org.id)
    if (!error) {
      await supabase.from('events').update({ verified: newVerified }).eq('organization', org.name)
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, verified: newVerified } : o))
    }
  }

  async function updateStatus(id: number, status: string) {
    const { error } = await supabase.from('events').update({ status }).eq('id', id)
    if (!error) setEvents(prev => prev.filter(ev => ev.id !== id))
  }

  async function deleteEvent(id: number) {
    if (!confirm('Are you sure you want to permanently delete this event?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (!error) setEvents(prev => prev.filter(ev => ev.id !== id))
  }

  function toggleSelect(id: number) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selected.size === events.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(events.map(ev => ev.id)))
    }
  }

  async function bulkApprove() {
    if (selected.size === 0) return
    if (!confirm(`Approve ${selected.size} events?`)) return
    setBulkWorking(true)
    const ids = Array.from(selected)
    const { error } = await supabase.from('events').update({ status: 'approved' }).in('id', ids)
    if (!error) { setEvents(prev => prev.filter(ev => !selected.has(ev.id))); setSelected(new Set()) }
    setBulkWorking(false)
  }

  async function bulkReject() {
    if (selected.size === 0) return
    if (!confirm(`Reject ${selected.size} events?`)) return
    setBulkWorking(true)
    const ids = Array.from(selected)
    const { error } = await supabase.from('events').update({ status: 'rejected' }).in('id', ids)
    if (!error) { setEvents(prev => prev.filter(ev => !selected.has(ev.id))); setSelected(new Set()) }
    setBulkWorking(false)
  }

  async function saveEdit() {
    setSaving(true)
    const { error } = await supabase.from('events').update({
      title: editingEvent.title, date: editingEvent.date, time: editingEvent.time,
      location: editingEvent.location, address: editingEvent.address,
      organization: editingEvent.organization, category: editingEvent.category,
      tags: editingEvent.tags, cost: editingEvent.cost, age: editingEvent.age,
      description: editingEvent.description, email: editingEvent.email, website: editingEvent.website,
    }).eq('id', editingEvent.id)
    setSaving(false)
    if (!error) {
      setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? editingEvent : ev))
      setEditingEvent(null)
    }
  }

  const inputStyle = {
    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px',
    padding: '8px 12px', fontFamily: 'sans-serif', fontSize: '13px',
    color: '#1f2937', outline: 'none', background: 'white', marginBottom: '8px'
  }

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#9ca3af' }}>
      Loading…
    </div>
  )

  if (editingEvent) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a3d2b', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
          <span style={{ fontWeight: 800, fontSize: '22px', color: '#e6a020', letterSpacing: '-1px', textTransform: 'uppercase' }}>STIR</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '12px' }}>Edit Event</span>
        </div>
        <button onClick={() => setEditingEvent(null)}
          style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
          ← Back
        </button>
      </header>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '24px', fontWeight: 900, color: '#1f2937', marginBottom: '24px' }}>Edit Event</h1>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Title</label>
        <input style={inputStyle} value={editingEvent.title || ''} onChange={e => setEditingEvent({ ...editingEvent, title: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</label>
            <input style={inputStyle} type="date" value={editingEvent.date || ''} onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Time</label>
            <input style={inputStyle} value={editingEvent.time || ''} onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })} />
          </div>
        </div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Location</label>
        <input style={inputStyle} value={editingEvent.location || ''} onChange={e => setEditingEvent({ ...editingEvent, location: e.target.value })} />
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Address</label>
        <input style={inputStyle} value={editingEvent.address || ''} onChange={e => setEditingEvent({ ...editingEvent, address: e.target.value })} />
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Organization</label>
        <input style={inputStyle} value={editingEvent.organization || ''} onChange={e => setEditingEvent({ ...editingEvent, organization: e.target.value })} />
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Category</label>
        <input style={inputStyle} value={editingEvent.category || ''} placeholder="e.g. outdoors,classes" onChange={e => setEditingEvent({ ...editingEvent, category: e.target.value })} />
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Tags</label>
        <input style={inputStyle} value={editingEvent.tags || ''} placeholder="e.g. free,family,senior" onChange={e => setEditingEvent({ ...editingEvent, tags: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Cost</label>
            <input style={inputStyle} value={editingEvent.cost || ''} onChange={e => setEditingEvent({ ...editingEvent, cost: e.target.value })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Age</label>
            <input style={inputStyle} value={editingEvent.age || ''} onChange={e => setEditingEvent({ ...editingEvent, age: e.target.value })} />
          </div>
        </div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Description</label>
        <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} value={editingEvent.description || ''} onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
            <input style={inputStyle} value={editingEvent.email || ''} onChange={e => setEditingEvent({ ...editingEvent, email: e.target.value })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Website</label>
            <input style={inputStyle} value={editingEvent.website || ''} onChange={e => setEditingEvent({ ...editingEvent, website: e.target.value })} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={saveEdit} disabled={saving}
            style={{ flex: 1, background: '#1a3d2b', color: 'white', border: 'none', padding: '12px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : '✓ Save Changes'}
          </button>
          <button onClick={() => setEditingEvent(null)}
            style={{ padding: '12px 24px', background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '40px', width: '360px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '24px', color: '#1a3d2b' }}>town</span>
          <span style={{ fontWeight: 800, fontSize: '24px', color: '#e6a020', textTransform: 'uppercase' }}>STIR</span>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>Admin Access</p>
        </div>
        {loginError && (
          <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            ⚠️ {loginError}
          </div>
        )}
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="admin@townstir.com"
          style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as const }} />
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input type={showPassword ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Password"
            style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 44px 10px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }} />
          <button onClick={() => setShowPassword(!showPassword)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af', padding: '0' }}>
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
        <button onClick={handleLogin} disabled={loginLoading}
          style={{ width: '100%', background: '#1a3d2b', color: 'white', border: 'none', padding: '12px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: loginLoading ? 'not-allowed' : 'pointer', opacity: loginLoading ? 0.7 : 1 }}>
          {loginLoading ? 'Logging in…' : 'Log In →'}
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
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '12px' }}>Admin</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/admin/import')}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)', padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
            ⬇️ iCal Import
          </button>
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

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: 900, color: '#1f2937', marginBottom: '6px' }}>Admin</h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '24px' }}>Manage events and organizations.</p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {['pending', 'approved', 'rejected', 'organizations'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '8px 20px', borderRadius: '999px', border: '1.5px solid', borderColor: filter === s ? '#1a3d2b' : '#e5e7eb', background: filter === s ? '#1a3d2b' : 'white', color: filter === s ? 'white' : '#6b7280', fontWeight: 600, fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>

        {filter === 'organizations' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading…</div>
            ) : orgs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
                <p>No organizations have signed up yet.</p>
              </div>
            ) : (
              orgs.map(org => (
                <div key={org.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${org.verified ? '#16803c' : '#e5e7eb'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>
                        {org.name}
                        {org.verified && <span style={{ marginLeft: '8px', background: '#16803c', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>✓ Verified</span>}
                      </h3>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        📧 {org.email}
                        {org.website && <>&nbsp;·&nbsp; 🌐 {org.website}</>}
                      </div>
                      {org.ical_feed_url && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>📅 iCal feed connected</div>}
                    </div>
                    <button onClick={() => toggleVerify(org)}
                      style={{ background: org.verified ? 'white' : '#16803c', color: org.verified ? '#dc2626' : 'white', border: org.verified ? '1.5px solid #dc2626' : 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                      {org.verified ? '✕ Unverify' : '✓ Verify'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {filter !== 'organizations' && (
          <>
            {!loading && events.length > 0 && filter === 'pending' && (
              <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  <input type="checkbox" checked={selected.size === events.length && events.length > 0} onChange={toggleSelectAll} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  {selected.size === 0 ? 'Select all' : `${selected.size} of ${events.length} selected`}
                </label>
                {selected.size > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button onClick={bulkApprove} disabled={bulkWorking}
                      style={{ background: '#16803c', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: bulkWorking ? 'not-allowed' : 'pointer', opacity: bulkWorking ? 0.7 : 1 }}>
                      {bulkWorking ? 'Working…' : `✓ Approve ${selected.size}`}
                    </button>
                    <button onClick={bulkReject} disabled={bulkWorking}
                      style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: bulkWorking ? 'not-allowed' : 'pointer', opacity: bulkWorking ? 0.7 : 1 }}>
                      {bulkWorking ? 'Working…' : `✕ Reject ${selected.size}`}
                    </button>
                  </div>
                )}
              </div>
            )}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading…</div>
            ) : events.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
                <p>No {filter} events.</p>
              </div>
            ) : (
              events.map(ev => (
                <div key={ev.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${selected.has(ev.id) ? '#1a3d2b' : '#e5e7eb'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    {filter === 'pending' && (
                      <input type="checkbox" checked={selected.has(ev.id)} onChange={() => toggleSelect(ev.id)}
                        style={{ width: '16px', height: '16px', cursor: 'pointer', marginRight: '12px', marginTop: '3px', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>{ev.title}</h3>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>
                        📅 {ev.date} &nbsp;·&nbsp; 🕐 {ev.time} &nbsp;·&nbsp; 📍 {ev.location}
                      </div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                        👥 {ev.organization} &nbsp;·&nbsp; 🏷️ {ev.category}
                        {ev.cost && <>&nbsp;·&nbsp; 💰 {ev.cost}</>}
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0, marginLeft: '12px' }}>#{ev.id}</div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6, marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                    {ev.description}
                  </p>
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
                    {ev.email && <span>📧 {ev.email}&nbsp;&nbsp;</span>}
                    {ev.website && <span>🌐 {ev.website}&nbsp;&nbsp;</span>}
                    {ev.tags && <span>🏷️ {ev.tags}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {filter === 'pending' && <>
                      <button onClick={() => updateStatus(ev.id, 'approved')}
                        style={{ background: '#16803c', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        ✓ Approve
                      </button>
                      <button onClick={() => updateStatus(ev.id, 'rejected')}
                        style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        ✕ Reject
                      </button>
                    </>}
                    {filter === 'rejected' && <>
                      <button onClick={() => updateStatus(ev.id, 'approved')}
                        style={{ background: '#16803c', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        ✓ Approve anyway
                      </button>
                      <button onClick={() => deleteEvent(ev.id)}
                        style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        🗑 Delete permanently
                      </button>
                    </>}
                    {filter === 'approved' && <>
                      <button onClick={() => updateStatus(ev.id, 'rejected')}
                        style={{ background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        ✕ Unpublish
                      </button>
                      <button onClick={() => deleteEvent(ev.id)}
                        style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        🗑 Delete permanently
                      </button>
                    </>}
                    <button onClick={() => setEditingEvent(ev)}
                      style={{ background: 'white', color: '#1a3d2b', border: '1.5px solid #1a3d2b', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  )
}