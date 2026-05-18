'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'

const EMPTY_TOWN = {
  name: '',
  slug: '',
  state: 'CA',
  county: 'Marin',
  tagline: '',
  header_color: '#1a3d2b',
  accent_color: '#C9952A',
  lat: '',
  lng: '',
  radius: '5',
  active: true,
}

export default function AdminTowns() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [towns, setTowns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingTown, setEditingTown] = useState<any>(null)
  const [form, setForm] = useState({ ...EMPTY_TOWN })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { checkSession() }, [])

  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email) {
      const { data: adminData } = await supabase
        .from('admins').select('role').eq('email', session.user.email).single()
      if (adminData?.role === 'super_admin') {
        setAuthed(true)
        loadTowns()
      }
    }
    setAuthLoading(false)
  }

  async function loadTowns() {
    setLoading(true)
    const { data } = await supabase
      .from('towns')
      .select('*')
      .order('name')
    if (data) setTowns(data)
    setLoading(false)
  }

  function update(field: string, value: any) {
    setForm(prev => {
      const updated = { ...prev, [field]: value }
      // Auto-generate slug from name
      if (field === 'name') {
        updated.slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        // Auto-generate tagline if not manually set
        if (!prev.tagline || prev.tagline === `Events and happenings in ${prev.name}, ${prev.state}`) {
          updated.tagline = `Events and happenings in ${value}, ${updated.state}`
        }
      }
      return updated
    })
  }

  function openAdd() {
    setForm({ ...EMPTY_TOWN })
    setEditingTown(null)
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  function openEdit(town: any) {
    setForm({
      name: town.name || '',
      slug: town.slug || '',
      state: town.state || 'CA',
      county: town.county || '',
      tagline: town.tagline || '',
      header_color: town.header_color || '#1a3d2b',
      accent_color: town.accent_color || '#C9952A',
      lat: town.lat ? String(town.lat) : '',
      lng: town.lng ? String(town.lng) : '',
      radius: town.radius ? String(town.radius) : '5',
      active: town.active !== false,
    })
    setEditingTown(town)
    setShowForm(true)
    setError('')
    setSuccess('')
  }

  async function handleSave() {
    if (!form.name || !form.slug) {
      setError('Name and slug are required.')
      return
    }
    setSaving(true)
    setError('')

    const res = await fetch('/api/add-town', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: editingTown ? 'update' : 'add',
        town: editingTown ? { ...form, id: editingTown.id } : form,
      }),
    })

    const data = await res.json()
    setSaving(false)

    if (data.error) {
      setError(data.error)
      return
    }

    setSuccess(editingTown ? `${form.name} updated.` : `${form.name} added successfully!`)
    setShowForm(false)
    setEditingTown(null)
    loadTowns()
  }

  async function toggleActive(town: any) {
    const res = await fetch('/api/add-town', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle', town: { id: town.id, active: !town.active } }),
    })
    if (res.ok) {
      setTowns(prev => prev.map(t => t.id === town.id ? { ...t, active: !t.active } : t))
    }
  }

  const inputStyle = {
    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px',
    padding: '8px 12px', fontFamily: 'sans-serif', fontSize: '13px',
    color: '#1f2937', outline: 'none', background: 'white', marginBottom: '8px',
    boxSizing: 'border-box' as const,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700,
    color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px',
  }

  const hdrBtn: React.CSSProperties = {
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    border: '1.5px solid rgba(255,255,255,0.3)',
    padding: '8px 18px', borderRadius: '999px', fontWeight: 600,
    fontSize: '13px', cursor: 'pointer',
  }

  if (authLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      Loading…
    </div>
  )

  if (!authed) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#6b7280', marginBottom: '16px' }}>Super admin access required.</p>
        <button onClick={() => router.push('/admin')}
          style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '999px', fontSize: '14px', cursor: 'pointer' }}>
          ← Back to Admin
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>

      <header style={{ background: '#1a3d2b', padding: '0 24px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div>
            <span style={{ fontWeight: 800, fontSize: '22px', color: 'white', letterSpacing: '-1px' }}>town</span>
            <span style={{ color: '#7EC8A4', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '22px', fontWeight: 400 }}>stir</span>
          </div>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Towns</span>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/admin')} style={hdrBtn}>← Admin</button>
        </div>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px 80px' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: 900, color: '#1f2937' }}>Manage Towns</h1>
          <button onClick={openAdd}
            style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            + Add Town
          </button>
        </div>

        {success && (
          <div style={{ background: '#f0fdf4', border: '1.5px solid #16803c', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#16803c' }}>
            ✅ {success}
          </div>
        )}

        {/* Add / Edit form */}
        {showForm && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', marginBottom: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.5px solid #e5e7eb' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1f2937', marginBottom: '20px' }}>
              {editingTown ? `Edit ${editingTown.name}` : 'Add New Town'}
            </h2>

            {error && (
              <div style={{ background: '#fee2e2', border: '1.5px solid #dc2626', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Town Name *</label>
                <input style={inputStyle} placeholder="e.g. Fairfax"
                  value={form.name} onChange={e => update('name', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Slug *</label>
                <input style={inputStyle} placeholder="e.g. fairfax"
                  value={form.slug} onChange={e => update('slug', e.target.value)} />
                <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '-4px', marginBottom: '8px' }}>
                  URL: townstir.com/{form.slug || '…'}
                </div>
              </div>
              <div>
                <label style={labelStyle}>State</label>
                <input style={inputStyle} placeholder="CA"
                  value={form.state} onChange={e => update('state', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>County</label>
                <input style={inputStyle} placeholder="e.g. Marin"
                  value={form.county} onChange={e => update('county', e.target.value)} />
              </div>
            </div>

            <label style={labelStyle}>Tagline</label>
            <input style={inputStyle} placeholder={`Events and happenings in ${form.name || 'Town'}, ${form.state}`}
              value={form.tagline} onChange={e => update('tagline', e.target.value)} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Header Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input type="color" value={form.header_color}
                    onChange={e => update('header_color', e.target.value)}
                    style={{ width: '40px', height: '36px', border: '1.5px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', padding: '2px' }} />
                  <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} placeholder="#1a3d2b"
                    value={form.header_color} onChange={e => update('header_color', e.target.value)} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Accent Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input type="color" value={form.accent_color}
                    onChange={e => update('accent_color', e.target.value)}
                    style={{ width: '40px', height: '36px', border: '1.5px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', padding: '2px' }} />
                  <input style={{ ...inputStyle, marginBottom: 0, flex: 1 }} placeholder="#C9952A"
                    value={form.accent_color} onChange={e => update('accent_color', e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Latitude</label>
                <input style={inputStyle} placeholder="e.g. 37.9735"
                  value={form.lat} onChange={e => update('lat', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Longitude</label>
                <input style={inputStyle} placeholder="e.g. -122.5311"
                  value={form.lng} onChange={e => update('lng', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Radius (miles)</label>
                <input style={inputStyle} type="number" min={1} max={50} placeholder="5"
                  value={form.radius} onChange={e => update('radius', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Active</label>
              <button
                onClick={() => update('active', !form.active)}
                style={{
                  width: '44px', height: '24px', borderRadius: '999px', border: 'none',
                  background: form.active ? '#1a3d2b' : '#e5e7eb', cursor: 'pointer',
                  position: 'relative', transition: 'background 0.2s',
                }}>
                <span style={{
                  position: 'absolute', top: '2px',
                  left: form.active ? '22px' : '2px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
              <span style={{ fontSize: '13px', color: '#6b7280' }}>{form.active ? 'Visible in dropdowns' : 'Hidden'}</span>
            </div>

            {/* Color preview */}
            <div style={{ background: form.header_color, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '16px' }}>town</span>
                <span style={{ color: form.accent_color, fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '16px' }}>stir</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', marginLeft: '8px' }}>{form.name || 'Town Name'}</span>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Header preview</span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 1, background: '#1a3d2b', color: 'white', border: 'none', padding: '12px', borderRadius: '999px', fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving…' : editingTown ? '✓ Save Changes' : '✓ Add Town'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingTown(null); setError('') }}
                style={{ padding: '12px 24px', background: 'white', color: '#6b7280', border: '1.5px solid #e5e7eb', borderRadius: '999px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Towns list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>Loading…</div>
        ) : towns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af' }}>No towns yet.</div>
        ) : (
          towns.map(town => (
            <div key={town.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', borderLeft: `4px solid ${town.active ? town.header_color || '#1a3d2b' : '#e5e7eb'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1f2937' }}>{town.name}</h3>
                    <span style={{ fontSize: '12px', color: '#9ca3af' }}>/{town.slug}</span>
                    {!town.active && (
                      <span style={{ background: '#f3f4f6', color: '#9ca3af', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px' }}>INACTIVE</span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px' }}>
                    {town.county && <span style={{ textTransform: 'capitalize' }}>{town.county} County</span>}
                    {town.state && <span> · {town.state}</span>}
                    {town.lat && town.lng && <span> · {town.lat}, {town.lng}</span>}
                  </div>
                  {town.tagline && (
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{town.tagline}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: town.header_color || '#1a3d2b', border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{town.header_color}</span>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: town.accent_color || '#C9952A', border: '1px solid rgba(0,0,0,0.1)' }} />
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>{town.accent_color}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, marginLeft: '16px' }}>
                  <button onClick={() => toggleActive(town)}
                    style={{ background: town.active ? '#f3f4f6' : '#f0fdf4', color: town.active ? '#6b7280' : '#16803c', border: `1.5px solid ${town.active ? '#e5e7eb' : '#16803c'}`, padding: '8px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    {town.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => openEdit(town)}
                    style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}