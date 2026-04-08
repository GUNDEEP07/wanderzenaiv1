import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Pricing() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: '#faf7f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#1a2e20', marginBottom: '1rem' }}>Pricing coming soon</h1>
        <button onClick={() => navigate('/')} style={{ background: '#1a2e20', color: 'white', border: 'none', padding: '0.75rem 1.5rem', cursor: 'pointer', borderRadius: '4px' }}>← Back home</button>
      </div>
    </div>
  )
}
