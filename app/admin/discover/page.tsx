'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminHeader } from '../../components/Header'

export default function DiscoverOrgs() {
  const router = useRouter()
  const [town, setTown] = useState('Mill Valley')
  const [state, setState] = useState('CA')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [error, setError] = useState('')

  async function handleDiscover() {
    setLoading(true)
    setError('')
    setResults(null)
    try {
      const res = await fetch('/api/discover-orgs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ town, state })
      })
      const data = await res.json()
      if (data.error) setError(data.error)
      else setResults(data)
    } catch {
      setError('Discovery failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2f3f5', fontFamily: 'sans-serif' }}>
      <AdminHeader
        rightSlot={
          <button onClick={() => router.push('/admin')}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer' }}>
            ← Admin
          </button>
        }
      />

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '40px 24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, color: '#1f2937', marginBottom: '6px' }}>
          Org Discovery Agent
        </h1>
        <p className="text-muted" style={{ fontSize: '14px', marginBottom: '32px' }}>
          Enter a town to discover local organizations that likely host community events.
        </p>

        {/* Input */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1.5px solid #e5e7eb', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Town
            </label>
            <input
              value={town}
              onChange={e => setTown(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
              placeholder="e.g. Mill Valley"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              State
            </label>
            <input
              value={state}
              onChange={e => setState(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
              placeholder="CA"
            />
          </div>
          <button
            onClick={handleDiscover}
            disabled={loading}
            style={{ background: '#1a3d2b', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            {loading ? 'Discovering…' : '🔍 Discover Orgs'}
          </button>
        </div>

        {loading && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '40px', textAlign: 'center', border: '1.5px solid #e5e7eb' }}>
            <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>Searching Google Places and assessing orgs with Claude…</p>
            <p className="text-muted" style={{ fontSize: '12px' }}>This takes about 30-60 seconds</p>
          </div>
        )}

        {error && (
          <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
            ⚠️ {error}
          </div>
        )}

        {results && (
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
              <span style={{ fontSize: '15px', fontWeight: 500, color: '#1f2937' }}>
                Found {results.orgs_with_events} orgs likely to have events
              </span>
              <span className="text-muted" style={{ fontSize: '12px' }}>
                out of {results.total_found} places searched in {results.town}
              </span>
            </div>

            {results.orgs.map((org: any, i: number) => (
              <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '16px 20px', marginBottom: '8px', border: '1.5px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 500, color: '#1f2937', marginBottom: '3px' }}>
                      {org.name}
                    </div>
                    <div className="text-muted" style={{ fontSize: '12px', marginBottom: '4px' }}>
                      {org.address}
                    </div>
                    {org.website && (
                      <a href={org.website} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: '#3a7d44', textDecoration: 'none' }}>
                        {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    )}
                    {org.reason && (
                      <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', fontStyle: 'italic' }}>
                        {org.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', maxWidth: '200px', justifyContent: 'flex-end' }}>
                    {org.categories.split(',').map((cat: string) => (
                      <span key={cat} style={{ background: '#f0fdf4', color: '#16803c', fontSize: '11px', padding: '2px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>
                        {cat.trim()}
                      </span>
                    ))}
                  </div>
                </div>
                {org.phone && (
                  <div className="text-muted" style={{ fontSize: '12px', marginTop: '6px' }}>
                    {org.phone}
                  </div>
                )}
              </div>
            ))}

            <div style={{ marginTop: '20px', padding: '16px 20px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <p style={{ fontSize: '13px', color: '#16803c', fontWeight: 500, marginBottom: '4px' }}>Next steps</p>
              <p style={{ fontSize: '12px', color: '#6b7280' }}>
                Review this list and visit each website to look for iCal feeds. Add any feeds you find to the iCal feeds table in Supabase. In a future session we'll automate this step too.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}