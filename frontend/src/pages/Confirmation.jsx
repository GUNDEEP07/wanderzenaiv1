import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Confirmation() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [dots, setDots] = useState('');

  const destination = state?.destination || 'your destination';
  const email = state?.email || 'your inbox';

  useEffect(() => {
    const iv = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 600);
    return () => clearInterval(iv);
  }, []);

  if (!state?.submissionId) {
    navigate('/plan');
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#faf7f2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: "'Source Serif 4', Georgia, serif" }}>
      <div style={{ maxWidth: '540px', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#e8f0ea', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', fontSize: '1.75rem' }}>✦</div>

        <div style={{ fontSize: '0.7rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#4a7c59', marginBottom: '0.75rem' }}>In progress</div>

        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '2.25rem', color: '#1a2e20', marginBottom: '1rem', lineHeight: 1.2 }}>
          Crafting your {destination} itinerary{dots}
        </h1>

        <p style={{ color: '#6a5e48', fontSize: '1rem', lineHeight: 1.8, marginBottom: '2rem' }}>
          We're finding the hidden cafes, quiet trails and local spots that make {destination} worth visiting.
          Your plan will arrive at <strong style={{ color: '#1a2e20' }}>{email}</strong> within 2–3 minutes.
        </p>

        <div style={{ background: '#e8f0ea', borderRadius: 6, padding: '1.25rem 1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
          {['Building your day-by-day plan', 'Finding hidden gems tourists miss', 'Selecting local eats and insider tips', 'Generating your PDF', 'Sending to your inbox'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', fontSize: '0.9rem', color: '#3c3428' }}>
              <span style={{ color: '#4a7c59', fontSize: '0.8rem' }}>◦</span>
              {step}
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.8rem', color: '#9a8c78', fontStyle: 'italic', marginBottom: '2rem' }}>
          Check your spam folder if it doesn't arrive within 5 minutes.
        </p>

        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: '1px solid #c8b89a', padding: '0.65rem 1.5rem', borderRadius: 4, fontFamily: "'Source Serif 4', serif", fontSize: '0.875rem', color: '#6a5e48', cursor: 'pointer' }}
        >
          ← Back to WanderZenAI
        </button>
      </div>
    </div>
  );
}
