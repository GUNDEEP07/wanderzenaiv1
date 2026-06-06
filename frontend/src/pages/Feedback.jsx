import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Feedback.css';

const navy = '#0a0f1e';
const navy2 = '#111827';
const navy3 = '#141d33';
const teal = '#00d4aa';
const tealGlow = 'rgba(0,212,170,0.12)';
const border = 'rgba(255,255,255,0.08)';
const w60 = 'rgba(255,255,255,0.6)';
const w40 = 'rgba(255,255,255,0.4)';

export default function Feedback() {
  const { currentUser } = useAuth();
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = [
    { id: 'general',       label: '💭 General feedback' },
    { id: 'itinerary',     label: '🗺️ Itinerary quality' },
    { id: 'ui',            label: '🎨 Design & UX' },
    { id: 'ai-content',    label: '✨ AI content' },
    { id: 'bug',           label: '🐛 Bug report' },
    { id: 'feature',       label: '🚀 Feature request' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please write your feedback');
      return;
    }
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          category,
          message: message.trim(),
          userEmail: currentUser?.email || 'anonymous',
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        setRating(0);
        setCategory('general');
        setMessage('');
        setTimeout(() => setSubmitted(false), 5000);
      } else {
        setError('Failed to submit feedback. Please try again.');
      }
    } catch (err) {
      setError('Error submitting feedback: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: navy, minHeight: '100vh', padding: '3rem 2rem', color: '#fff' }}>
      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.03em' }}>
            We'd love to hear from you
          </h1>
          <p style={{ fontSize: '1.1rem', color: w40, lineHeight: 1.6 }}>
            Your feedback helps us make WanderZenAI better. Tell us what you think about your experience.
          </p>
        </div>

        {/* Form Card */}
        <div style={{ background: navy3, border: `1px solid ${border}`, borderRadius: 16, padding: '2rem', marginBottom: '2rem' }}>

          {submitted && (
            <div style={{ padding: '1rem', background: 'rgba(0,212,170,0.1)', border: `1px solid ${teal}`, borderRadius: 10, marginBottom: '1.5rem', color: teal, fontSize: '0.95rem' }}>
              ✓ Thank you for your feedback! It helps us improve.
            </div>
          )}

          {error && (
            <div style={{ padding: '1rem', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.5)', borderRadius: 10, marginBottom: '1.5rem', color: '#ff6b6b', fontSize: '0.95rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Category */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#fff' }}>
                What's this about?
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 10,
                      border: `1.5px solid ${category === cat.id ? teal : border}`,
                      background: category === cat.id ? 'rgba(0,212,170,0.1)' : 'rgba(255,255,255,0.02)',
                      color: category === cat.id ? teal : w60,
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#fff' }}>
                How satisfied are you?
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[1, 2, 3, 4, 5].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRating(r)}
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 10,
                      border: `2px solid ${rating === r ? teal : border}`,
                      background: rating === r ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.03)',
                      color: rating === r ? teal : w60,
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', color: w40, marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                <span>😞 Not satisfied</span>
                <span>😊 Very satisfied</span>
              </div>
            </div>

            {/* Message */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: '#fff' }}>
                Tell us more
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="What can we improve? Any bugs? Feature ideas? We'd love to know..."
                style={{
                  width: '100%',
                  minHeight: 140,
                  padding: '1rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${border}`,
                  borderRadius: 10,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  outline: 'none',
                }}
              />
              <div style={{ fontSize: '0.8rem', color: w40, marginTop: '0.5rem' }}>
                {message.length}/500 characters
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.875rem 1.5rem',
                background: loading ? 'rgba(0,212,170,0.4)' : teal,
                color: navy,
                border: 'none',
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 700,
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Sending...' : 'Send feedback'}
            </button>
          </form>
        </div>

        {/* Info box */}
        <div style={{ background: 'rgba(0,212,170,0.08)', border: `1px solid ${teal}`, borderRadius: 12, padding: '1.5rem', color: w60 }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: teal }}>💡 Quick tips</div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
            <li>Be specific — details help us understand the issue</li>
            <li>Mention which page or feature you're talking about</li>
            <li>For bugs, tell us what you expected vs. what happened</li>
            <li>Feature ideas are always welcome!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
