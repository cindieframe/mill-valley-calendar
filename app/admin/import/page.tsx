'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'
import { AdminHeader } from '../../components/Header'

export default function ImportPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'ai' | 'ical'>('ai')

  const [websiteUrl, setWebsiteUrl] = useState('')
  const [aiOrg, setAiOrg] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<any>(null)
  const [aiError, setAiError] = useState('')

  const [feedUrl, setFeedUrl] = useState('')
  const [icalOrg, setIcalOrg] = useState('')
  const [icalLoading, setIcalLoading] = useState(false)
  const [icalResult, setIcalResult] = useState<any>(null)
  const [icalError, setIcalError] = useState('')

  const [savedSources, setSavedSources] = useState<any[]>([])
  const [savedFeeds, setSavedFeeds] = useState<any[]>([])
  const [reextractingId, setReextractingId] = useState<string | null>(null)
  const [reextractResult, setReextractResult] = useState<any>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { loadSavedSources(); loadSavedFeeds() }, [])

  async function loadSavedSources() {
    const { data } = await supabase
  .from('organizations')
  .select('id, name, website_url, last_extracted_at')
  .not('website_url', 'is', null)
  .order('name')
    if (data) setSavedSources(data)
  }

  async function loadSavedFeeds() {
    const { data } = await supabase
      .from('ical_feeds')
      .select('*')
      .eq('active', true)
      .order('organization')
    if (data) setSavedFeeds(data)
  }

  const inputStyle = {
    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px',
    padding: '10px 14px', fontFamily: 'sans-serif', fontSize: '13px',
    color: '#1f2937', outline: 'none', background: 'white',
    boxSizing: 'border-box' as const,
  }

  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 700, color: '#374151',
    marginBottom: '5px', textTransform: 'uppercase' as const, letterSpacing: '0.8px',
  }

  async function handleAiExtract() {
    if (!websiteUrl || !aiOrg) {
      setAiError('Please enter both a website URL and organization name.')
      return
    }
    setAiLoading(true)
    setAiError('')
    setAiResult(null)
    try {
      const response = await fetch('/api/extract-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteUrl, organization: aiOrg }),
      })
      const data = await response.json()
      if (data.error) {
        setAiError(data.error)
      } else {
        setAiResult(data)
        const { data: orgMatch } = await supabase
          .from('organizations')
          .select('id')
          .ilike('name', aiOrg)
          .single()
        if (orgMatch) {
          await supabase
            .from('organizations')
            .update({ website_url: websiteUrl })
            .eq('id', orgMatch.id)
        } else {
          await supabase
            .from('organizations')
            .insert([{ name: aiOrg, website_url: websiteUrl }])
        }
        loadSavedSources()
      }
    } catch {
      setAiError('Something went wrong. Please try again.')
    }
    setAiLoading(false)
  }

  async function handleReextract(org: any) {
  setReextractingId(org.id)
  setReextractResult(null)
  try {
    const response = await fetch('/api/extract-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl: org.website_url, organization: org.name }),
    })
    const data = await response.json()
    setReextractResult({ orgId: org.id, ...data })
    await supabase
      .from('organizations')
      .update({ last_extracted_at: new Date().toISOString() })
      .eq('id', org.id)
    setSavedSources(prev => prev.map(s =>
      s.id === org.id ? { ...s, last_extracted_at: new Date().toISOString() } : s
    ))
  } catch {
    setReextractResult({ orgId: org.id, error: 'Something went wrong.' })
  }
  setReextractingId(null)
}

  async function handleDeleteSource(org: any) {
    setDeletingId(org.id)
    try {
      const response = await fetch('/api/delete-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: org.id }),
      })
      const data = await response.json()
      if (!data.error) {
        await loadSavedSources()
      }
    } catch {
      console.error('Delete failed')
    }
    setDeletingId(null)
  }

  async function handleIcalImport() {
    if (!feedUrl || !icalOrg) {
      setIcalError('Please enter both a feed URL and organization name.')
      return
    }
    setIcalLoading(true)
    setIcalError('')
    setIcalResult(null)
    try {
      const response = await fetch('/api/import-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl, organization: icalOrg }),
      })
      const data = await response.json()
      if (data.error) {
        setIcalError(data.error)
      } else {
        setIcalResult(data)
        await supabase.from('ical_feeds').upsert([{
          organization: icalOrg,
          url: feedUrl,
          last_synced: new Date().toISOString(),
          active: true,
        }])
        loadSavedFeeds()
      }
    } catch {
      setIcalError('Something went wrong. Please try again.')
    }
    setIcalLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fafaf8', fontFamily: 'sans-serif' }}>

 <AdminHeader
  rightSlot={
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={() => router.push('/admin')}
        style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer' }}>
        ← Moderation Queue
      </button>
      <button onClick={() => router.push('/')}
        style={{ background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', padding: '6px 14px', borderRadius: '999px', fontSize: '12px', cursor: 'pointer' }}>
        Calendar
      </button>
    </div>
  }
/>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: 900, color: '#1f2937', marginBottom: '6px' }}>
          Import Events
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '14px', marginBottom: '28px' }}>
          Add events from any org website or iCal feed. Imported events go to the pending queue for your review.
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', marginBottom: '28px', border: '1.5px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
          <button onClick={() => setTab('ai')}
            style={{ flex: 1, padding: '12px', border: 'none', borderRight: '1.5px solid #e5e7eb', background: tab === 'ai' ? '#1a3d2b' : 'white', color: tab === 'ai' ? 'white' : '#6b7280', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
            AI — Any Website
          </button>
          <button onClick={() => setTab('ical')}
            style={{ flex: 1, padding: '12px', border: 'none', background: tab === 'ical' ? '#1a3d2b' : 'white', color: tab === 'ical' ? 'white' : '#6b7280', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}>
            📅 iCal Feed
          </button>
        </div>

        {/* AI TAB */}
        {tab === 'ai' && (
          <div>
            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: '#166534', lineHeight: 1.6 }}>
              <strong>How this works:</strong> Paste in any org's events page and Claude will read it and pull out all upcoming events automatically. No iCal feed needed.
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Organization Name</label>
              <input style={inputStyle} placeholder="e.g. Depot Bookstore & Cafe"
                value={aiOrg} onChange={e => setAiOrg(e.target.value)} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>Events Page URL</label>
              <input style={inputStyle} placeholder="e.g. https://depotbookstore.com/events"
                value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} />
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>
                Tip: link directly to their /events or /calendar page for best results
              </div>
            </div>

            {aiError && (
              <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
                ⚠️ {aiError}
              </div>
            )}

            <button onClick={handleAiExtract} disabled={aiLoading}
              style={{ width: '100%', background: '#1a3d2b', color: 'white', border: 'none', padding: '14px', borderRadius: '999px', fontSize: '15px', fontWeight: 700, cursor: aiLoading ? 'not-allowed' : 'pointer', opacity: aiLoading ? 0.7 : 1, marginBottom: '28px' }}>
              {aiLoading ? 'Reading page…' : 'Extract Events with AI'}
            </button>

            {aiResult && (
              <div>
                {aiResult.imported > 0 ? (
                  <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '20px', border: '1.5px solid #86efac', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#16803c', marginBottom: '8px' }}>
                      ✅ Done! Imported {aiResult.imported} of {aiResult.total} events
                    </h3>
                    <div style={{ fontSize: '13px', color: '#166534', marginBottom: '12px' }}>
                      {aiResult.skipped} skipped (already exist)
                    </div>
                    {aiResult.feedDetected && (
                      <div style={{ fontSize: '12px', color: '#166534', background: '#dcfce7', borderRadius: '6px', padding: '6px 10px', marginBottom: '10px' }}>
                        📡 iCal feed auto-detected: {aiResult.feedDetected}
                      </div>
                    )}
                    {aiResult.results?.map((r: any, i: number) => (
                      <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', fontSize: '12px' }}>
                        <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '2px' }}>{r.title}</div>
                        <div style={{ color: '#9ca3af' }}>{r.date}{r.time ? ` · ${r.time}` : ''} &nbsp;·&nbsp; 🏷️ {r.categories || 'community'}</div>
                      </div>
                    ))}
                    <button onClick={() => router.push('/admin')}
                      style={{ marginTop: '12px', background: '#1a3d2b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                      Review in Moderation Queue →
                    </button>
                  </div>
                ) : (
                  <div style={{ background: '#fff7ed', borderRadius: '12px', padding: '20px', border: '1.5px solid #fed7aa', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#c2410c', marginBottom: '8px' }}>No new events found</h3>
                    <p style={{ fontSize: '13px', color: '#9a3412', margin: 0 }}>
                      {aiResult.message || 'Try linking directly to their /events or /calendar page.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Saved Sources */}
            {savedSources.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', marginBottom: '12px' }}>
                  🔁 Saved Sources — Re-extract anytime
                </h3>
                {savedSources.map(org => (
                  <div key={org.id} style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937' }}>{org.name}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>{org.website_url}</div>
{org.last_extracted_at && (
  <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
    Last extracted: {new Date(org.last_extracted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
  </div>
)}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleReextract(org)}
                          disabled={reextractingId === org.id}
                          style={{ background: '#1a3d2b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: reextractingId === org.id ? 'not-allowed' : 'pointer', opacity: reextractingId === org.id ? 0.7 : 1, whiteSpace: 'nowrap' as const }}>
                          {reextractingId === org.id ? 'Reading…' : 'Re-extract'}
                        </button>
                        <button
                          onClick={() => handleDeleteSource(org)}
                          disabled={deletingId === org.id}
                          style={{ background: 'white', color: '#dc2626', border: '1.5px solid #dc2626', padding: '8px 16px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, cursor: deletingId === org.id ? 'not-allowed' : 'pointer', opacity: deletingId === org.id ? 0.7 : 1, whiteSpace: 'nowrap' as const }}>
                          {deletingId === org.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                    {reextractResult?.orgId === org.id && (
                      <div style={{ marginTop: '10px', fontSize: '12px', color: reextractResult.error ? '#dc2626' : '#16803c', background: reextractResult.error ? '#fee2e2' : '#f0fdf4', borderRadius: '6px', padding: '8px 12px' }}>
                        {reextractResult.error
                          ? `⚠️ ${reextractResult.error}`
                          : reextractResult.imported > 0
                            ? `✅ Imported ${reextractResult.imported} new events!`
                            : 'No new events found — all up to date!'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ICAL TAB */}
        {tab === 'ical' && (
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', marginBottom: '16px' }}>
              ➕ Add New iCal Feed
            </h3>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Organization</label>
              <input style={inputStyle} placeholder="e.g. Mill Valley Library"
                value={icalOrg} onChange={e => setIcalOrg(e.target.value)} />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>iCal Feed URL</label>
              <input style={inputStyle} placeholder="https://calendar.google.com/calendar/ical/..."
                value={feedUrl} onChange={e => setFeedUrl(e.target.value)} />
              <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>
                Google Calendar: Settings → your calendar → Integrate calendar → copy the iCal link
              </div>
            </div>

            {icalError && (
              <div style={{ background: '#fee2e2', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#dc2626' }}>
                ⚠️ {icalError}
              </div>
            )}

            <button onClick={handleIcalImport} disabled={icalLoading}
              style={{ width: '100%', background: '#1a3d2b', color: 'white', border: 'none', padding: '14px', borderRadius: '999px', fontSize: '15px', fontWeight: 700, cursor: icalLoading ? 'not-allowed' : 'pointer', opacity: icalLoading ? 0.7 : 1, marginBottom: '28px' }}>
              {icalLoading ? 'Importing…' : 'Import iCal Feed'}
            </button>

            {icalResult && (
              <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '20px', border: '1.5px solid #86efac', marginBottom: '28px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#16803c', marginBottom: '12px' }}>✅ Import Complete!</h3>
                <div style={{ fontSize: '14px', color: '#166534', marginBottom: '16px' }}>
                  <strong>{icalResult.imported}</strong> events imported &nbsp;·&nbsp;
                  <strong>{icalResult.skipped}</strong> skipped &nbsp;·&nbsp;
                  <strong>{icalResult.total}</strong> total in feed
                </div>
                {icalResult.results?.map((r: any, i: number) => (
                  <div key={i} style={{ background: 'white', borderRadius: '8px', padding: '10px 14px', marginBottom: '6px', fontSize: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#1f2937', marginBottom: '2px' }}>{r.title}</div>
                    <div style={{ color: '#9ca3af' }}>{r.date} &nbsp;·&nbsp; 🏷️ {r.categories} &nbsp;·&nbsp; {r.tags || 'no tags'}</div>
                  </div>
                ))}
                <button onClick={() => router.push('/admin')}
                  style={{ marginTop: '16px', background: '#1a3d2b', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                  Review in Moderation Queue →
                </button>
              </div>
            )}

            {/* Active iCal Feeds */}
            {savedFeeds.length > 0 && (
              <div style={{ marginTop: '32px' }}>
                <hr style={{ border: 'none', borderTop: '1.5px solid #e5e7eb', margin: '24px 0' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1f2937', marginBottom: '12px' }}>
                  📅 Active iCal Feeds — Auto-synced every 6 hours
                </h3>
                {savedFeeds.map((feed, i) => (
                  <div key={i} style={{ background: 'white', border: '1.5px solid #e5e7eb', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937' }}>{feed.organization}</div>
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>{feed.url}</div>
                        {feed.last_synced && (
                          <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                            Last synced: {new Date(feed.last_synced).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', background: '#f0fdf4', color: '#16803c', border: '1.5px solid #86efac', padding: '4px 10px', borderRadius: '999px', fontWeight: 700 }}>
                        ✓ Active
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}