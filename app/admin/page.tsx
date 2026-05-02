'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'

export default function Admin() {
  const router = useRouter()
  const [events, setEvents] = useState<any[]>([])
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState<'events' | 'volunteering' | 'organizations'>('events')
  const [eventFilter, setEventFilter] = useState('pending')
  const [volFilter, setVolFilter] = useState('pending')
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
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [filterOrg, setFilterOrg] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [orgEventCounts, setOrgEventCounts] = useState<Record<string, number>>({})
  const [messageModal, setMessageModal] = useState<any>(null)
  const [messageSubject, setMessageSubject] = useState('')
  const [messageBody, setMessageBody] = useState('')
  const [messageSending, setMessageSending] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [approvedEvents, setApprovedEvents] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [pendingEventCount, setPendingEventCount] = useState(0)
  const [pendingVolCount, setPendingVolCount] = useState(0)
  const [editingOpp, setEditingOpp] = useState<any>(null)
  const [adminRole, setAdminRole] = useState<'super_admin' | 'regional_admin' | null>(null)
  const [adminTowns, setAdminTowns] = useState<string[] | null>(null)
  const isSuperAdmin = adminRole === 'super_admin'
  const [selectedTown, setSelectedTown] = useState<string | null>(null)
  const [allTowns, setAllTowns] = useState<string[]>([])
  const [unverifiedOrgs, setUnverifiedOrgs] = useState<any[]>([])

  const TIME_OPTIONS = ['12:00 AM','12:30 AM','1:00 AM','1:30 AM','2:00 AM','2:30 AM','3:00 AM','3:30 AM','4:00 AM','4:30 AM','5:00 AM','5:30 AM','6:00 AM','6:30 AM','7:00 AM','7:30 AM','8:00 AM','8:30 AM','9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','12:30 PM','1:00 PM','1:30 PM','2:00 PM','2:30 PM','3:00 PM','3:30 PM','4:00 PM','4:30 PM','5:00 PM','5:30 PM','6:00 PM','6:30 PM','7:00 PM','7:30 PM','8:00 PM','8:30 PM','9:00 PM','9:30 PM','10:00 PM','10:30 PM','11:00 PM','11:30 PM']

  function similarityScore(a: string, b: string): number {
    a = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    b = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
    if (a === b) return 1
    const aWords = new Set(a.split(' ').filter(w => w.length > 2))
    const bWords = new Set(b.split(' ').filter(w => w.length > 2))
    if (aWords.size === 0 || bWords.size === 0) return 0
    let matches = 0
    aWords.forEach(w => { if (bWords.has(w)) matches++ })
    return matches / Math.max(aWords.size, bWords.size)
  }

  function findPossibleDuplicates(ev: any): any[] {
    return approvedEvents.filter(approved =>
      approved.date === ev.date && approved.id !== ev.id &&
      similarityScore(approved.title, ev.title) >= 0.5
    )
  }

  useEffect(() => { checkSession() }, [])

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: adminData } = await supabase
        .from('admins').select('role, towns').eq('email', session.user.email).single()
      if (adminData) {
        setAdminRole(adminData.role)
        setAdminTowns(adminData.towns)
        if (adminData.towns?.length === 1) setSelectedTown(adminData.towns[0])
        setAuthed(true)
        if (adminData.role === 'super_admin') {
          const { data: townData } = await supabase.from('events').select('town').not('town', 'is', null)
          if (townData) {
            const unique = [...new Set(townData.map((t: any) => t.town).filter(Boolean))].sort()
            setAllTowns(unique as string[])
          }
        }
      }
    }
    setAuthLoading(false)
  }

  useEffect(() => { if (authed) loadPendingCounts() }, [authed, selectedTown])

  useEffect(() => {
    if (!authed) return
    if (section === 'events') { loadEvents(); setSelected(new Set()); setFilterDate(''); setFilterOrg(''); setFilterCategory('') }
    else if (section === 'volunteering') loadOpportunities()
    else if (section === 'organizations') loadOrgs()
  }, [section, authed, selectedTown])

  useEffect(() => { if (authed && section === 'events') { loadEvents(); setSelected(new Set()); setFilterDate(''); setFilterOrg(''); setFilterCategory('') } }, [eventFilter])
  useEffect(() => { if (authed && section === 'volunteering') loadOpportunities() }, [volFilter])

  async function loadPendingCounts() {
    const { count: evCount } = await applyTownFilter(
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    )
    setPendingEventCount(evCount || 0)
    const { count: volCount } = await supabase
      .from('opportunities').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    setPendingVolCount(volCount || 0)
  }

  async function handleLogin() {
    if (!email || !password) { setLoginError('Please enter your email and password.'); return }
    setLoginLoading(true); setLoginError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.user) { setLoginError('Invalid email or password.'); setLoginLoading(false); return }
    const { data: adminData } = await supabase
      .from('admins').select('role, towns').eq('email', data.user.email).single()
    if (!adminData) {
      await supabase.auth.signOut()
      setLoginError('You do not have admin access.')
      setLoginLoading(false); return
    }
    setAdminRole(adminData.role); setAdminTowns(adminData.towns)
    if (adminData.towns?.length === 1) setSelectedTown(adminData.towns[0])
    setAuthed(true); setLoginLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setAuthed(false); setAdminRole(null); setAdminTowns(null); setSelectedTown(null)
    setEmail(''); setPassword('')
  }

  function applyTownFilter(query: any) {
    if (isSuperAdmin && !selectedTown) return query
    if (selectedTown) return query.eq('town', selectedTown)
    if (adminTowns?.length) return query.in('town', adminTowns)
    return query
  }

  async function loadEvents() {
    setLoading(true)
    const { data, error } = await applyTownFilter(
      supabase.from('events').select('*').eq('status', eventFilter)
        .order('date', { ascending: true }).order('time', { ascending: true })
    )
    if (!error) setEvents(data || [])
    const { data: approved } = await applyTownFilter(
      supabase.from('events').select('id, title, date, time, organization, website').eq('status', 'approved')
    )
    setApprovedEvents(approved || [])
    setLoading(false)
  }

  async function loadOpportunities() {
    setLoading(true)
    const { data, error } = await supabase
      .from('opportunities').select('*').eq('status', volFilter)
      .order('created_at', { ascending: false })
    if (!error) setOpportunities(data || [])
    setLoading(false)
  }

  async function updateOpportunityStatus(id: number, status: string) {
    const { error } = await supabase.from('opportunities').update({ status }).eq('id', id)
    if (!error) { setOpportunities(prev => prev.filter(o => o.id !== id)); loadPendingCounts() }
  }

  async function deleteOpportunity(id: number) {
    if (!confirm('Permanently delete this opportunity?')) return
    const { error } = await supabase.from('opportunities').delete().eq('id', id)
    if (!error) setOpportunities(prev => prev.filter(o => o.id !== id))
  }

  async function saveOppEdit() {
    if (!editingOpp) return
    const { error } = await supabase.from('opportunities').update({
      title: editingOpp.title, description: editingOpp.description,
      category: editingOpp.category, contact_name: editingOpp.contact_name,
      contact_email: editingOpp.contact_email, contact_phone: editingOpp.contact_phone,
      organization: editingOpp.organization, website: editingOpp.website,
    }).eq('id', editingOpp.id)
    if (!error) { setOpportunities(prev => prev.map(o => o.id === editingOpp.id ? editingOpp : o)); setEditingOpp(null) }
  }

  async function loadOrgs() {
    setLoading(true)
    const { data: unverified } = await applyTownFilter(
      supabase.from('organizations').select('name').eq('verified', false).not('user_id', 'is', null)
    )
    setUnverifiedOrgs(unverified || [])
    const { data, error } = await applyTownFilter(
      supabase.from('organizations').select('*').order('name', { ascending: true })
    )
    if (!error && data) {
      setOrgs(data)
      const { data: eventData } = await applyTownFilter(
        supabase.from('events').select('organization').eq('status', 'approved')
      )
      if (eventData) {
        const counts: Record<string, number> = {}
        for (const org of data) {
          counts[org.id] = eventData.filter((e: any) =>
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingOrg.id, name: editingOrg.name, originalName: originalOrg?.name }),
      })
      const data = await response.json()
      if (!data.error) { setOrgs(prev => prev.map(o => o.id === editingOrg.id ? { ...o, name: editingOrg.name } : o)); setEditingOrg(null); loadOrgs() }
    } catch { console.error('Save org failed') }
    setOrgSaving(false)
  }

  async function toggleVerify(org: any) {
    const newVerified = !org.verified
    const res = await fetch('/api/verify-org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: org.id, verified: newVerified, orgName: org.name })
    })
    if (res.ok) {
      setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, verified: newVerified } : o))
      setUnverifiedOrgs(prev => prev.filter(o => o.name !== org.name))
    }
  }

  async function toggleAggregator(org: any) {
    const newVal = !org.is_aggregator
    await supabase.from('organizations').update({ is_aggregator: newVal }).eq('id', org.id)
    await supabase.from('events').update({ is_aggregator: newVal }).eq('organization', org.name)
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, is_aggregator: newVal } : o))
  }

  async function handleSendMessage() {
    if (!messageSubject || !messageBody) return
    setMessageSending(true)
    const recipients = messageModal.all ? orgs.filter(o => o.email) : [messageModal]
    for (const org of recipients) {
      await fetch('/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: org.email, subject: messageSubject,
          html: `<p>Hi ${org.name},</p>${messageBody.split('\n').map((l: string) => `<p>${l}</p>`).join('')}<p>— The Townstir Team</p>`,
          replyTo: 'townstir.admin@gmail.com',
        }),
      })
    }
    setMessageSending(false); setMessageSent(true)
    setTimeout(() => { setMessageModal(null); setMessageSubject(''); setMessageBody(''); setMessageSent(false) }, 2000)
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
          const { data: orgData } = await supabase.from('organizations').select('email').ilike('name', ev.organization).single()
          if (orgData?.email) recipientEmail = orgData.email
        }
        if (recipientEmail) {
          let subject = '', html = ''
          if (status === 'approved') {
            subject = `Your event is live: ${ev.title}`
            html = `<p>Great news!</p><p>Your event <strong>${ev.title}</strong> on <strong>${ev.date}</strong> has been approved and is now live on the Townstir calendar.</p><p><a href="https://www.townstir.com/event/${ev.id}">View your event →</a></p><p>— The Townstir Team</p>`
          } else if (status === 'rejected') {
            subject = `Update on your event: ${ev.title}`
            html = `<p>Hi there,</p><p>Unfortunately your event <strong>${ev.title}</strong> on <strong>${ev.date}</strong> was not approved for the Townstir calendar.</p>${note ? `<p><strong>Note from admin:</strong> ${note}</p>` : ''}<p>You're welcome to make changes and resubmit at <a href="https://www.townstir.com/post-event">townstir.com/post-event</a>.</p><p>— The Townstir Team</p>`
          } else if (status === 'unpublished') {
            subject = `Your event has been unpublished: ${ev.title}`
            html = `<p>Hi there,</p><p>Your event <strong>${ev.title}</strong> on <strong>${ev.date}</strong> has been temporarily unpublished from the Townstir calendar.</p>${note ? `<p><strong>Note from admin:</strong> ${note}</p>` : ''}<p>Please log in to your dashboard to make any needed updates.</p><p>— The Townstir Team</p>`
          }
          if (subject) await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: recipientEmail, subject, html, replyTo: 'townstir.admin@gmail.com' }) })
        }
      }
      setEvents(prev => prev.filter(ev => ev.id !== id))
      loadPendingCounts()
    }
  }

  async function handleNoteConfirm() {
    if (!noteModal) return
    await updateStatus(noteModal.eventId, noteModal.action, noteText)
    setNoteModal(null); setNoteText('')
  }

  function openNoteModal(eventId: number, action: 'unpublished' | 'rejected') {
    setNoteText(''); setNoteModal({ eventId, action })
  }

  async function deleteEvent(id: number) {
    if (!confirm('Are you sure you want to permanently delete this event?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (!error) setEvents(prev => prev.filter(ev => ev.id !== id))
  }

  function toggleSelect(id: number) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function toggleSelectAll() {
    if (selected.size === events.length) setSelected(new Set())
    else setSelected(new Set(events.map(ev => ev.id)))
  }

  async function duplicateEvent(ev: any) {
    const { data, error } = await supabase.from('events').insert([{
      title: ev.title + ' (Copy)',
      date: ev.date,
      time: ev.time,
      end_time: ev.end_time || null,
      location: ev.location,
      address: ev.address || '',
      organization: ev.organization,
      category: ev.category || '',
      tags: ev.tags || '',
      cost: ev.cost || '',
      age: ev.age || '',
      description: ev.description || '',
      email: ev.email || '',
      website: ev.website || '',
      image_url: ev.image_url || null,
      town: ev.town || 'Mill Valley',
      status: 'approved',
    }]).select().single()
    if (!error && data) {
      setEvents(prev => [...prev, data].sort((a, b) => a.date.localeCompare(b.date)))
      setEditingEvent(data)
    } else {
      console.error('Duplicate failed:', error)
    }
  }

  async function bulkApprove() {
    if (selected.size === 0 || !confirm(`Approve ${selected.size} events?`)) return
    setBulkWorking(true)
    const { error } = await supabase.from('events').update({ status: 'approved' }).in('id', Array.from(selected))
    if (!error) { setEvents(prev => prev.filter(ev => !selected.has(ev.id))); setSelected(new Set()); loadPendingCounts() }
    setBulkWorking(false)
  }

  async function bulkReject() {
    if (selected.size === 0 || !confirm(`Reject ${selected.size} events?`)) return
    setBulkWorking(true)
    const { error } = await supabase.from('events').update({ status: 'rejected', rejected_note: null }).in('id', Array.from(selected))
    if (!error) { setEvents(prev => prev.filter(ev => !selected.has(ev.id))); setSelected(new Set()); loadPendingCounts() }
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
    if (!error) { setEvents(prev => prev.map(ev => ev.id === editingEvent.id ? editingEvent : ev)); setEditingEvent(null) }
  }

  const inputStyle = {
    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px',
    padding: '8px 12px', fontFamily: 'sans-serif', fontSize: '13px',
    color: '#1f2937', outline: 'none', background: 'white', marginBottom: '8px'
  }

  const hdrBtn: React.CSSProperties = {
    background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1.5px solid rgba(255,255,255,0.3)',
    padding: '8px 18px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer'
  }

  const secTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '12px 24px', fontSize: '15px',
    color: active ? '#1a3d2b' : '#6b7280', cursor: 'pointer', background: 'none',
    border: 'none', borderBottom: active ? '2px solid #1a3d2b' : '2px solid transparent',
    marginBottom: '-1.5px', fontFamily: 'sans-serif', display: 'inline-flex', alignItems: 'center', gap: '7px'
  })

  const subTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 18px', borderRadius: '999px', border: '1.5px solid',
    borderColor: active ? '#1a3d2b' : '#e5e7eb', background: active ? '#1a3d2b' : 'white',
    color: active ? 'white' : '#6b7280', fontWeight: active ? 600 : 400,
    fontSize: '13px', cursor: 'pointer', fontFamily: 'sans-serif'
  })

  if (authLoading) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>Loading…</div>
  )

  if (editingEvent) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>
      <header style={{ background: '#1a3d2b', padding: '14px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
          <span style={{ color: '#7EC8A4', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', fontWeight: 400 }}>stir</span>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginLeft: '12px' }}>Edit Event</span>
        </div>
        <button onClick={() => setEditingEvent(null)} style={hdrBtn}>← Back</button>
      </header>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '24px', fontWeight: 900, color: '#1f2937', marginBottom: '24px' }}>Edit Event</h1>
        {[
          { label: 'Title', key: 'title', type: 'text' },
          { label: 'Location', key: 'location', type: 'text' },
          { label: 'Address', key: 'address', type: 'text' },
          { label: 'Organization', key: 'organization', type: 'text' },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</label>
            <input style={inputStyle} type={type} value={editingEvent[key] || ''} onChange={e => setEditingEvent({ ...editingEvent, [key]: e.target.value })} />
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Date</label>
            <input style={inputStyle} type="date" value={editingEvent.date || ''} onChange={e => setEditingEvent({ ...editingEvent, date: e.target.value })} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Time</label>
            <select style={inputStyle} value={editingEvent.time || ''} onChange={e => setEditingEvent({ ...editingEvent, time: e.target.value })}>
              <option value=''>Select time</option>
              {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {[{ label: 'Cost', key: 'cost', type: 'text' }, { label: 'Age', key: 'age', type: 'text' }, { label: 'Email', key: 'email', type: 'text' }, { label: 'Website', key: 'website', type: 'text' }].map(({ label, key, type }) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</label>
              <input style={inputStyle} type={type} value={editingEvent[key] || ''} onChange={e => setEditingEvent({ ...editingEvent, [key]: e.target.value })} />
            </div>
          ))}
        </div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Category</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {['outdoors','arts','food','community','family','classes','gov'].map(cat => {
            const active = (editingEvent.category || '').split(',').map((c: string) => c.trim()).includes(cat)
            return <button key={cat} type="button" onClick={() => { const cur = (editingEvent.category || '').split(',').map((c: string) => c.trim()).filter(Boolean); setEditingEvent({ ...editingEvent, category: (active ? cur.filter((c: string) => c !== cat) : [...cur, cat]).join(',') }) }} style={{ padding: '7px 14px', borderRadius: '999px', border: '1.5px solid', borderColor: active ? '#1a3d2b' : '#e5e7eb', background: active ? '#1a3d2b' : 'white', color: active ? 'white' : '#6b7280', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>{cat}</button>
          })}
        </div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Tags</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {[{ value: 'free', label: 'Free' }, { value: 'family', label: 'Family-Friendly' }, { value: 'wellness', label: 'Wellness' }, { value: 'reg', label: 'Reg. Required' }, { value: 'music', label: 'Live Music' }, { value: 'volunteer', label: 'Volunteer' }].map(({ value: tag, label: tagLabel }) => {
            const active = (editingEvent.tags || '').split(',').map((t: string) => t.trim()).includes(tag)
            return <button key={tag} type="button" onClick={() => { const cur = (editingEvent.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean); setEditingEvent({ ...editingEvent, tags: (active ? cur.filter((t: string) => t !== tag) : [...cur, tag]).join(',') }) }} style={{ padding: '7px 14px', borderRadius: '999px', border: '1.5px solid', borderColor: active ? '#10b981' : '#e5e7eb', background: active ? '#10b981' : 'white', color: active ? 'white' : '#6b7280', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>{tagLabel}</button>
          })}
        </div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Description</label>
        <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} value={editingEvent.description || ''} onChange={e => setEditingEvent({ ...editingEvent, description: e.target.value })} />
        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={saveEdit} disabled={saving} style={{ flex: 1, background: '#1a3d2b', color: 'white', border: 'none', padding: '12px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving…' : '✓ Save Changes'}</button>
          <button onClick={() => setEditingEvent(null)} style={{ padding: '12px 24px', background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  )

  if (!authed) return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '40px', width: '360px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: '24px', color: '#1a3d2b' }}>town</span>
          <span style={{ color: '#7EC8A4', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', fontWeight: 400 }}>stir</span>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>Admin Access</p>
        </div>
        {loginError && <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>⚠️ {loginError}</div>}
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com"
          style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as const }} />
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Password</label>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} placeholder="Password"
            style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 44px 10px 14px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }} />
          <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#9ca3af', padding: '0' }}>{showPassword ? '🙈' : '👁️'}</button>
        </div>
        <button onClick={handleLogin} disabled={loginLoading} style={{ width: '100%', background: '#1a3d2b', color: 'white', border: 'none', padding: '12px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: loginLoading ? 'not-allowed' : 'pointer', opacity: loginLoading ? 0.7 : 1 }}>{loginLoading ? 'Logging in…' : 'Log In →'}</button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>

      {noteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '6px' }}>{noteModal.action === 'unpublished' ? '✕ Unpublish Event' : '✕ Reject Event'}</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>Optionally add a note for the org explaining why.</p>
            <textarea placeholder="e.g. Please update the event date and resubmit." value={noteText} onChange={e => setNoteText(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'sans-serif', outline: 'none', minHeight: '90px', resize: 'vertical', boxSizing: 'border-box' as const, marginBottom: '16px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setNoteModal(null); setNoteText('') }} style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleNoteConfirm} style={{ flex: 2, background: noteModal.action === 'unpublished' ? '#6b7280' : '#dc2626', color: 'white', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{noteModal.action === 'unpublished' ? 'Confirm Unpublish' : 'Confirm Reject'}</button>
            </div>
          </div>
        </div>
      )}

      {messageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>✉️ {messageModal.all ? `Message All Orgs (${orgs.filter(o => o.email).length})` : `Message ${messageModal.name}`}</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px' }}>{messageModal.all ? 'Sends to all orgs with an email address.' : `To: ${messageModal.email}`}</p>
            {messageSent ? <div style={{ textAlign: 'center', padding: '20px', fontSize: '15px', color: '#16803c', fontWeight: 700 }}>✅ Message sent!</div> : (
              <>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Subject</label>
                <input style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' as const }} placeholder="e.g. Welcome to Townstir!" value={messageSubject} onChange={e => setMessageSubject(e.target.value)} />
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Message</label>
                <textarea placeholder="Write your message here…" value={messageBody} onChange={e => setMessageBody(e.target.value)} style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', fontFamily: 'sans-serif', outline: 'none', minHeight: '120px', resize: 'vertical', boxSizing: 'border-box' as const, marginBottom: '16px' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => { setMessageModal(null); setMessageSubject(''); setMessageBody('') }} style={{ flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleSendMessage} disabled={messageSending || !messageSubject || !messageBody} style={{ flex: 2, background: '#1a3d2b', color: 'white', border: 'none', padding: '11px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: messageSending ? 'not-allowed' : 'pointer', opacity: messageSending || !messageSubject || !messageBody ? 0.7 : 1 }}>{messageSending ? 'Sending…' : 'Send Message'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <header style={{ background: '#1a3d2b', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
            <span style={{ color: '#7EC8A4', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', fontWeight: 400 }}>stir</span>
          </div>
          {isSuperAdmin ? (
            <select value={selectedTown || ''} onChange={e => setSelectedTown(e.target.value || null)}
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.9)', borderRadius: '6px', padding: '5px 10px', fontSize: '13px', fontFamily: 'sans-serif', cursor: 'pointer', outline: 'none' }}>
              <option value=''>All Towns</option>
              {allTowns.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>{selectedTown || adminTowns?.join(', ')}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/admin/import')} style={hdrBtn}>⬇ Import Events</button>
          <button onClick={() => router.push('/')} style={hdrBtn}>← Calendar</button>
          <button onClick={handleLogout} style={hdrBtn}>Log Out</button>
        </div>
      </header>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: 900, color: '#1f2937', marginBottom: '20px' }}>Admin</h1>

        <div style={{ display: 'flex', borderBottom: '1.5px solid #d1d5db', marginBottom: '24px' }}>
          <button style={secTabStyle(section === 'events')} onClick={() => setSection('events')}>
            Events
            {pendingEventCount > 0 && <span style={{ background: '#C9952A', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px' }}>{pendingEventCount}</span>}
          </button>
          <button style={secTabStyle(section === 'volunteering')} onClick={() => setSection('volunteering')}>
            Volunteering
            {pendingVolCount > 0 && <span style={{ background: '#1a3d2b', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.3)' }}>{pendingVolCount}</span>}
          </button>
          <button style={secTabStyle(section === 'organizations')} onClick={() => setSection('organizations')}>
            Organizations
            {unverifiedOrgs.length > 0 && <span style={{ background: '#C9952A', color: 'white', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px' }}>{unverifiedOrgs.length} unverified</span>}
          </button>
          <button style={{ ...secTabStyle(false), color: '#c4c9d1', cursor: 'default' }}>Local Sports</button>
        </div>

        {section === 'events' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {['pending', 'approved', 'unpublished', 'rejected'].map(s => (
                <button key={s} style={subTabStyle(eventFilter === s)} onClick={() => setEventFilter(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px 20px', marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', outline: 'none', color: '#374151' }} />
              <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} style={{ border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', outline: 'none', color: '#374151', background: 'white' }}>
                <option value=''>All Orgs</option>
                {[...new Set(events.map(ev => ev.organization).filter(Boolean))].sort().map(org => <option key={org} value={org}>{org}</option>)}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', outline: 'none', color: '#374151', background: 'white' }}>
                <option value=''>All Categories</option>
                <option value='outdoors'>Outdoors, Sports & Movement</option>
                <option value='arts'>Arts & Performances</option>
                <option value='food'>Food, Drink & Social</option>
                <option value='community'>Community</option>
                <option value='family'>Family & Youth</option>
                <option value='classes'>Classes & Lectures</option>
                <option value='gov'>Local Government</option>
              </select>
              {(filterOrg || filterCategory || filterDate) && (
                <button onClick={() => { setFilterOrg(''); setFilterCategory(''); setFilterDate('') }} style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>✕ Clear</button>
              )}
            </div>
            {!loading && events.length > 0 && eventFilter === 'pending' && (
              <div style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '12px', padding: '12px 20px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                  <input type="checkbox" checked={selected.size === events.length && events.length > 0} onChange={toggleSelectAll} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  {selected.size === 0 ? 'Select all' : `${selected.size} of ${events.length} selected`}
                </label>
                {selected.size > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button onClick={bulkApprove} disabled={bulkWorking} style={{ background: '#16803c', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: bulkWorking ? 'not-allowed' : 'pointer', opacity: bulkWorking ? 0.7 : 1 }}>{bulkWorking ? 'Working…' : `✓ Approve ${selected.size}`}</button>
                    <button onClick={bulkReject} disabled={bulkWorking} style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: bulkWorking ? 'not-allowed' : 'pointer', opacity: bulkWorking ? 0.7 : 1 }}>{bulkWorking ? 'Working…' : `✕ Reject ${selected.size}`}</button>
                  </div>
                )}
              </div>
            )}
            {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading…</div>
              : events.length === 0 ? <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>No {eventFilter} events.</div>
              : events.filter(ev => {
                if (filterDate && ev.date !== filterDate) return false
                if (filterOrg && !ev.organization?.toLowerCase().includes(filterOrg.toLowerCase())) return false
                if (filterCategory && !ev.category?.split(',').map((c: string) => c.trim()).includes(filterCategory)) return false
                return true
              }).map(ev => (
                <div key={ev.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${selected.has(ev.id) ? '#1a3d2b' : '#e5e7eb'}` }}>
                  {eventFilter === 'pending' && findPossibleDuplicates(ev).length > 0 && (
                    <div style={{ background: '#fef9c3', border: '1.5px solid #fde68a', borderRadius: '8px', padding: '8px 14px', marginBottom: '12px', fontSize: '12px', color: '#92400e', fontWeight: 600 }}>
                      ⚠️ Possible duplicate of: {findPossibleDuplicates(ev).map(d => `"${d.title}" on ${d.date} at ${d.time} · ${d.organization}`).join(', ')}
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    {eventFilter === 'pending' && <input type="checkbox" checked={selected.has(ev.id)} onChange={() => toggleSelect(ev.id)} style={{ width: '16px', height: '16px', cursor: 'pointer', marginRight: '12px', marginTop: '3px', flexShrink: 0 }} />}
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>{ev.title}</h3>
                      <div style={{ fontSize: '13px', color: '#6b7280' }}>{ev.date} &nbsp;·&nbsp; {ev.time} &nbsp;·&nbsp; {ev.location}</div>
                      <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{ev.organization} &nbsp;·&nbsp; {ev.category}{ev.cost && <>&nbsp;·&nbsp; {ev.cost}</>}</div>
                    </div>
                    <div style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0, marginLeft: '12px' }}>#{ev.id}</div>
                  </div>
                  <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6, marginBottom: '16px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>{ev.description}</p>
                  {ev.unpublished_note && <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px', background: '#f3f4f6', borderRadius: '6px', padding: '8px 12px' }}>💬 <em>Admin note: {ev.unpublished_note}</em></div>}
                  {ev.rejected_note && <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '12px', background: '#fee2e2', borderRadius: '6px', padding: '8px 12px' }}>💬 <em>Admin note: {ev.rejected_note}</em></div>}
                  <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
                    {ev.email && <span>{ev.email}&nbsp;&nbsp;</span>}
                    {ev.website && <span>{ev.website}&nbsp;&nbsp;</span>}
                    {ev.tags && <span>{ev.tags}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {eventFilter === 'pending' && <>
                      <button onClick={() => updateStatus(ev.id, 'approved')} style={{ background: '#16803c', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✓ Approve</button>
                      <button onClick={() => openNoteModal(ev.id, 'rejected')} style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✕ Reject</button>
                    </>}
                    {eventFilter === 'approved' && <>
                      <button onClick={() => openNoteModal(ev.id, 'unpublished')} style={{ background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✕ Unpublish</button>
                      <button onClick={() => deleteEvent(ev.id)} style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Delete permanently</button>
                    </>}
                    {eventFilter === 'unpublished' && <>
                      <button onClick={() => updateStatus(ev.id, 'approved')} style={{ background: '#16803c', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✓ Re-publish</button>
                      <button onClick={() => openNoteModal(ev.id, 'rejected')} style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✕ Reject</button>
                      <button onClick={() => deleteEvent(ev.id)} style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>🗑 Delete permanently</button>
                    </>}
                    {eventFilter === 'rejected' && <>
                      <button onClick={() => updateStatus(ev.id, 'approved')} style={{ background: '#16803c', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✓ Approve anyway</button>
                      <button onClick={() => deleteEvent(ev.id)} style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>🗑 Delete permanently</button>
                    </>}
                    <button onClick={() => setEditingEvent(ev)} style={{ background: 'white', color: '#1a3d2b', border: '1.5px solid #1a3d2b', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => duplicateEvent(ev)} style={{ background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Duplicate</button>
                  </div>
                </div>
              ))}
          </>
        )}

        {section === 'volunteering' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {['pending', 'approved', 'rejected'].map(s => (
                <button key={s} style={subTabStyle(volFilter === s)} onClick={() => setVolFilter(s)}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading…</div>
              : opportunities.length === 0
              ? <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>No {volFilter} opportunities.</div>
              : opportunities.map(opp => (
                <div key={opp.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: '4px solid #e5e7eb' }}>
                  {editingOpp?.id === opp.id ? (
                    <div>
                      {[
                        { label: 'Title', key: 'title' }, { label: 'Organization', key: 'organization' },
                        { label: 'Contact Name', key: 'contact_name' }, { label: 'Contact Email', key: 'contact_email' },
                        { label: 'Contact Phone', key: 'contact_phone' }, { label: 'Website', key: 'website' },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>{label}</label>
                          <input style={inputStyle} value={(editingOpp as any)[key] || ''} onChange={e => setEditingOpp({ ...editingOpp, [key]: e.target.value })} />
                        </div>
                      ))}
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Description</label>
                      <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} value={editingOpp.description || ''} onChange={e => setEditingOpp({ ...editingOpp, description: e.target.value })} />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button onClick={saveOppEdit} style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✓ Save</button>
                        <button onClick={() => setEditingOpp(null)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>{opp.title}</h3>
                          <div style={{ fontSize: '13px', color: '#6b7280' }}>
                            {opp.organization || 'Community Member'} &nbsp;·&nbsp; {opp.category}
                            {opp.is_student_opportunity && <span style={{ marginLeft: '8px', background: '#fef3c7', color: '#92400e', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>Student</span>}
                          </div>
                        </div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0, marginLeft: '12px' }}>#{opp.id}</div>
                      </div>
                      <p style={{ fontSize: '13px', color: '#4b5563', lineHeight: 1.6, marginBottom: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>{opp.description}</p>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '16px' }}>
                        {opp.contact_name && <span>{opp.contact_name}&nbsp;&nbsp;</span>}
                        {opp.contact_email && <span>{opp.contact_email}&nbsp;&nbsp;</span>}
                        {opp.contact_phone && <span>{opp.contact_phone}</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {volFilter === 'pending' && <>
                          <button onClick={() => updateOpportunityStatus(opp.id, 'approved')} style={{ background: '#16803c', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✓ Approve</button>
                          <button onClick={() => updateOpportunityStatus(opp.id, 'rejected')} style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✕ Reject</button>
                        </>}
                        {volFilter === 'approved' && (
                          <button onClick={() => updateOpportunityStatus(opp.id, 'rejected')} style={{ background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✕ Unpublish</button>
                        )}
                        {volFilter === 'rejected' && (
                          <button onClick={() => updateOpportunityStatus(opp.id, 'approved')} style={{ background: '#16803c', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>✓ Approve anyway</button>
                        )}
                        <button onClick={() => setEditingOpp({ ...opp })} style={{ background: 'white', color: '#1a3d2b', border: '1.5px solid #1a3d2b', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteOpportunity(opp.id)} style={{ background: 'white', color: '#dc2626', border: '1.5px solid #e5e7eb', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))
            }
          </>
        )}

        {section === 'organizations' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', marginTop: '8px' }}>
              <button onClick={() => router.push('/admin/discover')} style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Discover Orgs</button>
              <button onClick={() => setMessageModal({ all: true })} style={{ background: 'white', color: '#1a3d2b', border: '1.5px solid #1a3d2b', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Message All Orgs</button>
            </div>
            {unverifiedOrgs.length > 0 && (
              <div style={{ background: '#fef9c3', border: '1.5px solid #fde68a', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', fontSize: '13px', color: '#854F0B' }}>
                ⚑ {unverifiedOrgs.map((o: any) => o.name).join(' and ')} need{unverifiedOrgs.length === 1 ? 's' : ''} verification.
              </div>
            )}
            {loading ? <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading…</div>
              : orgs.length === 0 ? <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>No organizations found.</div>
              : orgs.map(org => (
                <div key={org.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${org.verified ? '#16803c' : '#e5e7eb'}` }}>
                  {editingOrg?.id === org.id ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase' as const, letterSpacing: '0.8px' }}>Org Name</label>
                      <input style={{ ...inputStyle, marginBottom: '8px' }} value={editingOrg.name || ''} onChange={e => setEditingOrg({ ...editingOrg, name: e.target.value })} />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={saveOrgEdit} disabled={orgSaving} style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>{orgSaving ? 'Saving…' : '✓ Save'}</button>
                        <button onClick={() => setEditingOrg(null)} style={{ background: '#f3f4f6', color: '#374151', border: 'none', padding: '8px 20px', borderRadius: '999px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937', marginBottom: '4px' }}>
                          {org.name}
                          {org.verified && <span style={{ marginLeft: '8px', background: '#16803c', color: 'white', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>✓ Verified</span>}
                          {org.is_aggregator && <span style={{ marginLeft: '4px', background: '#FAC775', color: '#633806', fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '999px' }}>Aggregator</span>}
                        </h3>
                        <div style={{ fontSize: '13px', color: '#6b7280' }}>{org.email && <>{org.email}</>}{org.website && <>&nbsp;·&nbsp; {org.website}</>}</div>
                        <div style={{ marginTop: '4px' }}>
                          <span onClick={() => { setSection('events'); setEventFilter('approved'); setFilterOrg(org.name) }} style={{ fontSize: '12px', color: orgEventCounts[org.id] > 0 ? '#1a3d2b' : '#9ca3af', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}>
                            {orgEventCounts[org.id] ?? '…'} approved event{orgEventCounts[org.id] !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                        {org.name === 'Sweetwater Music Hall' && (
                          <button onClick={() => router.push('/admin/sweetwater-import')} style={{ background: '#f0fdf4', color: '#16803c', border: '1.5px solid #16803c', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>⬇ Import</button>
                        )}
                        <button onClick={() => window.open(`/org/${encodeURIComponent(org.name.toLowerCase().replace(/ /g, '-'))}`, '_blank')} style={{ background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Preview</button>
                        <button onClick={() => setEditingOrg({ ...org })} style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => { setMessageModal(org); setMessageSubject(''); setMessageBody('') }} style={{ background: 'white', color: '#1a3d2b', border: '1.5px solid #1a3d2b', padding: '9px 22px', borderRadius: '999px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}>Message</button>
                        <button onClick={() => setOpenMenuId(openMenuId === org.id ? null : org.id)} style={{ background: 'white', color: '#6b7280', border: '1px solid #e5e7eb', padding: '9px 14px', borderRadius: '999px', fontWeight: 700, fontSize: '15px', cursor: 'pointer', lineHeight: 1, fontFamily: 'sans-serif' }}>···</button>
                        {openMenuId === org.id && (
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'white', border: '0.5px solid #e5e7eb', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '180px', overflow: 'hidden' }}>
                            <button onClick={() => { toggleVerify(org); setOpenMenuId(null) }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', fontSize: '13px', color: org.verified ? '#dc2626' : '#1f2937', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'sans-serif' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: org.verified ? '#dc2626' : 'transparent', border: org.verified ? 'none' : '1px solid #d1d5db', display: 'inline-block' }} />
                              {org.verified ? 'Remove verification' : 'Verify org'}
                            </button>
                            <div style={{ height: '0.5px', background: '#f3f4f6', margin: '2px 0' }} />
                            <button onClick={() => { toggleAggregator(org); setOpenMenuId(null) }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', fontSize: '13px', color: org.is_aggregator ? '#854F0B' : '#1f2937', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'sans-serif' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: org.is_aggregator ? '#854F0B' : 'transparent', border: org.is_aggregator ? 'none' : '1px solid #d1d5db', display: 'inline-block' }} />
                              {org.is_aggregator ? 'Remove Aggregator' : 'Mark as Aggregator'}
                            </button>
                            <div style={{ height: '0.5px', background: '#f3f4f6', margin: '2px 0' }} />
                            <button onClick={async () => {
                              if (!confirm(`Permanently delete ${org.name}? This cannot be undone.`)) return
                              const res = await fetch('/api/delete-org', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: org.id })
                              })
                              if (res.ok) { setOrgs(prev => prev.filter(o => o.id !== org.id)); setOpenMenuId(null) }
                            }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', fontSize: '13px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'sans-serif' }}>
                              Delete org
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            }
          </>
        )}
      </div>
    </div>
  )
}