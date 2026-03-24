'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../supabase'

const KNOWN_FEEDS = [
  { org: 'Mill Valley Library', url: '' },
  { org: 'Chamber of Commerce', url: '' },
  { org: 'City of Mill Valley', url: '' },
]

export default function ImportPage() {
  const router = useRouter()
  const [feedUrl, setFeedUrl] = useState('')
  const [organization, setOrganization] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [savedFeeds, setSavedFeeds] = useState<any[]>([])

  async function handleImport() {
    if (!feedUrl || !organization) {
      setError('Please enter both a feed URL and organization name.')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/import-ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl, organization })
      })
      const data = await response.json()
      if (data.error) {
        setError(data.error)
      } else {
        setResult(data)
        // Save feed URL to database
        await supabase.from('ical_feeds').upsert([{
          organization,
          url: feedUrl,
          last_synced: new Date().toISOString(),
          active: true
        }])
      }
    } catch (err) {
      setError('Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: '8px',
    padding: '10px 14px', fontFamily: 'sans-serif', fontSize: '13px',
    color: '#1f2937', outline: 'none', background: 'white'
  }

  return (
    <div style={{minHeight:'100vh',background:'#fafaf8',fontFamily:'sans-serif'}}>

      {/* Header */}
      <header style={{background:'#1a3d2b',padding:'14px 40px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div>
          <span style={{fontWeight:800,fontSize:'22px',color:'white',letterSpacing:'-1px'}}>town</span>
          <span style={{fontWeight:800,fontSize:'22px',color:'#e6a020',letterSpacing:'-1px',textTransform:'uppercase'}}>STIR</span>
          <span style={{fontSize:'12px',color:'rgba(255,255,255,0.5)',marginLeft:'12px'}}>Admin — iCal Import</span>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <button onClick={() => router.push('/admin')}
            style={{background:'transparent',color:'rgba(255,255,255,0.7)',border:'1.5px solid rgba(255,255,255,0.3)',padding:'8px 18px',borderRadius:'999px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
            ← Moderation Queue
          </button>
          <button onClick={() => router.push('/')}
            style={{background:'transparent',color:'rgba(255,255,255,0.7)',border:'1.5px solid rgba(255,255,255,0.3)',padding:'8px 18px',borderRadius:'999px',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
            Calendar
          </button>
        </div>
      </header>

      <div style={{maxWidth:'640px',margin:'0 auto',padding:'40px 24px 80px'}}>
        <h1 style={{fontFamily:'Georgia,serif',fontSize:'28px',fontWeight:900,color:'#1f2937',marginBottom:'6px'}}>
          iCal Feed Import
        </h1>
        <p style={{color:'#9ca3af',fontSize:'14px',marginBottom:'32px'}}>
          Paste an iCal feed URL to import events automatically. Claude will categorize each event.
        </p>

        {/* Organization */}
        <div style={{marginBottom:'14px'}}>
          <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#374151',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.8px'}}>
            Organization
          </label>
          <input style={inputStyle} placeholder="e.g. Mill Valley Library"
            value={organization} onChange={e => setOrganization(e.target.value)}/>
        </div>

        {/* Feed URL */}
        <div style={{marginBottom:'20px'}}>
          <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'#374151',marginBottom:'5px',textTransform:'uppercase',letterSpacing:'0.8px'}}>
            iCal Feed URL
          </label>
          <input style={inputStyle} placeholder="https://calendar.google.com/calendar/ical/..."
            value={feedUrl} onChange={e => setFeedUrl(e.target.value)}/>
          <div style={{fontSize:'11px',color:'#9ca3af',marginTop:'5px'}}>
            Google Calendar: Settings → your calendar → Integrate calendar → copy the iCal link
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{background:'#fee2e2',borderRadius:'8px',padding:'12px 16px',marginBottom:'16px',fontSize:'13px',color:'#dc2626'}}>
            ⚠️ {error}
          </div>
        )}

        {/* Import button */}
        <button onClick={handleImport} disabled={loading}
          style={{width:'100%',background:'#1a3d2b',color:'white',border:'none',padding:'14px',borderRadius:'999px',fontSize:'15px',fontWeight:700,cursor:loading?'not-allowed':'pointer',opacity:loading?0.7:1,marginBottom:'32px'}}>
          {loading ? '⏳ Importing & categorizing with Claude…' : '⬇️ Import Events'}
        </button>

        {/* Results */}
        {result && (
          <div style={{background:'#f0fdf4',borderRadius:'12px',padding:'20px',border:'1.5px solid #86efac',marginBottom:'32px'}}>
            <h3 style={{fontSize:'16px',fontWeight:700,color:'#16803c',marginBottom:'12px'}}>
              ✅ Import Complete!
            </h3>
            <div style={{fontSize:'14px',color:'#166534',marginBottom:'16px'}}>
              <strong>{result.imported}</strong> events imported &nbsp;·&nbsp;
              <strong>{result.skipped}</strong> skipped (already exist) &nbsp;·&nbsp;
              <strong>{result.total}</strong> total in feed
            </div>
            {result.results?.length > 0 && (
              <div>
                <div style={{fontSize:'11px',fontWeight:700,color:'#16803c',textTransform:'uppercase',letterSpacing:'0.8px',marginBottom:'8px'}}>
                  Imported events — review in moderation queue:
                </div>
                {result.results.map((r: any, i: number) => (
                  <div key={i} style={{background:'white',borderRadius:'8px',padding:'10px 14px',marginBottom:'6px',fontSize:'12px'}}>
                    <div style={{fontWeight:700,color:'#1f2937',marginBottom:'2px'}}>{r.title}</div>
                    <div style={{color:'#9ca3af'}}>{r.date} &nbsp;·&nbsp; 🏷️ {r.categories} &nbsp;·&nbsp; {r.tags||'no tags'}</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => router.push('/admin')}
              style={{marginTop:'16px',background:'#1a3d2b',color:'white',border:'none',padding:'10px 24px',borderRadius:'999px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
              Review in Moderation Queue →
            </button>
          </div>
        )}

        {/* How to find iCal URLs */}
        <div style={{background:'white',borderRadius:'12px',padding:'20px',border:'1.5px solid #e5e7eb'}}>
          <h3 style={{fontSize:'14px',fontWeight:700,color:'#1f2937',marginBottom:'12px'}}>
            📋 How to find iCal feed URLs
          </h3>
          <div style={{fontSize:'13px',color:'#4b5563',lineHeight:1.8}}>
            <strong>Google Calendar:</strong> Settings → click calendar name → Integrate calendar → copy iCal link<br/>
            <strong>The City of Mill Valley:</strong> cityofmillvalley.gov/Calendar.aspx → Subscribe<br/>
            <strong>Mill Valley Library:</strong> Check their website for a calendar export or contact them<br/>
            <strong>Chamber of Commerce:</strong> mvchamber.com — look for calendar or events export
          </div>
        </div>
      </div>
    </div>
  )
}