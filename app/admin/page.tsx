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
  const [noteModal, setNoteModal] = useState<{ eventId: number, action: 'unpublished' | 'rejected' } | null>(null)
  const [noteText, setNoteText] = useState('')
  const [editingOrg, setEditingOrg] = useState<any>(null)
  const [orgSaving, setOrgSaving] = useState(false)
  const [filterOrg, setFilterOrg] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [orgEventCounts, setOrgEventCounts] = useState<Record<string, number>>({})
  const [messageModal, setMessageModal] = useState<any>(null)
  const [messageSubject, setMessageSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageSending, setMessageSending] = useState(false)
  const [messageSent, setMessageSent] = useState(false)

  useEffect(() => { checkSession() }, [])

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email === ADMIN_EMAIL) setAuthed(true)
    setAuthLoading(false)
  }

  useEffect(() => {
    if (!authed) return
    if (filter === 'organizations') loadOrgs()
    else { loadEvents(); setSelected(new Set()) }
  }, [filter, authed])

  async function handleLogin() {
    if (!email || !password) { setLoginError('Please enter your email and password.'); return }
    setLoginLoading(true)
    setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) { setLoginError('Invalid email or password.'); setLoginLoading(false); return }
    if (data.user.email !== ADMIN_EMAIL) { await supabase.auth.signOut(); setLoginError('You do not have admin access.'); setLoginLoading(false); return }
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
    const { data, error } = await supabase.from('events').select('*').eq('status', filter)
      .order('date', { ascending: true }).order('time', { ascending: true })
    if (!error) setEvents(data || [])
    setLoading(false)
  }

  async function loadOrgs() {
    setLoading(true)
    const { data, error } = await supabase.from('organizations').select('*').order('name', { ascending: true })
    if (!error && data) {
      setOrgs(data)
      const { data: eventData } = await supabase
        .from('events')
        .select('organization')
        .eq('status', 'approved')
      if (eventData) {
        const counts: Record<string, number> = {}
        for (const org of data) {
          counts[org.id] = eventData.filter(e =>
            e.organization?.toLowerCase() === org.name?.toLowerCase() ||
            (org.canonical_name && e.organization?.toLowerCase() === org.canonical_name?.toLowerCase())
          ).length
        }
        setOrgEventCounts(counts)
      }
    }
    setLoading(false)
  }

  async function saveOrgEdit() {
    setOrgSaving(true)
    const originalOrg = orgs.find(o => o.id === editingOrg.id)
    try {
      const response = await fetch('/api/update-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingOrg.id,
          name: editingOrg.name,
          originalName: originalOrg?.name,
        }),
      })
      const data = await response.json()
      if (!data.error) {
        setOrgs(prev => prev.map(o => o.id === editingOrg.id ? { ...o, name: editingOrg.name } : o))
        setEditingOrg(null)
        loadOrgs()
      }
    } catch {
      console.error('Save org failed')
    }
    setOrgSaving(false)
  }

  async function toggleVerify(org: any) {
    const newVerified = !org.verified
    const { error } = await supabase.from('organizations').update({ verified: newVerified }).eq('id', org.id)
    if (!error) {
      await supabase.from('events').update({ verified: newVerified }).eq('organization', org.name)
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, verified: newVerified } : o))
    }
  }

  async function handleSendMessage() {
    if (!messageSubject || !messageBody) return
    setMessageSending(true)
    const recipients = messageModal.all
      ? orgs.filter(o => o.email)
      : [messageModal]

    for (const org of recipients) {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: org.email,
          subject: messageSubject,
          html: `
            <p>Hi ${org.name},</p>
            ${messageBody.split('\n').map((line: string) => `<p>${line}</p>`).join('')}
            <p>— The Townstir Team</p>
          `,
          replyTo: 'townstir.admin@gmail.com',
        }),
      })
    }
    setMessageSending(false)
    setMessageSent(true)
    setTimeout(() => {
      setMessageModal(null)
      setMessageSubject('')
      setMessageBody('')
      setMessageSent(false)
    }, 2000)
  }

  async function updateStatus(id: number, status: string, note?: string) {
    const updatePayload: any = { status }
    if (status === 'unpublished') updatePayload.unpublished_note = note || null
    if (status === 'rejected') updatePayload.rejected_note = note || null
    const { error } = await supabase.from('events').update(updatePayload).eq('id', id)
    if (!error) {
      const ev = events.find(e => e.id === id)
      if (ev?.email || ev?.organization) {
        let recipientEmail = ev.email
        if (!recipientEmail && ev.organization) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('email')
            .ilike('name', ev.organization)
            .single()
          if (orgData?.email) recipientEmail = orgData.email
        }
        if (recipientEmail) {
          let subject = ''
          let html = ''
          if (status === 'approved') {
            subject = `Your event is live: ${ev.title}`
            html = `
              <p>Great news!</p>
              <p>Your event <strong>${ev.title}</strong> on <strong>${ev.date}</strong> has been approved and is now live on the Townstir calendar.</p>
              <p><a href="https://www.townstir.com/event/${ev.id}">View your event →</a></p>
              <p>— The Townstir Team</p>
            `
          } else if (status === 'rejected') {
            subject = `Update on your event: ${ev.title}`
            html = `
              <p>Hi there,</p>
              <p>Unfortunately your event <strong>${ev.title}</strong> on <strong>${ev.date}</strong> was not approved for the Townstir calendar.</p>
              ${note ? `<p><strong>Note from admin:</strong> ${note}</p>` : ''}
              <p>You're welcome to make changes and resubmit at <a href="https://www.townstir.com/post-event">townstir.com/post-event</a>.</p>
              <p>— The Townstir Team</p>
            `
          } else if (status === 'unpublished') {
            subject = `Your event has been unpublished: ${ev.title}`
            html = `
              <p>Hi there,</p>
              <p>Your event <strong>${ev.title}</strong> on <strong>${ev.date}</strong> has been temporarily unpublished from the Townstir calendar.</p>
              ${note ? `<p><strong>Note from admin:</strong> ${note}</p>` : ''}
              <p>Please log in to your dashboard to make any needed updates.</p>
              <p>— The Townstir Team</p>
            `
          }
          if (subject) {
            await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to: recipientEmail, subject, html, replyTo: 'townstir.admin@gmail.com' }),
            })
          }
        }
      }
      setEvents(prev => prev.filter(ev => ev.id !== id))
    }
  }

  async function handleNoteConfirm() {
    if (!noteModal) return
    await updateStatus(noteModal.eventId, noteModal.action, noteText)
    setNoteModal(null)
    setNoteText('')
  }

  function openNoteModal(eventId: number, action: 'unpublished' | 'rejected') {
    setNoteText('')
    setNoteModal({ eventId, action })
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
    if (selected.size === events.length) setSelected(new Set())
    else setSelected(new Set(events.map(ev => ev.id)))
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
    const { error } = await supabase.from('events').update({ status: 'rejected', rejected_note: null }).in('id', ids)
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {['outdoors','arts','food','community','family','classes','gov'].map(cat => {
            const active = (editingEvent.category || '').split(',').map((c: string) => c.trim()).includes(cat)
            return (
              <button key={cat} type="button" onClick={() => {
                const current = (editingEvent.category || '').split(',').map((c: string) => c.trim()).filter(Boolean)
                const next = active ? current.filter((c: string) => c !== cat) : [...current, cat]
                setEditingEvent({ ...editingEvent, category: next.join(',') })
              }} style={{ padding: '7px 14px', borderRadius: '999px', border: '1.5px solid', borderColor: active ? '#1a3d2b' : '#e5e7eb', background: active ? '#1a3d2b' : 'white', color: active ? 'white' : '#6b7280', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                {cat}
              </button>
            )
          })}
        </div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Tags</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {['free','family','wellness','reg'].map(tag => {
            const active = (editingEvent.tags || '').split(',').map((t: string) => t.trim()).includes(tag)
            return (
              <button key={tag} type="button" onClick={() => {
                const current = (editingEvent.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)
                const next = active ? current.filter((t: string) => t !== tag) : [...current, tag]
                setEditingEvent({ ...editingEvent, tags: next.join(',') })
              }} style={{ padding: '7px 14px', borderRadius: '999px', border: '1.5px solid', borderColor: active ? '#10b981' : '#e5e7eb', background: active ? '#10b981' : 'white', color: active ? 'white' : '#6b7280', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                {tag}
              </button>
            )
          })}
        </div>
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
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@townstir.com"
          style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as const }} />
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input type={showPassword ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()}
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

      {/* Note Modal */}
      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '6px' }}>
              {noteModal.action === 'unpublished' ? '✕ Unpublish Event' : '✕ Reject Event'}
            </h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>
              Optionally add a note for the org explaining why. They will see this in their dashboard.
            </p>
            <textarea
              placeholder="e.g. Please update the event date and resubmit."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'sans-serif', outline: 'none', minHeight: '90px', resize: 'vertical', boxSizing: 'border-box' as const, marginBottom: '16px' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setNoteModal(null); setNoteText('') }}
                style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleNoteConfirm}
                style={{ flex: 2, background: noteModal.action === 'unpublished' ? '#6b7280' : '#dc2626', color: 'white', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
                {noteModal.action === 'unpublished' ? 'Confirm Unpublish' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {messageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>
              ✉️ {messageModal.all ? `Message All Orgs (${orgs.filter(o => o.email).length})` : `Message ${messageModal.name}`}
            </h3>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '16px' }}>
              {messageModal.all ? 'Sends to all orgs with an email address.' : `To: ${messageModal.email}`}
            </p>
            {messageSent ? (
              <div style={{ textAlign: 'center', padding: '20px', fontSize: '15px', color: '#16803c', fontWeight: 700 }}>
                ✅ Message sent!
              </div>
            ) : (
              <>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Subject</label>
                <input
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as const }}
                  placeholder="e.g. Welcome to Townstir!"
                  value={messageSubject}
                  onChange={e => setMessageSubject(e.target.value)}
                />
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Message</label>
                <textarea
                  placeholder="Write your message here…"
                  value={messageBody}
                  onChange={e => setMessageBody(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'sans-serif', outline: 'none', minHeight: '120px', resize: 'vertical', boxSizing: 'border-box' as const, marginBottom: '16px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setMessageModal(null); setMessageSubject(''); setMessageBody('') }}
                    style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={handleSendMessage} disabled={messageSending || !messageSubject || !messageBody}
                    style={{ flex: 2, background: '#1a3d2b', color: 'white', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: messageSending ? 'not-allowed' : 'pointer', opacity: messageSending || !messageSubject || !messageBody ? 0.7 : 1 }}>
                    {messageSending ? 'Sending…' : 'Send Message'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {['pending', 'approved', 'unpublished', 'rejected', 'organizations'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '8px 20px', borderRadius: '999px', border: '1.5px solid', borderColor: filter === s ? '#1a3d2b' : '#e5e7eb', background: filter === s ? '#1a3d2b' : 'white', color: filter === s ? 'white' : '#6b7280', fontWeight: 600, fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>

        {filter !== 'organizations' && (
          <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px 20px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
              style={{ border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', outline: 'none', color: '#374151' }} />
            <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)}
              style={{ border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', outline: 'none', color: '#374151', background: 'white' }}>
              <option value=''>All Orgs</option>
              {[...new Set(events.map(ev => ev.organization).filter(Boolean))].sort().map(org => (
                <option key={org} value={org}>{org}</option>
              ))}
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              style={{ border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', outline: 'none', color: '#374151', background: 'white' }}>
              <option value=''>All Categories</option>
              <option value='outdoors'>🥾 Outdoors, Sports & Movement</option>
              <option value='arts'>🎭 Arts & Performances</option>
              <option value='food'>🍷 Food, Drink & Social</option>
              <option value='community'>🤝 Volunteer & Community</option>
              <option value='family'>👨‍👩‍👧 Family & Youth</option>
              <option value='classes'>📚 Classes & Lectures</option>
              <option value='gov'>🏛️ Local Government</option>
            </select>
            {(filterOrg || filterCategory || filterDate) && (
              <button onClick={() => { setFilterOrg(''); setFilterCategory(''); setFilterDate('') }}
                style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                ✕ Clear filters
              </button>
            )}
          </div>
        )}

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
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <button onClick={() => setMessageModal({ all: true })}
                    style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                    ✉️ Message All Orgs
                  </button>
                </div>
                {orgs.map(org => (
                  <div key={org.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${org.verified ? '#16803c' : '#e5e7eb'}` }}>
                    {editingOrg?.id === org.id ? (
                      <div>
                        <div style={{ marginBottom: '10px' }}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Org Name</label>
                          <input style={{ ...inputStyle, marginBottom: '8px' }} value={editingOrg.name || ''} onChange={e => setEditingOrg({ ...editingOrg, name: e.target.value })} />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={saveOrgEdit} disabled={orgSaving}
                            style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                            {orgSaving ? 'Saving…' : '✓ Save'}
                          </button>
                          <button onClick={() => setEditingOrg(null)}
                            style={{ background: '#f3f4f6', color: '#374151', border: 'none', padding: '8px 20px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>
                            {org.name}
                            {org.verified && <span style={{ marginLeft: '8px', background: '#16803c', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>✓ Verified</span>}
                          </h3>
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>
                            {org.email && <>📧 {org.email}</>}
                            {org.website && <>&nbsp;·&nbsp; 🌐 {org.website}</>}
                          </div>
                          <div style={{ marginTop: '4px' }}>
                            <span onClick={() => { setFilter('approved'); setFilterOrg(org.name) }}
                              style={{ fontSize: '12px', color: orgEventCounts[org.id] > 0 ? '#1a3d2b' : '#9ca3af', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                              {orgEventCounts[org.id] ?? '…'} approved event{orgEventCounts[org.id] !== 1 ? 's' : ''}
                            </span>
                          </div>
                          {org.ical_feed_url && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>📅 {org.ical_feed_url}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => { setMessageModal(org); setMessageSubject(''); setMessageBody('') }}
                            style={{ background: 'white', color: '#1a3d2b', border: '1.5px solid #1a3d2b', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                            ✉️ Message
                          </button>
                          <button onClick={() => setEditingOrg({ ...org })}
                            style={{ background: 'white', color: '#1a3d2b', border: '1.5px solid #1a3d2b', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                            ✏️ Edit
                          </button>
                          <button onClick={() => toggleVerify(org)}
                            style={{ background: org.verified ? 'white' : '#16803c', color: org.verified ? '#dc2626' : 'white', border: org.verified ? '1.5px solid #dc2626' : 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                            {org.verified ? '✕ Unverify' : '✓ Verify'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
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
              events.filter(ev => {
                if (filterDate && ev.date !== filterDate) return false
                if (filterOrg && !ev.organization?.toLowerCase().includes(filterOrg.toLowerCase())) return false
                if (filterCategory && !ev.category?.split(',').map((c: string) => c.trim()).includes(filterCategory)) return false
                return true
              }).map(ev => (
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
                  {ev.unpublished_note && (
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', background: '#f3f4f6', borderRadius: '6px', padding: '8px 12px' }}>
                      💬 <em>Admin note: {ev.unpublished_note}</em>
                    </div>
                  )}
                  {ev.rejected_note && (
                    <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '12px', background: '#fee2e2', borderRadius: '6px', padding: '8px 12px' }}>
                      💬 <em>Admin note: {ev.rejected_note}</em>
                    </div>
                  )}
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
                      <button onClick={() => openNoteModal(ev.id, 'rejected')}
                        style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        ✕ Reject
                      </button>
                    </>}
                    {filter === 'approved' && <>
                      <button onClick={() => openNoteModal(ev.id, 'unpublished')}
                        style={{ background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        ✕ Unpublish
                      </button>
                      <button onClick={() => deleteEvent(ev.id)}
                        style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        🗑 Delete permanently
                      </button>
                    </>}
                    {filter === 'unpublished' && <>
                      <button onClick={() => updateStatus(ev.id, 'approved')}
                        style={{ background: '#16803c', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        ✓ Re-publish
                      </button>
                      <button onClick={() => openNoteModal(ev.id, 'rejected')}
                        style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        ✕ Reject
                      </button>
                      <button onClick={() => deleteEvent(ev.id)}
                        style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>
                        🗑 Delete permanently
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