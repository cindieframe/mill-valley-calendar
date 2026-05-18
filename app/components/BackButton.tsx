'use client'

export default function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '999px', padding: '7px 16px', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
    >
      ← Back
    </button>
  )
}